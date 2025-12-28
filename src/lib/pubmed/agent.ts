import { GoogleGenAI, Type, type Content } from '@google/genai';
import type { PubmedArticle } from '@/types';
import {
  pubmedFetchAbstracts,
  pubmedFetchSummary,
  pubmedFindSimilar,
  pubmedSearchPmids,
  type PubmedAbstractRecord,
  type PubmedSummary,
} from './eutils';

export type PubmedAgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type PubmedAgentResponse = {
  reply: string;
  model: string;
  toolLog: PubmedToolLogEntry[];
  added: PubmedArticle[];
  removed: string[];
};

export type PubmedToolLogEntry = {
  name: string;
  args: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  timestamp: number;
};

const DEFAULT_MODEL = process.env.MANUSCRIPTAI_LLM_MODEL_FAST || 'gemini-3-flash-preview';
const MAX_TURNS = 6;

const normalizeWords = (value: string) => (value || '').toLowerCase().match(/[a-z0-9]+/g) || [];

const jaccard = (a: string[], b: string[]) => {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let overlap = 0;
  for (const token of sa) {
    if (sb.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, sa.size + sb.size - overlap);
};

const looksLikeCopiedPrompt = (userRequest: string, query: string) => {
  const ur = (userRequest || '').trim().toLowerCase();
  const q = (query || '').trim().toLowerCase();
  if (!ur || !q) return false;

  if (ur.length >= 80 && q.includes(ur.slice(0, 80))) return true;

  const urWords = normalizeWords(ur);
  const qWords = normalizeWords(q);
  if (qWords.length >= 12 && jaccard(urWords, qWords) >= 0.7) return true;

  if (!/\[(tiab|mesh|pt|mh|majr|jour|au|lang|date\s*-\s*publication|all fields)\]/i.test(q)) {
    return true;
  }

  return false;
};

const buildSystemInstruction = (articles: Array<{ pmid?: string; title?: string }>) => {
  const list = articles
    .map((article) => {
      const pmid = typeof article.pmid === 'string' ? article.pmid : 'n/a';
      const title = typeof article.title === 'string' ? article.title : 'Untitled';
      return `- ${pmid}: ${title}`;
    })
    .join('\n');

  return [
    'You are a medical literature assistant with PubMed tools.',
    '',
    'Rules:',
    '- The user request is natural language. Do NOT paste it as a PubMed query.',
    '- When searching, generate PubMed Advanced Search queries with field tags (e.g., [Mesh], [tiab], [pt], [lang], date range).',
    '- Apply humans filter unless the user explicitly requests animal-only or preclinical work: NOT (animals[mh] NOT humans[mh]).',
    '- Prefer English unless the user explicitly requests otherwise.',
    '- Use tools to search, then fetch titles, and fetch abstracts for the most promising items.',
    '- Avoid duplicates by checking the current article board.',
    '- If the user asks to remove items, call pubmed_remove_articles_tool with PMIDs or title snippets.',
    '',
    'Current article board:',
    list || '(empty)',
  ].join('\n');
};

const extractArticlesFromToolLog = (toolLog: PubmedToolLogEntry[]): PubmedArticle[] => {
  const titlesByPmid = new Map<string, PubmedSummary>();
  const abstractsByPmid = new Map<string, PubmedAbstractRecord>();

  for (const entry of toolLog) {
    if (entry.name === 'pubmed_fetch_titles_tool' && entry.result?.ok && Array.isArray(entry.result?.items)) {
      for (const item of entry.result.items as PubmedSummary[]) {
        if (!item?.pmid) continue;
        titlesByPmid.set(String(item.pmid), item);
      }
    }

    if (entry.name === 'pubmed_fetch_abstracts_tool' && entry.result?.ok && Array.isArray(entry.result?.items)) {
      for (const item of entry.result.items as PubmedAbstractRecord[]) {
        if (!item?.pmid) continue;
        abstractsByPmid.set(String(item.pmid), item);
      }
    }
  }

  const pmids = new Set<string>([...titlesByPmid.keys(), ...abstractsByPmid.keys()]);
  const now = Date.now();

  const articles: PubmedArticle[] = [];
  for (const pmid of pmids) {
    const titleRecord = titlesByPmid.get(pmid);
    const abstractRecord = abstractsByPmid.get(pmid);
    const pubdate = titleRecord?.pubdate;
    const pubYear = abstractRecord?.year || (pubdate ? pubdate.match(/\d{4}/)?.[0] : undefined);

    articles.push({
      id: pmid,
      pmid,
      title: abstractRecord?.title || titleRecord?.title || 'Untitled',
      authors: titleRecord?.authors?.join(', '),
      journal: abstractRecord?.journal || titleRecord?.fullJournalName || titleRecord?.source,
      year: pubYear,
      pubdate,
      doi: titleRecord?.doi,
      abstract: abstractRecord?.abstract,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      addedAt: now,
    });
  }

  return articles;
};

const getApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY.');
  }
  return apiKey;
};

const coerceNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)).filter((v) => v.trim().length > 0) : [];

export const runPubmedAgent = async ({
  messages,
  existingArticles,
}: {
  messages: PubmedAgentMessage[];
  existingArticles: Array<{ pmid?: string; title?: string }>;
}): Promise<PubmedAgentResponse> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const systemInstruction = buildSystemInstruction(existingArticles);
  const model = DEFAULT_MODEL;
  const toolLog: PubmedToolLogEntry[] = [];
  const removed = new Set<string>();

  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
  const availableArticles = existingArticles
    .filter((article) => article.pmid || article.title)
    .map((article) => ({
      pmid: typeof article.pmid === 'string' ? article.pmid : undefined,
      title: typeof article.title === 'string' ? article.title : '',
    }));

  const contents: Content[] = messages
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

  const toolDefinitions = [
    {
      name: 'pubmed_search_pmids_generated_tool',
      description: 'Search PubMed using an advanced query with field tags and return matching PMIDs.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          advanced_query: {
            type: Type.STRING,
            description: 'PubMed advanced query with field tags and boolean operators.',
          },
          retmax: {
            type: Type.NUMBER,
            description: 'Max number of PMIDs to return (1-50).',
          },
          sort: {
            type: Type.STRING,
            enum: ['relevance', 'pub_date'],
            description: 'Sort order for PubMed search results.',
          },
        },
        required: ['advanced_query'],
      },
    },
    {
      name: 'pubmed_fetch_titles_tool',
      description: 'Fetch titles and citation metadata for a list of PMIDs.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pmids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of PubMed IDs to fetch.',
          },
        },
        required: ['pmids'],
      },
    },
    {
      name: 'pubmed_fetch_abstracts_tool',
      description: 'Fetch abstracts and journal metadata for a list of PMIDs.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pmids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of PubMed IDs to fetch.',
          },
        },
        required: ['pmids'],
      },
    },
    {
      name: 'pubmed_similar_pmids_tool',
      description: 'Find related PubMed IDs for a seed PMID.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pmid: { type: Type.STRING, description: 'Seed PubMed ID.' },
          retmax: { type: Type.NUMBER, description: 'Max number of related PMIDs to return.' },
        },
        required: ['pmid'],
      },
    },
    {
      name: 'pubmed_remove_articles_tool',
      description: 'Remove items from the article board by PMID or title snippet.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pmids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of PMIDs to remove from the board.',
          },
          title_contains: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Title snippets to match for removal (case-insensitive).',
          },
          reason: {
            type: Type.STRING,
            description: 'Optional reason for removal to reflect to the user.',
          },
        },
      },
    },
  ];

  const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
    pubmed_search_pmids_generated_tool: async (args) => {
      const advancedQuery = typeof args.advanced_query === 'string' ? args.advanced_query.trim() : '';
      const retmax = Math.max(1, Math.min(50, coerceNumber(args.retmax, 20)));
      const sort = args.sort === 'pub_date' ? 'pub_date' : 'relevance';

      if (!advancedQuery) {
        return { ok: false, error: 'advanced_query is required.' };
      }

      if (looksLikeCopiedPrompt(lastUserMessage, advancedQuery)) {
        return {
          ok: false,
          error:
            'Rejected: advanced_query looks like copied user request and/or lacks PubMed field tags. Provide a tagged PubMed query.',
          examples: [
            '"Sodium-Glucose Transporter 2 Inhibitors"[Mesh] OR empagliflozin[tiab] OR dapagliflozin[tiab]',
            'randomized controlled trial[pt] OR meta-analysis[pt]',
            '("2015"[Date - Publication] : "2025"[Date - Publication])',
            'english[lang]',
            'NOT (animals[mh] NOT humans[mh])',
          ],
        };
      }

      const search = await pubmedSearchPmids({ query: advancedQuery, retmax, sort });
      return { ok: true, query: advancedQuery, retmax, pmids: search.pmids, count: search.count };
    },
    pubmed_fetch_titles_tool: async (args) => {
      const pmids = toStringArray(args.pmids).slice(0, 80);
      if (pmids.length === 0) return { ok: false, error: 'pmids are required.' };
      const items = await pubmedFetchSummary(pmids);
      return { ok: true, items };
    },
    pubmed_fetch_abstracts_tool: async (args) => {
      const pmids = toStringArray(args.pmids).slice(0, 40);
      if (pmids.length === 0) return { ok: false, error: 'pmids are required.' };
      const items = await pubmedFetchAbstracts(pmids);
      return { ok: true, items };
    },
    pubmed_similar_pmids_tool: async (args) => {
      const pmid = typeof args.pmid === 'string' ? args.pmid : '';
      const retmax = Math.max(1, Math.min(50, coerceNumber(args.retmax, 20)));
      if (!pmid) return { ok: false, error: 'pmid is required.' };
      const similar = await pubmedFindSimilar(pmid, retmax);
      return { ok: true, pmid, similar_pmids: similar };
    },
    pubmed_remove_articles_tool: async (args) => {
      const pmids = new Set(toStringArray(args.pmids));
      const snippets = toStringArray(args.title_contains).map((v) => v.toLowerCase());
      if (snippets.length > 0) {
        for (const article of availableArticles) {
          if (!article.title) continue;
          const title = article.title.toLowerCase();
          if (snippets.some((snippet) => snippet && title.includes(snippet))) {
            if (article.pmid) pmids.add(article.pmid);
          }
        }
      }
      const removedPmids = Array.from(pmids).filter(Boolean);
      removedPmids.forEach((pmid) => removed.add(pmid));
      return {
        ok: true,
        removed: removedPmids,
        reason: typeof args.reason === 'string' ? args.reason : undefined,
      };
    },
  };

  let finalText = '';

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 1200,
        tools: [{ functionDeclarations: toolDefinitions }],
      },
    });

    const functionCalls = response.functionCalls || [];
    if (!functionCalls.length) {
      finalText = response.text || '';
      break;
    }

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    }

    for (const call of functionCalls) {
      const name = String(call.name || '');
      const args = (call.args as Record<string, unknown>) || {};
      const handler = toolHandlers[name];
      let result: Record<string, unknown>;

      try {
        result = handler ? await handler(args) : { ok: false, error: `Unknown tool: ${name}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed.';
        result = { ok: false, error: message };
      }

      toolLog.push({ name, args, result, timestamp: Date.now() });

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name,
              response: result,
            },
          },
        ],
      });
    }
  }

  if (!finalText) {
    finalText = 'I was unable to complete the PubMed search flow. Please try again with a more specific request.';
  }

  const added = extractArticlesFromToolLog(toolLog);

  return {
    reply: finalText,
    model,
    toolLog,
    added,
    removed: Array.from(removed),
  };
};

import { FunctionCallingConfigMode, GoogleGenAI, Type, type Content, type Part } from '@google/genai';
import { createHash } from 'crypto';
import type { PubmedArticle } from '@/types';
import { parseJsonFromText } from '@/lib/llm/json';
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

export type PubmedAgentStreamEvent =
  | { type: 'thought'; text: string; turn: number }
  | { type: 'token'; text: string; turn: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown>; turn: number }
  | { type: 'tool_result'; name: string; summary: string; turn: number }
  | { type: 'final'; reply: string; model: string; added: PubmedArticle[]; removed: string[] }
  | { type: 'error'; message: string };

export type PubmedToolLogEntry = {
  name: string;
  args: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  timestamp: number;
};

const DEFAULT_MODEL = process.env.MANUSCRIPTAI_LLM_MODEL_FAST || 'gemini-3-flash-preview';
const MAX_TURNS = 12;

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
    '- Use tools to search, then fetch titles to review relevance. Fetching titles does NOT add items to the board.',
    '- Only add items to the board by calling pubmed_add_articles_tool with selected PMIDs.',
    '- pubmed_add_articles_tool will fetch full metadata (abstract, year, journal, etc.) and will be re-screened for relevance.',
    '- Avoid duplicates by checking the current article board.',
    '- If the user asks to remove items, call pubmed_remove_articles_tool with PMIDs or title snippets.',
    '',
    'Current article board:',
    list || '(empty)',
  ].join('\n');
};

const buildArticlesFromRecords = (
  titlesByPmid: Map<string, PubmedSummary>,
  abstractsByPmid: Map<string, PubmedAbstractRecord>
): PubmedArticle[] => {
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

const extractArticlesFromToolLog = (toolLog: PubmedToolLogEntry[]): PubmedArticle[] => {
  const addedArticles: PubmedArticle[] = [];

  for (const entry of toolLog) {
    if (entry.name === 'pubmed_add_articles_tool' && entry.result?.ok && Array.isArray(entry.result?.items)) {
      for (const item of entry.result.items as PubmedArticle[]) {
        if (!item?.pmid && !item?.id) continue;
        addedArticles.push(item);
      }
      continue;
    }
  }

  if (addedArticles.length > 0) {
    return addedArticles;
  }

  return [];
};

let didLogKeyFingerprint = false;

const fingerprintApiKey = (apiKey: string) => createHash('sha256').update(apiKey).digest('hex').slice(0, 8);

const maybeLogKeyFingerprint = (apiKey: string) => {
  if (process.env.NODE_ENV === 'production' || didLogKeyFingerprint) return;
  didLogKeyFingerprint = true;
  console.info('Gemini API key loaded for PubMed agent.', {
    fingerprint: fingerprintApiKey(apiKey),
    length: apiKey.length,
  });
};

const getApiKey = () => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY (recommended).');
  }
  maybeLogKeyFingerprint(apiKey);
  return apiKey;
};

const isQuotaError = (message: string) =>
  /quota|rate limit|resource exhausted|billing|free tier/i.test(message || '');

const buildQuotaErrorMessage = (message: string, fingerprint?: string) => {
  const hint = fingerprint && process.env.NODE_ENV !== 'production' ? ` (key fp: ${fingerprint})` : '';
  return [
    `Gemini quota/billing error${hint}.`,
    'Verify the key belongs to your paid Google AI Studio project, then restart the dev server.',
    message ? `Original error: ${message}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
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

type PubmedRelevanceScreening = {
  pmid: string;
  relevant: boolean;
  confidence?: number;
  reason?: string;
};

const summarizeToolResult = (name: string, result: Record<string, unknown>) => {
  if (!result || typeof result !== 'object') return `${name} completed.`;
  if (name === 'pubmed_search_pmids_generated_tool') {
    const count = typeof result.count === 'number' ? result.count : undefined;
    return `PubMed search${count !== undefined ? ` returned ${count} hits` : ' completed'}.`;
  }
  if (name === 'pubmed_fetch_titles_tool') {
    const items = Array.isArray(result.items) ? result.items.length : undefined;
    return `Fetched titles${items !== undefined ? ` (${items})` : ''}.`;
  }
  if (name === 'pubmed_fetch_abstracts_tool') {
    const items = Array.isArray(result.items) ? result.items.length : undefined;
    return `Fetched abstracts${items !== undefined ? ` (${items})` : ''}.`;
  }
  if (name === 'pubmed_similar_pmids_tool') {
    const items = Array.isArray(result.similar_pmids) ? result.similar_pmids.length : undefined;
    return `Found related articles${items !== undefined ? ` (${items})` : ''}.`;
  }
  if (name === 'pubmed_add_articles_tool') {
    const items = Array.isArray(result.items) ? result.items.length : undefined;
    return `Added articles to board${items !== undefined ? ` (${items})` : ''}.`;
  }
  if (name === 'pubmed_remove_articles_tool') {
    const removed = Array.isArray(result.removed) ? result.removed.length : undefined;
    return `Removed articles${removed !== undefined ? ` (${removed})` : ''}.`;
  }
  return `${name} completed.`;
};

const buildRelevancePrompt = (userRequest: string, items: PubmedArticle[]) => {
  const rows = items
    .map((item) => {
      const year = item.year ? ` (${item.year})` : '';
      const journal = item.journal ? ` | ${item.journal}` : '';
      const abstractSnippet = item.abstract ? `\nAbstract: ${item.abstract}` : '';
      return `PMID: ${item.pmid}${year}\nTitle: ${item.title}${journal}${abstractSnippet}`;
    })
    .join('\n\n---\n\n');

  return [
    'You are screening PubMed candidates for relevance to the user request.',
    'Return ONLY valid JSON (RFC 8259) with this shape:',
    '[{"pmid":"...","relevant":true|false,"confidence":0-1,"reason":"short"}]',
    'Rules:',
    '- Be strict; only mark relevant if clearly aligned with the request.',
    '- Confidence reflects certainty based on title/abstract.',
    '- If uncertain, mark relevant=false.',
    '',
    `User request: ${userRequest || '(empty)'}`,
    '',
    'Candidates:',
    rows || '(none)',
  ].join('\n');
};

const parseRelevanceResponse = (text: string): PubmedRelevanceScreening[] => {
  const { data } = parseJsonFromText<PubmedRelevanceScreening[]>(text);
  return Array.isArray(data) ? data : [];
};

const screenRelevantArticles = async ({
  ai,
  model,
  userRequest,
  items,
}: {
  ai: GoogleGenAI;
  model: string;
  userRequest: string;
  items: PubmedArticle[];
}): Promise<{ screened: PubmedRelevanceScreening[]; relevantPmids: string[]; rawText: string }> => {
  if (items.length === 0) {
    return { screened: [], relevantPmids: [], rawText: '' };
  }

  const prompt = buildRelevancePrompt(userRequest, items);
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0,
      maxOutputTokens: 2000,
    },
  });

  let screened: PubmedRelevanceScreening[] = [];
  try {
    screened = parseRelevanceResponse(response.text || '');
  } catch (error) {
    const repairSystem =
      'You are a JSON repair tool. Convert the input into STRICT valid JSON (RFC 8259). Output ONLY the JSON.';
    const repairPrompt = `Fix this into strict JSON only:\n\n${response.text || ''}`;
    const repair = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
      config: {
        systemInstruction: repairSystem,
        temperature: 0,
        maxOutputTokens: 2000,
      },
    });
    screened = parseRelevanceResponse(repair.text || '');
  }

  const relevantPmids = screened
    .filter((item) => item?.pmid && item.relevant && (item.confidence ?? 0) >= 0.6)
    .map((item) => item.pmid);

  return { screened, relevantPmids, rawText: response.text || '' };
};

const iterParts = (chunk: any): Part[] => {
  const candidates = chunk?.candidates || [];
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const content = candidates[0]?.content;
  const parts = content?.parts;
  return Array.isArray(parts) ? parts : [];
};

const finalizeResponse = (toolLog: PubmedToolLogEntry[], removed: Set<string>) => {
  const added = extractArticlesFromToolLog(toolLog);
  return { added, removed: Array.from(removed) };
};

export const runPubmedAgentStream = async ({
  messages,
  existingArticles,
  emit,
}: {
  messages: PubmedAgentMessage[];
  existingArticles: Array<{ pmid?: string; title?: string }>;
  emit: (event: PubmedAgentStreamEvent) => void;
}): Promise<PubmedAgentResponse> => {
  const apiKey = getApiKey();
  const keyFingerprint = fingerprintApiKey(apiKey);
  const ai = new GoogleGenAI({ apiKey });
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
      name: 'pubmed_add_articles_tool',
      description:
        'Add selected PubMed articles to the board by PMID. Fetches full metadata (abstract, year, journal, etc.) automatically.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          pmids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of PubMed IDs to add to the board.',
          },
          reason: {
            type: Type.STRING,
            description: 'Optional short rationale for why these items were selected.',
          },
        },
        required: ['pmids'],
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
    pubmed_add_articles_tool: async (args) => {
      const inputPmids = toStringArray(args.pmids);
      if (inputPmids.length === 0) return { ok: false, error: 'pmids are required.' };
      const existingPmids = new Set(availableArticles.map((article) => article.pmid).filter(Boolean) as string[]);
      const pmids = inputPmids.filter((pmid) => !existingPmids.has(pmid)).slice(0, 40);

      if (pmids.length === 0) {
        return {
          ok: true,
          items: [],
          skipped: inputPmids,
          reason: typeof args.reason === 'string' ? args.reason : undefined,
        };
      }

      const [summaryItems, abstractItems] = await Promise.all([
        pubmedFetchSummary(pmids),
        pubmedFetchAbstracts(pmids),
      ]);

      const titlesByPmid = new Map<string, PubmedSummary>();
      const abstractsByPmid = new Map<string, PubmedAbstractRecord>();

      for (const item of summaryItems) {
        if (!item?.pmid) continue;
        titlesByPmid.set(String(item.pmid), item);
      }
      for (const item of abstractItems) {
        if (!item?.pmid) continue;
        abstractsByPmid.set(String(item.pmid), item);
      }

      const candidates = buildArticlesFromRecords(titlesByPmid, abstractsByPmid);
      const { screened, relevantPmids } = await screenRelevantArticles({
        ai,
        model,
        userRequest: lastUserMessage,
        items: candidates,
      });
      const relevantSet = new Set(relevantPmids);
      const items = candidates.filter((item) => item.pmid && relevantSet.has(item.pmid));

      return {
        ok: true,
        items,
        screened,
        skipped: inputPmids.filter((pmid) => existingPmids.has(pmid)),
        reason: typeof args.reason === 'string' ? args.reason : undefined,
      };
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
    let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
    try {
      stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
          maxOutputTokens: 12000,
          tools: [{ functionDeclarations: toolDefinitions }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          },
          automaticFunctionCalling: { disable: true },
          thinkingConfig: { includeThoughts: true },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gemini request failed.';
      if (isQuotaError(message)) {
        throw new Error(buildQuotaErrorMessage(message, keyFingerprint));
      }
      throw error;
    }

    const modelParts: Part[] = [];
    const pendingFunctionCalls: Array<Record<string, unknown>> = [];
    let sawToolCall = false;

    for await (const chunk of stream) {
      const parts = iterParts(chunk);
      for (const part of parts) {
        if (part?.thought && part?.text) {
          emit({ type: 'thought', text: part.text.trim(), turn });
          modelParts.push(part);
          continue;
        }
        if (part?.text) {
          finalText += part.text;
          modelParts.push(part);
          continue;
        }
        if (part?.functionCall) {
          const call = part.functionCall;
          const name = String(call?.name || '');
          const args = (call?.args as Record<string, unknown>) || {};
          emit({ type: 'tool_call', name, args, turn });
          pendingFunctionCalls.push({ name, args });
          modelParts.push(part);
          sawToolCall = true;
        }
      }
    }

    if (modelParts.length > 0) {
      contents.push({ role: 'model', parts: modelParts });
    }

    if (!sawToolCall || pendingFunctionCalls.length === 0) {
      break;
    }

    for (const call of pendingFunctionCalls) {
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
      emit({ type: 'tool_result', name, summary: summarizeToolResult(name, result), turn });

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

  const { added, removed: removedList } = finalizeResponse(toolLog, removed);

  if (!finalText.trim()) {
    const searchEntry = toolLog.find(
      (entry) => entry.name === 'pubmed_search_pmids_generated_tool' && entry.result?.ok
    );
    const searchCount =
      typeof searchEntry?.result?.count === 'number'
        ? searchEntry.result.count
        : Array.isArray(searchEntry?.result?.pmids)
          ? searchEntry.result.pmids.length
          : undefined;
    const addedCount = added.length;
    const removedCount = removedList.length;

    const summaryBits: string[] = [];
    if (typeof searchCount === 'number') {
      summaryBits.push(`PubMed returned ${searchCount} matches`);
    }
    if (addedCount > 0) {
      summaryBits.push(`added ${addedCount} article${addedCount === 1 ? '' : 's'} to the board`);
    }
    if (removedCount > 0) {
      summaryBits.push(`removed ${removedCount} article${removedCount === 1 ? '' : 's'}`);
    }

    const summary = summaryBits.length > 0 ? `${summaryBits.join(', ')}.` : '';
    finalText = [
      summary || 'The PubMed tools ran, but I did not receive a full response from the model.',
      'Please retry or narrow the request (e.g., date range, population, trial phase).',
    ]
      .filter(Boolean)
      .join(' ');

    console.warn('PubMed agent produced no text output.', {
      model,
      toolCalls: toolLog.length,
      addedCount,
      removedCount,
      lastUserMessageLength: lastUserMessage.length,
    });
  }

  emit({ type: 'final', reply: finalText, model, added, removed: removedList });

  return {
    reply: finalText,
    model,
    toolLog,
    added,
    removed: removedList,
  };
};

export const runPubmedAgent = async ({
  messages,
  existingArticles,
}: {
  messages: PubmedAgentMessage[];
  existingArticles: Array<{ pmid?: string; title?: string }>;
}): Promise<PubmedAgentResponse> => {
  const events: PubmedAgentStreamEvent[] = [];
  return runPubmedAgentStream({
    messages,
    existingArticles,
    emit: (event) => events.push(event),
  });
};

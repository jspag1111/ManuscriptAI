import { Agent, extractAllTextOutput, run, tool, setDefaultOpenAIKey } from '@openai/agents';
import { z } from 'zod';

import type { AgentInputItem } from '@openai/agents';
import type { Project, PubmedArticle } from '@/types';
import { chatkitDocumentStore, projectStore } from '@/lib/db';
import { pubmedFetchAbstracts, pubmedFetchSummary, pubmedFindSimilar, pubmedSearchPmids } from '@/lib/pubmed/eutils';
import { coerceArticles, mergeArticles } from '@/utils/pubmedArticleUtils';
import { generateId } from '@/lib/projects';

export type OpenAiAgentContext = {
  userId: string;
  projectId: string;
};

const MODEL_FALLBACK = 'gpt-4.1';

const ensureOpenAIKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for the ChatKit agent.');
  }
  setDefaultOpenAIKey(apiKey);
};

const buildArticleBoardSummary = (project: Project) => {
  const articles = coerceArticles(project.pubmedArticles);
  if (articles.length === 0) return 'No articles are currently saved in the board.';
  const items = articles.slice(0, 40).map((article) => {
    const pmid = article.pmid ? `PMID ${article.pmid}` : 'PMID n/a';
    const year = article.year ? `(${article.year})` : '';
    return `- ${pmid}: ${article.title} ${year}`.trim();
  });
  return `Current article board (${articles.length} items):\n${items.join('\n')}`;
};

const buildInstructions = (project: Project) => {
  const boardSummary = buildArticleBoardSummary(project);
  return [
    'You are a biomedical literature assistant for ManuscriptAI.',
    'Use PubMed tools to search for articles and curate relevant sources.',
    'When the user asks to add sources, call article_board_add with complete metadata (pmid, title, authors, journal, year, doi, abstract, url) whenever possible.',
    'When removing sources, call article_board_remove with PMIDs or title snippets.',
    'Always check the current board with article_board_list before answering questions about saved sources.',
    'When asked to create a downloadable document, call document_create with markdown and a filename, then include the returned download_url in your response.',
    'Be concise and cite PMIDs when referencing specific articles.',
    '',
    boardSummary,
  ].join('\n');
};

const normalizeArticleInput = (raw: {
  pmid?: string;
  title?: string;
  authors?: string;
  journal?: string;
  year?: string;
  doi?: string;
  abstract?: string;
  url?: string;
  rationale?: string;
}): PubmedArticle | null => {
  const pmid = raw.pmid?.trim();
  const title = raw.title?.trim();
  if (!pmid && !title) return null;

  return {
    id: pmid || generateId(),
    pmid: pmid || undefined,
    title: title || 'Untitled',
    authors: raw.authors?.trim() || undefined,
    journal: raw.journal?.trim() || undefined,
    year: raw.year?.trim() || undefined,
    doi: raw.doi?.trim() || undefined,
    abstract: raw.abstract?.trim() || undefined,
    url: raw.url?.trim() || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined),
    addedAt: Date.now(),
    rationale: raw.rationale?.trim() || undefined,
  };
};

const buildTools = () => {
  const pubmedSearchTool = tool({
    name: 'pubmed_search_pmids',
    description: 'Search PubMed with an advanced query and return PMIDs plus count.',
    parameters: z.object({
      query: z.string().min(1),
      retmax: z.number().min(1).max(200).optional(),
      sort: z.enum(['relevance', 'pub_date']).optional(),
    }),
    execute: async ({ query, retmax, sort }) => {
      const result = await pubmedSearchPmids({
        query,
        retmax: typeof retmax === 'number' ? Math.min(200, retmax) : 25,
        sort: sort || 'relevance',
      });
      return {
        ok: true,
        query: result.query,
        count: result.count,
        pmids: result.pmids,
      };
    },
  });

  const pubmedFetchTitlesTool = tool({
    name: 'pubmed_fetch_titles',
    description: 'Fetch PubMed titles and citation metadata for PMIDs.',
    parameters: z.object({
      pmids: z.array(z.string().min(1)).min(1),
    }),
    execute: async ({ pmids }) => {
      const items = await pubmedFetchSummary(pmids.slice(0, 200));
      return { ok: true, items };
    },
  });

  const pubmedFetchAbstractsTool = tool({
    name: 'pubmed_fetch_abstracts',
    description: 'Fetch PubMed abstracts and journal metadata for PMIDs.',
    parameters: z.object({
      pmids: z.array(z.string().min(1)).min(1),
    }),
    execute: async ({ pmids }) => {
      const items = await pubmedFetchAbstracts(pmids.slice(0, 80));
      return { ok: true, items };
    },
  });

  const pubmedSimilarTool = tool({
    name: 'pubmed_similar_pmids',
    description: 'Find similar PubMed articles for a seed PMID.',
    parameters: z.object({
      pmid: z.string().min(1),
      retmax: z.number().min(1).max(100).optional(),
    }),
    execute: async ({ pmid, retmax }) => {
      const similar = await pubmedFindSimilar(pmid, retmax ?? 20);
      return { ok: true, pmid, similar_pmids: similar };
    },
  });

  const articleBoardListTool = tool({
    name: 'article_board_list',
    description: 'List all articles currently saved to the article board.',
    parameters: z.object({
      includeAbstracts: z.boolean().optional(),
    }),
    execute: async (input, context) => {
      const ctx = context?.context as OpenAiAgentContext | undefined;
      if (!ctx) return { ok: false, error: 'Missing project context.' };
      const project = await projectStore.getById(ctx.projectId, ctx.userId);
      if (!project) return { ok: false, error: 'Project not found.' };
      const includeAbstracts = input?.includeAbstracts ?? false;
      const articles = coerceArticles(project.pubmedArticles).map((article) => ({
        id: article.id,
        pmid: article.pmid,
        title: article.title,
        authors: article.authors,
        journal: article.journal,
        year: article.year,
        doi: article.doi,
        abstract: includeAbstracts ? article.abstract : undefined,
        url: article.url,
      }));
      return { ok: true, count: articles.length, articles };
    },
  });

  const articleBoardAddTool = tool({
    name: 'article_board_add',
    description: 'Add one or more articles to the article board.',
    parameters: z.object({
      articles: z
        .array(
          z.object({
            pmid: z.string().optional(),
            title: z.string().optional(),
            authors: z.string().optional(),
            journal: z.string().optional(),
            year: z.string().optional(),
            doi: z.string().optional(),
            abstract: z.string().optional(),
            url: z.string().optional(),
            rationale: z.string().optional(),
          })
        )
        .min(1),
    }),
    execute: async ({ articles }, context) => {
      const ctx = context?.context as OpenAiAgentContext | undefined;
      if (!ctx) return { ok: false, error: 'Missing project context.' };
      const project = await projectStore.getById(ctx.projectId, ctx.userId);
      if (!project) return { ok: false, error: 'Project not found.' };

      const normalized = articles
        .map((article) => normalizeArticleInput(article))
        .filter(Boolean) as PubmedArticle[];

      if (normalized.length === 0) {
        return { ok: false, error: 'No valid articles provided.' };
      }

      const merged = mergeArticles(coerceArticles(project.pubmedArticles), normalized);
      const updated = {
        ...project,
        pubmedArticles: merged,
        lastModified: Date.now(),
      };
      await projectStore.save(updated, ctx.userId);
      return { ok: true, added: normalized.length, total: merged.length };
    },
  });

  const articleBoardRemoveTool = tool({
    name: 'article_board_remove',
    description: 'Remove articles from the article board by PMID, id, or title snippet.',
    parameters: z.object({
      pmids: z.array(z.string()).optional(),
      ids: z.array(z.string()).optional(),
      title_contains: z.array(z.string()).optional(),
      reason: z.string().optional(),
    }),
    execute: async ({ pmids, ids, title_contains }, context) => {
      const ctx = context?.context as OpenAiAgentContext | undefined;
      if (!ctx) return { ok: false, error: 'Missing project context.' };
      const project = await projectStore.getById(ctx.projectId, ctx.userId);
      if (!project) return { ok: false, error: 'Project not found.' };

      const pmidSet = new Set((pmids || []).map((v) => v.trim()).filter(Boolean));
      const idSet = new Set((ids || []).map((v) => v.trim()).filter(Boolean));
      const snippets = (title_contains || []).map((v) => v.trim().toLowerCase()).filter(Boolean);

      const nextArticles = coerceArticles(project.pubmedArticles).filter((article) => {
        const key = article.pmid || article.id;
        if (!key) return false;
        if (idSet.has(key) || (article.pmid && pmidSet.has(article.pmid))) return false;
        if (snippets.length > 0) {
          const title = article.title.toLowerCase();
          if (snippets.some((snippet) => title.includes(snippet))) return false;
        }
        return true;
      });

      const updated = {
        ...project,
        pubmedArticles: nextArticles,
        lastModified: Date.now(),
      };
      await projectStore.save(updated, ctx.userId);
      return { ok: true, removed: coerceArticles(project.pubmedArticles).length - nextArticles.length };
    },
  });

  const documentCreateTool = tool({
    name: 'document_create',
    description: 'Create a downloadable document from markdown.',
    parameters: z.object({
      markdown: z.string().min(1),
      filename: z.string().optional(),
      format: z.enum(['md', 'txt']).optional(),
    }),
    execute: async ({ markdown, filename, format }, context) => {
      const ctx = context?.context as OpenAiAgentContext | undefined;
      if (!ctx) return { ok: false, error: 'Missing project context.' };
      const safeFormat = format || 'md';
      const safeName = filename?.trim() || `manuscript-${new Date().toISOString().slice(0, 10)}`;
      const nameWithExt = safeName.endsWith(`.${safeFormat}`) ? safeName : `${safeName}.${safeFormat}`;
      const id = generateId();
      await chatkitDocumentStore.create({
        id,
        userId: ctx.userId,
        projectId: ctx.projectId,
        filename: nameWithExt,
        format: safeFormat,
        createdAt: Date.now(),
        content: markdown,
      });
      return {
        ok: true,
        filename: nameWithExt,
        download_url: `/api/chatkit/documents/${id}`,
      };
    },
  });

  return [
    pubmedSearchTool,
    pubmedFetchTitlesTool,
    pubmedFetchAbstractsTool,
    pubmedSimilarTool,
    articleBoardListTool,
    articleBoardAddTool,
    articleBoardRemoveTool,
    documentCreateTool,
  ];
};

export const runOpenAiChatkitAgent = async ({
  input,
  context,
  project,
}: {
  input: AgentInputItem[];
  context: OpenAiAgentContext;
  project: Project;
}): Promise<string> => {
  ensureOpenAIKey();

  const agent = new Agent<OpenAiAgentContext>({
    name: 'Reference Assistant',
    instructions: buildInstructions(project),
    tools: buildTools(),
    model: process.env.MANUSCRIPTAI_OPENAI_MODEL || process.env.OPENAI_DEFAULT_MODEL || MODEL_FALLBACK,
    modelSettings: {
      temperature: 0.2,
    },
  });

  const result = await run(agent, input, { context });
  const finalOutput = result.finalOutput;
  if (typeof finalOutput === 'string' && finalOutput.trim()) {
    return finalOutput;
  }
  const fallback = extractAllTextOutput(result.newItems || []);
  return fallback || 'I ran the PubMed tools but did not receive a response. Please try again.';
};

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { runPubmedAgent, type PubmedAgentMessage, type PubmedToolLogEntry } from '@/lib/pubmed/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGES = 16;

type AgentBody = {
  messages?: Array<{ role?: string; content?: string }>;
  articles?: Array<{ pmid?: string; title?: string }>;
};

const coerceMessages = (raw: AgentBody['messages']): PubmedAgentMessage[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((msg) => {
      const role = msg?.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof msg?.content === 'string' ? msg.content.trim() : '';
      return content ? { role, content } : null;
    })
    .filter(Boolean) as PubmedAgentMessage[];
};

const coerceArticles = (raw: AgentBody['articles']) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((article) => ({
      pmid: typeof article?.pmid === 'string' ? article.pmid : undefined,
      title: typeof article?.title === 'string' ? article.title : undefined,
    }))
    .filter((article) => article.pmid || article.title);
};

const summarizeToolLogEntry = (entry: PubmedToolLogEntry) => {
  if (entry.name === 'pubmed_search_pmids_generated_tool') {
    const count = typeof entry.result?.count === 'number' ? entry.result.count : undefined;
    const query = typeof entry.result?.query === 'string' ? entry.result.query : undefined;
    return `PubMed search${count !== undefined ? ` (${count} hits)` : ''}${query ? `: ${query}` : ''}`;
  }
  if (entry.name === 'pubmed_fetch_titles_tool') {
    const count = Array.isArray(entry.result?.items) ? entry.result.items.length : undefined;
    return `Fetched titles${count !== undefined ? ` (${count})` : ''}`;
  }
  if (entry.name === 'pubmed_fetch_abstracts_tool') {
    const count = Array.isArray(entry.result?.items) ? entry.result.items.length : undefined;
    return `Fetched abstracts${count !== undefined ? ` (${count})` : ''}`;
  }
  if (entry.name === 'pubmed_similar_pmids_tool') {
    const count = Array.isArray(entry.result?.similar_pmids) ? entry.result.similar_pmids.length : undefined;
    return `Found related articles${count !== undefined ? ` (${count})` : ''}`;
  }
  if (entry.name === 'pubmed_remove_articles_tool') {
    const count = Array.isArray(entry.result?.removed) ? entry.result.removed.length : undefined;
    return `Removed articles${count !== undefined ? ` (${count})` : ''}`;
  }
  return entry.name;
};

const summarizeToolLog = (toolLog: PubmedToolLogEntry[]) => toolLog.map(summarizeToolLogEntry);

const summarizeThoughtForTool = (entry: PubmedToolLogEntry) => {
  if (entry.name === 'pubmed_search_pmids_generated_tool') {
    return 'Drafting a targeted PubMed search query.';
  }
  if (entry.name === 'pubmed_fetch_titles_tool') {
    return 'Pulling citation titles to shortlist relevant articles.';
  }
  if (entry.name === 'pubmed_fetch_abstracts_tool') {
    return 'Reviewing abstracts to confirm relevance.';
  }
  if (entry.name === 'pubmed_similar_pmids_tool') {
    return 'Exploring related articles from the closest matches.';
  }
  if (entry.name === 'pubmed_remove_articles_tool') {
    return 'Updating the article board with your removals.';
  }
  return 'Reviewing tool results.';
};

type PubmedAgentStreamEvent =
  | { type: 'thought'; summary: string }
  | { type: 'tool'; summary: string }
  | {
      type: 'final';
      reply: string;
      model: string;
      added: unknown;
      removed: unknown;
      toolSummary: string[];
    }
  | { type: 'error'; error: string };

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as AgentBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const messages = coerceMessages(body.messages);
    if (messages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }

    const slicedMessages = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    const articles = coerceArticles(body.articles);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: PubmedAgentStreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          send({ type: 'thought', summary: 'Reviewing your request and planning PubMed searches.' });

          const result = await runPubmedAgent({
            messages: slicedMessages,
            existingArticles: articles,
            onToolLog: (entry) => {
              const toolSummary = summarizeToolLogEntry(entry);
              const thoughtSummary = summarizeThoughtForTool(entry);
              if (toolSummary) {
                send({ type: 'tool', summary: toolSummary });
              }
              if (thoughtSummary) {
                send({ type: 'thought', summary: thoughtSummary });
              }
            },
          });

          send({
            type: 'final',
            reply: result.reply,
            model: result.model,
            added: result.added,
            removed: result.removed,
            toolSummary: summarizeToolLog(result.toolLog),
          });
        } catch (error) {
          const rawMessage = error instanceof Error ? error.message : 'PubMed agent failed';
          const message = rawMessage.length > 800 ? `${rawMessage.slice(0, 800)}…` : rawMessage;
          send({ type: 'error', error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('PubMed agent error', error);
    const rawMessage = error instanceof Error ? error.message : 'PubMed agent failed';
    const message = rawMessage.length > 800 ? `${rawMessage.slice(0, 800)}…` : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

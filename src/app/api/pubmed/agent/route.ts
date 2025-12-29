import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { runPubmedAgentStream, type PubmedAgentMessage, type PubmedAgentStreamEvent } from '@/lib/pubmed/agent';

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

const toNdjsonLine = (event: PubmedAgentStreamEvent) => `${JSON.stringify(event)}\n`;

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
        const emit = (event: PubmedAgentStreamEvent) => {
          controller.enqueue(encoder.encode(toNdjsonLine(event)));
        };

        try {
          await runPubmedAgentStream({
            messages: slicedMessages,
            existingArticles: articles,
            emit,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'PubMed agent failed';
          emit({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('PubMed agent error', error);
    const rawMessage = error instanceof Error ? error.message : 'PubMed agent failed';
    const message = rawMessage.length > 800 ? `${rawMessage.slice(0, 800)}…` : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

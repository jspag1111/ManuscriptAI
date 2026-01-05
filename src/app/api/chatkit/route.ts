import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import type { AgentInputItem } from '@openai/agents';
import { chatkitStore, projectStore } from '@/lib/db';
import { runOpenAiChatkitAgent } from '@/lib/chatkit/openaiAgent';
import { generateId } from '@/lib/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const now = () => Date.now();
const toIso = (timestamp: number) => new Date(timestamp).toISOString();

const coerceString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const coerceNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const coerceArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toPage = <T,>(items: T[]) => ({
  data: items,
  has_more: false,
  after: null,
});

const extractTextFromContent = (content: any[]) =>
  content
    .map((part) => {
      if (part?.type === 'input_text' || part?.type === 'output_text') {
        return typeof part.text === 'string' ? part.text : '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

const buildThreadMetadata = ({
  id,
  title,
  userId,
  createdAt,
  updatedAt,
  lastItemAt,
  metadata,
}: {
  id: string;
  title: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastItemAt: number;
  metadata?: Record<string, unknown> | null;
}) => ({
  id,
  title,
  user_id: userId,
  created_at: toIso(createdAt),
  updated_at: toIso(updatedAt),
  last_item_at: toIso(lastItemAt),
  status: { type: 'active' },
  metadata: metadata ?? {},
});

const buildUserMessageItem = ({
  threadId,
  input,
  createdAt,
}: {
  threadId: string;
  input: Record<string, unknown>;
  createdAt: number;
}) => {
  const content = coerceArray<Record<string, unknown>>(input.content);
  const text = extractTextFromContent(content);
  const resolvedContent = content.length > 0 ? content : text ? [{ type: 'input_text', text }] : [];

  return {
    id: generateId(),
    thread_id: threadId,
    type: 'user_message',
    status: 'completed',
    created_at: toIso(createdAt),
    updated_at: toIso(createdAt),
    metadata: (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
    content: resolvedContent,
    attachments: coerceArray(input.attachments),
    inference_options: (input.inference_options && typeof input.inference_options === 'object') ? input.inference_options : {},
  };
};

const buildAssistantMessageItem = ({
  threadId,
  contentText,
  createdAt,
  status,
}: {
  threadId: string;
  contentText: string;
  createdAt: number;
  status: 'in_progress' | 'completed' | 'failed';
}) => ({
  id: generateId(),
  thread_id: threadId,
  type: 'assistant_message',
  status,
  created_at: toIso(createdAt),
  updated_at: toIso(createdAt),
  metadata: {},
  content: contentText ? [{ type: 'output_text', text: contentText }] : [],
});

const toEvent = (payload: Record<string, unknown>) => ({
  event_id: generateId(),
  ...payload,
});

const toSse = (event: Record<string, unknown>) => `data: ${JSON.stringify(event)}\n\n`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = request.headers.get('x-project-id');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing project id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const type = coerceString(body.type);
    const params = (body.params && typeof body.params === 'object') ? (body.params as Record<string, unknown>) : {};
    const requestId = coerceString(body.request_id);

    if (!type) {
      return NextResponse.json({ error: 'Missing request type' }, { status: 400 });
    }

    if (type === 'threads.list') {
      const limit = coerceNumber(params.limit);
      const order = params.order === 'asc' ? 'asc' : 'desc';
      const threads = await chatkitStore.listThreads({
        userId,
        projectId,
        limit: typeof limit === 'number' ? Math.min(Math.max(limit, 1), 50) : undefined,
        order,
      });
      const response = threads.map((thread) => thread.data);
      return NextResponse.json({ type, request_id: requestId, response: toPage(response) });
    }

    if (type === 'threads.get_by_id') {
      const threadId = coerceString(params.thread_id);
      if (!threadId) {
        return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
      }

      const thread = await chatkitStore.getThread(threadId, userId);
      if (!thread || thread.projectId !== projectId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const items = await chatkitStore.listItems({ threadId, userId, order: 'asc' });
      const response = {
        metadata: thread.data,
        items: toPage(items.map((item) => item.data)),
      };
      return NextResponse.json({ type, request_id: requestId, response });
    }

    if (type === 'items.list') {
      const threadId = coerceString(params.thread_id);
      if (!threadId) {
        return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
      }
      const order = params.order === 'asc' ? 'asc' : 'desc';
      const limit = coerceNumber(params.limit);
      const items = await chatkitStore.listItems({
        threadId,
        userId,
        order,
        limit: typeof limit === 'number' ? Math.min(Math.max(limit, 1), 200) : undefined,
      });
      return NextResponse.json({ type, request_id: requestId, response: toPage(items.map((item) => item.data)) });
    }

    if (type === 'threads.update') {
      const threadId = coerceString(params.thread_id);
      if (!threadId) {
        return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
      }
      const existing = await chatkitStore.getThread(threadId, userId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      const title = coerceString(params.title) || existing.title;
      const metadata = (params.metadata && typeof params.metadata === 'object')
        ? (params.metadata as Record<string, unknown>)
        : (existing.data.metadata as Record<string, unknown> | undefined);
      const updatedAt = now();
      const updated = buildThreadMetadata({
        id: existing.id,
        title,
        userId,
        createdAt: existing.createdAt,
        updatedAt,
        lastItemAt: existing.lastItemAt,
        metadata,
      });

      await chatkitStore.saveThread({
        ...existing,
        title,
        updatedAt,
        data: updated,
      });

      return NextResponse.json({ type, request_id: requestId, response: updated });
    }

    if (type === 'threads.delete') {
      const threadId = coerceString(params.thread_id);
      if (!threadId) {
        return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
      }
      const existing = await chatkitStore.getThread(threadId, userId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      await chatkitStore.deleteThread(threadId, userId);
      return NextResponse.json({ type, request_id: requestId, response: null });
    }

    if (type === 'threads.add_feedback') {
      return NextResponse.json({ type, request_id: requestId, response: null });
    }

    if (type === 'threads.create' || type === 'threads.add_user_message') {
      const input = (params.input && typeof params.input === 'object') ? (params.input as Record<string, unknown>) : {};
      const createdAt = now();

      const project = await projectStore.getById(projectId, userId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      let threadId = coerceString(params.thread_id);
      let threadRecord = threadId ? await chatkitStore.getThread(threadId, userId) : null;

      if (type === 'threads.create') {
        const title = coerceString(params.title) || extractTextFromContent(coerceArray(input.content)) || 'Reference chat';
        threadId = generateId();
        const metadata = buildThreadMetadata({
          id: threadId,
          title,
          userId,
          createdAt,
          updatedAt: createdAt,
          lastItemAt: createdAt,
          metadata: (params.metadata && typeof params.metadata === 'object')
            ? (params.metadata as Record<string, unknown>)
            : {},
        });
        threadRecord = {
          id: threadId,
          userId,
          projectId,
          title,
          createdAt,
          updatedAt: createdAt,
          lastItemAt: createdAt,
          data: metadata,
        };
        await chatkitStore.saveThread(threadRecord);
      }

      if (!threadRecord || !threadId || threadRecord.projectId !== projectId) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }

      const userItem = buildUserMessageItem({ threadId, input, createdAt });
      await chatkitStore.saveItem({
        id: userItem.id,
        threadId,
        userId,
        createdAt,
        updatedAt: createdAt,
        data: userItem,
      });

      const historyItems = await chatkitStore.listItems({ threadId, userId, order: 'asc' });
      const agentInput = historyItems
        .map((item) => item.data)
        .map((item) => {
          if (item.type === 'user_message') {
            const text = extractTextFromContent(coerceArray(item.content));
            return text ? { role: 'user', content: text } : null;
          }
          if (item.type === 'assistant_message') {
            const text = extractTextFromContent(coerceArray(item.content));
            return text ? { role: 'assistant', content: text } : null;
          }
          return null;
        })
        .filter(Boolean) as Array<{ role: 'user' | 'assistant'; content: string }>;

      const trimmedInput = agentInput.slice(-12).map((msg) => ({ role: msg.role, content: msg.content }));
      const agentItems: AgentInputItem[] = trimmedInput.map((msg) => {
        if (msg.role === 'user') {
          return {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: msg.content }],
          };
        }
        return {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: msg.content }],
        };
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(toSse(event)));
          };

          try {
            if (type === 'threads.create') {
              emit(toEvent({ type: 'thread.created', thread: threadRecord?.data }));
            }
            emit(toEvent({ type: 'thread.item.added', item: userItem }));
            emit(toEvent({ type: 'thread.item.done', item: userItem }));

            const assistantCreatedAt = now();
            const assistantItem = buildAssistantMessageItem({
              threadId,
              contentText: '',
              createdAt: assistantCreatedAt,
              status: 'in_progress',
            });

            emit(toEvent({ type: 'thread.item.added', item: assistantItem }));

            const reply = await runOpenAiChatkitAgent({
              input: agentItems,
              context: { userId, projectId },
              project,
            });

            const completedItem = {
              ...assistantItem,
              status: 'completed',
              updated_at: toIso(now()),
              content: reply ? [{ type: 'output_text', text: reply }] : [],
            };

            await chatkitStore.saveItem({
              id: completedItem.id,
              threadId,
              userId,
              createdAt: assistantCreatedAt,
              updatedAt: now(),
              data: completedItem,
            });

            const updatedAt = now();
            const updatedThread = buildThreadMetadata({
              id: threadRecord!.id,
              title: threadRecord!.title,
              userId,
              createdAt: threadRecord!.createdAt,
              updatedAt,
              lastItemAt: updatedAt,
              metadata: threadRecord!.data.metadata as Record<string, unknown>,
            });
            await chatkitStore.saveThread({
              ...threadRecord!,
              updatedAt,
              lastItemAt: updatedAt,
              data: updatedThread,
            });

            emit(toEvent({ type: 'thread.item.done', item: completedItem }));
            emit(toEvent({ type: 'thread.updated', thread: updatedThread }));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Agent failed.';
            emit(toEvent({ type: 'thread.item.failed', error: { message } }));
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
        },
      });
    }

    if (type === 'threads.add_client_tool_output') {
      return NextResponse.json({ type, request_id: requestId, response: null });
    }

    return NextResponse.json({ error: 'Unsupported request type.' }, { status: 400 });
  } catch (error) {
    console.error('ChatKit API error', error);
    const message = error instanceof Error ? error.message : 'ChatKit request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

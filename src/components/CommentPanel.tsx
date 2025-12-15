'use client';

import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, MessageSquareText, RotateCcw, Send, X } from 'lucide-react';
import type { SectionCommentThread } from '@/types';

export type CommentPanelFilter = 'ALL' | 'OPEN' | 'RESOLVED';

const formatTimestamp = (ts: number) =>
  new Date(ts).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const displayName = (thread: SectionCommentThread, userId: string) => {
  if (thread.createdBy.userId === userId) return thread.createdBy.name?.trim() || 'You';
  return thread.createdBy.name?.trim() || 'User';
};

export const CommentPanel: React.FC<{
  threads: SectionCommentThread[];
  currentUserId: string;
  selectedThreadId: string | null;
  filter: CommentPanelFilter;
  onChangeFilter: (filter: CommentPanelFilter) => void;
  onSelectThread: (threadId: string | null) => void;
  onReply: (threadId: string, text: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onClose: () => void;
  onAddressWithAi?: (threadId: string) => void;
  aiBusy?: boolean;
}> = ({
  threads,
  currentUserId,
  selectedThreadId,
  filter,
  onChangeFilter,
  onSelectThread,
  onReply,
  onResolve,
  onReopen,
  onClose,
  onAddressWithAi,
  aiBusy = false,
}) => {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const open = (threads ?? []).filter((t) => t.status !== 'RESOLVED').length;
    const resolved = (threads ?? []).filter((t) => t.status === 'RESOLVED').length;
    return { open, resolved, total: (threads ?? []).length };
  }, [threads]);

  const filtered = useMemo(() => {
    const items = [...(threads ?? [])].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    if (filter === 'OPEN') return items.filter((t) => t.status !== 'RESOLVED');
    if (filter === 'RESOLVED') return items.filter((t) => t.status === 'RESOLVED');
    return items;
  }, [threads, filter]);

  const selected = useMemo(
    () => (selectedThreadId ? (threads ?? []).find((t) => t.id === selectedThreadId) ?? null : null),
    [threads, selectedThreadId]
  );

  return (
    <aside className="w-full lg:w-[380px] border-l border-slate-200 bg-white/95 flex flex-col">
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Comments</p>
          <p className="text-[11px] text-slate-500 truncate">
            {counts.open} open • {counts.resolved} resolved
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-200/60 transition-colors"
          title="Close comments"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {([
            { key: 'OPEN' as const, label: `Open (${counts.open})` },
            { key: 'RESOLVED' as const, label: `Resolved (${counts.resolved})` },
            { key: 'ALL' as const, label: `All (${counts.total})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChangeFilter(tab.key)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                filter === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
            <MessageSquareText size={18} className="text-slate-400" />
            No comments in this view.
          </div>
        ) : (
          filtered.map((thread) => {
            const isSelected = !!selectedThreadId && thread.id === selectedThreadId;
            const first = thread.messages?.[0];
            const title = first?.content?.trim() || 'Comment';
            const excerpt = thread.anchor?.text?.trim() || thread.excerpt?.trim() || '';
            const isResolved = thread.status === 'RESOLVED';

            return (
              <div
                key={thread.id}
                className={`rounded-xl border bg-white shadow-sm transition-colors ${
                  isSelected ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectThread(isSelected ? null : thread.id)}
                  className="w-full text-left p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isResolved
                              ? 'bg-slate-50 text-slate-600 border-slate-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isResolved ? <CheckCircle2 size={12} /> : <MessageSquareText size={12} />}
                          {isResolved ? 'Resolved' : 'Open'}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {displayName(thread, currentUserId)} • {formatTimestamp(thread.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">{title}</p>
                      {excerpt && (
                        <p className="mt-1 text-[12px] text-slate-500 line-clamp-2">
                          <span className="font-semibold text-slate-600">On:</span> “{excerpt.replace(/\s+/g, ' ')}”
                        </p>
                      )}
                      {thread.anchor?.orphaned && (
                        <p className="mt-2 text-[11px] text-amber-700">
                          Anchor moved/removed by edits — this comment may not jump to the original text.
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {isSelected && (
                  <div className="border-t border-slate-100 px-3 pb-3">
                    <div className="pt-3 space-y-3">
                      <div className="space-y-2">
                        {(thread.messages ?? []).map((msg) => {
                          const mine = msg.author.userId === currentUserId;
                          const authorLabel = mine ? 'You' : msg.author.name?.trim() || 'User';
                          return (
                            <div
                              key={msg.id}
                              className={`rounded-lg border px-3 py-2 ${mine ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] font-semibold text-slate-700 truncate">{authorLabel}</span>
                                <span className="text-[11px] text-slate-400 shrink-0">{formatTimestamp(msg.createdAt)}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-2">
                        <textarea
                          rows={2}
                          className="w-full resize-none text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
                          placeholder={isResolved ? 'Reopen to reply…' : 'Write a reply…'}
                          value={replyDrafts[thread.id] ?? ''}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          disabled={isResolved}
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isResolved ? (
                              <button
                                type="button"
                                onClick={() => onReopen(thread.id)}
                                className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                              >
                                <RotateCcw size={14} />
                                Reopen
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onResolve(thread.id)}
                                className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                              >
                                <CheckCircle2 size={14} />
                                Resolve
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={!onAddressWithAi || isResolved || aiBusy}
                              onClick={() => onAddressWithAi?.(thread.id)}
                              className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                                isResolved || aiBusy
                                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                                  : 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100'
                              }`}
                              title="Have AI propose an edit to address this comment"
                            >
                              <Bot size={14} />
                              {aiBusy ? 'Addressing…' : 'Address with AI'}
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isResolved || !(replyDrafts[thread.id] ?? '').trim()}
                            onClick={() => {
                              const text = (replyDrafts[thread.id] ?? '').trim();
                              if (!text) return;
                              onReply(thread.id, text);
                              setReplyDrafts((prev) => ({ ...prev, [thread.id]: '' }));
                            }}
                            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={14} />
                            Reply
                          </button>
                        </div>
                      </div>

                      {thread.aiEdits && thread.aiEdits.length > 0 && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <Bot size={14} className="text-blue-600" />
                          AI suggested {thread.aiEdits.length} edit{thread.aiEdits.length === 1 ? '' : 's'} for this comment.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div className="border-t border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] text-slate-600">
            Selected: <span className="font-semibold text-slate-800">{selected.messages?.[0]?.content?.trim().slice(0, 64) || 'Comment'}</span>
          </div>
        </div>
      )}
    </aside>
  );
};

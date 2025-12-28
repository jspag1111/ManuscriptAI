'use client';

import React, { useMemo, useState } from 'react';
import { Bot, CheckSquare2, MessageSquareText, Send, Square, Trash2, X } from 'lucide-react';
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
  onDeleteThread?: (threadId: string) => void;
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
  onDeleteThread,
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
            const isResolved = thread.status === 'RESOLVED';
            const canDelete = !!onDeleteThread && thread.createdBy.userId === currentUserId;

            return (
              <div
                key={thread.id}
                className={`rounded-2xl border bg-white shadow-sm transition-all ${
                  isSelected
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isResolved}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isResolved) onReopen(thread.id);
                      else onResolve(thread.id);
                    }}
                    className={`mt-0.5 rounded-md p-1 transition-colors ${
                      isResolved ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={isResolved ? 'Mark as open' : 'Mark as resolved'}
                  >
                    {isResolved ? <CheckSquare2 size={18} /> : <Square size={18} />}
                  </button>

                  <div className="flex-1 min-w-0 flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectThread(isSelected ? null : thread.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-slate-400 truncate">
                            {displayName(thread, currentUserId)} • {formatTimestamp(thread.createdAt)}
                          </span>
                          {isResolved && <span className="text-[11px] text-emerald-700 font-semibold">Resolved</span>}
                        </div>
                        <p
                          className={`mt-2 text-sm font-semibold line-clamp-2 ${
                            isResolved ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {title}
                        </p>
                        {thread.anchor?.orphaned && (
                          <p className="mt-2 text-[11px] text-amber-700">
                            Anchor moved/removed by edits — this comment may not jump to the original text.
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="shrink-0 flex items-center gap-1">
                      {onAddressWithAi && (
                        <button
                          type="button"
                          disabled={isResolved || aiBusy}
                          onClick={() => {
                            if (!isSelected) onSelectThread(thread.id);
                            onAddressWithAi(thread.id);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-blue-700 p-1.5 rounded hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          title={isResolved ? 'Reopen to address with AI' : 'Address with AI'}
                        >
                          <Bot size={16} className={aiBusy ? 'animate-pulse' : undefined} />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm('Delete this comment thread? This cannot be undone.')) return;
                            onDeleteThread?.(thread.id);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-rose-700 p-1.5 rounded hover:bg-slate-100 transition-colors"
                          title="Delete comment"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="border-t border-slate-100/80 px-3 pb-3">
                    <div className="pt-3 space-y-3">
                      <div className="space-y-2">
                        {(thread.messages ?? []).map((msg) => {
                          const mine = msg.author.userId === currentUserId;
                          const authorLabel = mine ? 'You' : msg.author.name?.trim() || 'User';
                          return (
                            <div
                              key={msg.id}
                              className={`rounded-2xl border px-4 py-3 shadow-sm ${
                                mine ? 'bg-blue-50/70 border-blue-100' : 'bg-slate-50/70 border-slate-200'
                              }`}
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

                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-2 focus-within:ring-2 focus-within:ring-slate-200/70 focus-within:border-slate-300 transition">
                        <textarea
                          rows={2}
                          className="w-full resize-none text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400 px-2 py-1"
                          placeholder={isResolved ? 'Mark as open to reply…' : 'Write a reply…'}
                          value={replyDrafts[thread.id] ?? ''}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          disabled={isResolved}
                        />
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isResolved || !(replyDrafts[thread.id] ?? '').trim()}
                            onClick={() => {
                              const text = (replyDrafts[thread.id] ?? '').trim();
                              if (!text) return;
                              onReply(thread.id, text);
                              setReplyDrafts((prev) => ({ ...prev, [thread.id]: '' }));
                            }}
                            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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

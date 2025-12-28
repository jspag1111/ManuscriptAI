'use client';

import React, { useMemo, useState } from 'react';
import { Bot, FileText, MessageSquareText, User, X } from 'lucide-react';
import type { ChangeActor, SectionChangeEvent } from '@/types';
import { colorForChangeActorKey } from '@/utils/changeColors';

const actorKey = (actor: ChangeActor) => (actor.type === 'USER' ? `user:${actor.userId}` : `llm:${actor.model}`);

const actorLabel = (actor: ChangeActor) => (actor.type === 'USER' ? actor.name?.trim() || 'You' : actor.model);

export const ChangePanel: React.FC<{
  events: SectionChangeEvent[];
  selectedEventId?: string | null;
  onSelectEvent?: (event: SectionChangeEvent) => void;
}> = ({ events, selectedEventId = null, onSelectEvent }) => {
  const rows = useMemo(() => events ?? [], [events]);
  const [requestModalEvent, setRequestModalEvent] = useState<SectionChangeEvent | null>(null);

  return (
    <aside className="w-full lg:w-80 border-l border-slate-200 bg-white/95 flex flex-col">
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
        <div>
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Edits</p>
          <p className="text-[11px] text-slate-500">{rows.length} change group{rows.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No tracked edits yet for this version. Make an edit, then toggle highlights to see attribution.
          </div>
        ) : (
          rows.map((event) => {
            const key = actorKey(event.actor);
            const color = colorForChangeActorKey(key);
            const label = actorLabel(event.actor);
            const ts = new Date(event.timestamp);
            const range = event.selection ? `${event.selection.from}–${event.selection.to}` : null;
            const ops = Array.isArray(event.steps) ? event.steps.length : 0;
            const icon = event.actor.type === 'LLM' ? <Bot size={14} /> : <User size={14} />;
            const isSelected = !!selectedEventId && event.id === selectedEventId;
            const hasRequest = event.actor.type === 'LLM' && typeof event.request === 'string' && event.request.trim().length > 0;
            const requestPreview = hasRequest ? (event.request as string).trim().replace(/\s+/g, ' ').slice(0, 80) : '';
            const hasCommentLink = typeof event.commentId === 'string' && event.commentId.trim().length > 0;

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent?.(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectEvent?.(event);
                  }
                }}
                role={onSelectEvent ? 'button' : undefined}
                tabIndex={onSelectEvent ? 0 : undefined}
                className={`w-full text-left rounded-xl border bg-white shadow-sm p-3 transition-colors ${
                  isSelected ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-300'
                } ${onSelectEvent ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2">
                    <span
                      className="mt-0.5 h-5 w-5 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0"
                      style={{ background: color.bgSoft }}
                      title={key}
                    >
                      <span className="text-slate-700">{icon}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-800 truncate" title={label}>
                          {label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: color.border }} />
                          {event.actor.type === 'LLM' ? 'LLM edit' : 'User edit'}
                        </span>
                        <span>{ops} step{ops === 1 ? '' : 's'}</span>
                        {range && <span>pos {range}</span>}
                        {hasCommentLink && (
                          <span className="inline-flex items-center gap-1 text-amber-700" title={`Linked to comment ${event.commentId}`}>
                            <MessageSquareText size={12} />
                            Comment
                          </span>
                        )}
                      </div>
                      {hasRequest && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 truncate" title={event.request as string}>
                            Request: {requestPreview}
                            {requestPreview.length >= 80 ? '…' : ''}
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestModalEvent(event);
                            }}
                            title="View the request/prompt used for this LLM edit"
                          >
                            <FileText size={12} />
                            View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {requestModalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4"
          onClick={() => setRequestModalEvent(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200 flex justify-between items-start gap-3 bg-slate-50 rounded-t-lg">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 text-sm truncate">LLM request</h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {actorLabel(requestModalEvent.actor)} • {new Date(requestModalEvent.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">
                {(requestModalEvent.request || '').trim()}
              </pre>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

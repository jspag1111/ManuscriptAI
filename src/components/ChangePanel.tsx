'use client';

import React, { useMemo } from 'react';
import { Bot, User } from 'lucide-react';
import type { ChangeActor, SectionChangeEvent } from '@/types';
import { colorForChangeActorKey } from '@/utils/changeColors';

const actorKey = (actor: ChangeActor) => (actor.type === 'USER' ? `user:${actor.userId}` : `llm:${actor.model}`);

const actorLabel = (actor: ChangeActor) => (actor.type === 'USER' ? actor.name?.trim() || 'You' : actor.model);

export const ChangePanel: React.FC<{ events: SectionChangeEvent[] }> = ({ events }) => {
  const rows = useMemo(() => events ?? [], [events]);

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

            return (
              <div
                key={event.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 hover:border-slate-300 transition-colors"
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};


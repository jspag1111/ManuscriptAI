'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { Button } from './Button';
import { ChangePanel } from './ChangePanel';
import { ProseMirrorEditor, ProseMirrorEditorHandle } from './ProseMirrorEditor';
import type { ChangeActor, SectionChangeEvent } from '@/types';
import type { Reference } from '@/types';

export const AiReviewOverlay: React.FC<{
  baseContent: string;
  previewContent: string;
  event: SectionChangeEvent;
  bibliographyOrder: string[];
  references: Reference[];
  title?: string;
  onAccept: () => void;
  onDiscard: () => void;
}> = ({
  baseContent,
  previewContent,
  event,
  bibliographyOrder,
  references,
  title = 'Review AI changes',
  onAccept,
  onDiscard,
}) => {
  const actor: ChangeActor =
    event.actor.type === 'LLM'
      ? { type: 'LLM', model: event.actor.model }
      : { type: 'USER', userId: event.actor.userId, name: event.actor.name };
  const editorRef = useRef<ProseMirrorEditorHandle>(null);
  const [focusedChangeEventId, setFocusedChangeEventId] = useState<string | null>(null);
  const handleSelectChangeEvent = useCallback((evt: SectionChangeEvent) => {
    const selection = evt.selection ?? null;
    setFocusedChangeEventId((current) => {
      const next = current === evt.id ? null : evt.id;
      editorRef.current?.focusChangeEvent(next, next ? selection : null);
      return next;
    });
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-white flex flex-col">
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <p className="text-[11px] text-slate-500">
              {event.actor.type === 'LLM' ? `Model: ${event.actor.model}` : 'User edit'} •{' '}
              {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onDiscard}>
            <X size={16} className="mr-2" />
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            <Check size={16} className="mr-2" />
            Apply
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-h-0">
          <ProseMirrorEditor
            ref={editorRef}
            content={previewContent}
            bibliographyOrder={bibliographyOrder}
            references={references}
            onChange={() => {}}
            placeholder=""
            renderCitations
            readOnly
            trackChanges={{
              baseContent,
              events: [event],
              actor,
              showHighlights: true,
              onEventsChange: () => {},
            }}
          />
        </div>
        <div className="hidden lg:flex">
          <ChangePanel events={[event]} selectedEventId={focusedChangeEventId} onSelectEvent={handleSelectChangeEvent} />
        </div>
      </div>
    </div>
  );
};

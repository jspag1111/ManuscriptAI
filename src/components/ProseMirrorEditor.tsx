'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorState, type Transaction } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { EditorView, type NodeView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { manuscriptSchema } from '@/lib/prosemirror/schema';
import { contentToProseMirrorDoc, proseMirrorDocToContent } from '@/lib/prosemirror/serialization';
import { placeholderPlugin } from '@/lib/prosemirror/plugins/placeholder';
import { selectionLockPlugin, selectionLockPluginKey } from '@/lib/prosemirror/plugins/selectionLock';
import { trackChangesPlugin, trackChangesPluginKey, type TrackChangeData } from '@/lib/prosemirror/plugins/trackChanges';
import { formatCitationRanges } from '@/utils/citationUtils';
import type { Reference } from '@/types';
import type { ChangeActor, SectionChangeEvent } from '@/types';
import { generateId } from '@/lib/projects';

export interface ProseMirrorEditorHandle {
  insertAtCursor: (text: string) => void;
  insertCitation: (ids: string[]) => void;
  lockSelection: () => string | null;
  replaceLockedSelection: (text: string) => string;
  clearLock: () => void;
  setContent: (content: string) => void;
  getContent: () => string;
  applyContentReplacement: (
    nextContent: string,
    actor: ChangeActor,
    event?: Pick<SectionChangeEvent, 'id' | 'timestamp' | 'selection'>
  ) => void;
  applyLockedSelectionReplacement: (
    text: string,
    actor: ChangeActor,
    event?: Pick<SectionChangeEvent, 'id' | 'timestamp' | 'selection'>
  ) => void;
}

interface ProseMirrorEditorProps {
  content: string;
  bibliographyOrder: string[];
  references: Reference[];
  onChange: (newContent: string) => void;
  onSelect?: (range: { start: number; end: number } | null, text: string) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  placeholder?: string;
  className?: string;
  renderCitations?: boolean;
  readOnly?: boolean;
  trackChanges?: {
    baseContent: string;
    events: SectionChangeEvent[];
    actor: ChangeActor;
    showHighlights: boolean;
    onEventsChange: (next: SectionChangeEvent[]) => void;
  };
}

const createCitationNodeView = (
  configRef: {
    current: {
      bibliographyOrder: string[];
      renderCitations: boolean;
      references: Reference[];
    };
  }
): ((node: any, view: EditorView, getPos: () => number) => NodeView) => {
  return (node) => {
    const dom = document.createElement('span');
    dom.className = 'pm-citation';
    dom.contentEditable = 'false';
    dom.dataset.ids = Array.isArray(node.attrs.ids) ? node.attrs.ids.join(',') : '';

    const resolveLabel = () => {
      const bibliographyOrder = configRef.current.bibliographyOrder;
      const ids = Array.isArray(node.attrs.ids) ? (node.attrs.ids as string[]) : [];
      const numbers = ids.map((id) => bibliographyOrder.indexOf(id) + 1).filter((n) => n > 0);
      const unique = Array.from(new Set(numbers));
      return unique.length ? formatCitationRanges(unique) : '[?]';
    };

    const render = () => {
      const { renderCitations, references } = configRef.current;
      dom.innerHTML = '';
      const content = document.createElement('span');
      if (renderCitations) {
        content.textContent = resolveLabel();
        dom.className =
          'pm-citation inline-flex items-center justify-center bg-blue-100 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 mx-0.5 text-sm font-bold select-none cursor-pointer hover:bg-blue-200 align-middle transition-colors';
        dom.title = (Array.isArray(node.attrs.ids) ? node.attrs.ids : [])
          .map((id: string) => references.find((r) => r.id === id)?.title || id)
          .join('\n');
      } else {
        const ids = Array.isArray(node.attrs.ids) ? (node.attrs.ids as string[]) : [];
        content.textContent = ids.map((id) => `[[ref:${id}]]`).join(' ');
        dom.className =
          'pm-citation font-mono text-[13px] px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 select-none';
        dom.title = 'Citation markers (raw)';
      }
      dom.appendChild(content);
    };

    render();

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type !== node.type) return false;
        node = updatedNode;
        dom.dataset.ids = Array.isArray(node.attrs.ids) ? node.attrs.ids.join(',') : '';
        render();
        return true;
      },
      ignoreMutation() {
        return true;
      },
    };
  };
};

const changeActorKey = (actor: ChangeActor): string =>
  actor.type === 'USER' ? `user:${actor.userId}` : `llm:${actor.model}`;

const changeActorLabel = (actor: ChangeActor): string =>
  actor.type === 'USER' ? actor.name?.trim() || 'You' : actor.model;

const eventToTrackData = (event: SectionChangeEvent): TrackChangeData => ({
  eventId: event.id,
  actorKey: changeActorKey(event.actor),
  actorLabel: changeActorLabel(event.actor),
  actorType: event.actor.type,
  timestamp: event.timestamp,
});

type ChangeEventOverride = {
  id?: string;
  timestamp?: number;
  selection?: SectionChangeEvent['selection'];
};

export const ProseMirrorEditor = forwardRef<ProseMirrorEditorHandle, ProseMirrorEditorProps>(
  (
    {
      content,
      bibliographyOrder,
      references,
      onChange,
      onSelect,
      onMouseUp,
      placeholder,
      className,
      renderCitations = true,
      readOnly = false,
      trackChanges,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const lastSerializedRef = useRef<string>(content ?? '');
    const isInternalUpdate = useRef(false);
    const eventsRef = useRef<SectionChangeEvent[]>(trackChanges?.events ?? []);
    const initialTrackChangesRef = useRef(trackChanges);
    const citationConfigRef = useRef({
      bibliographyOrder,
      renderCitations,
      references,
    });
    const callbacksRef = useRef({
      content,
      onChange,
      onSelect,
      onMouseUp,
      trackChanges,
    });

    const initialShowHighlightsRef = useRef(initialTrackChangesRef.current?.showHighlights ?? false);

    const plugins = useMemo(() => {
      const base = [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(baseKeymap),
        placeholderPlugin(placeholder || ''),
        selectionLockPlugin(),
      ];

      const initialTrackChanges = initialTrackChangesRef.current;
      if (!initialTrackChanges) return base;

      const baseDoc = contentToProseMirrorDoc(manuscriptSchema, initialTrackChanges.baseContent ?? '');
      const initialEvents = (initialTrackChanges.events || []).map((event) => ({
        steps: event.steps,
        data: eventToTrackData(event),
      }));

      return [
        ...base,
        trackChangesPlugin({
          schema: manuscriptSchema,
          baseDoc,
          initialEvents,
          showHighlights: initialShowHighlightsRef.current,
        }),
      ];
    }, [placeholder]);

    const nodeViews = useMemo(() => {
      // Force a redraw when citation-rendering inputs change (labels/titles + raw/formatted toggle).
      void bibliographyOrder;
      void renderCitations;
      void references;
      return {
        citation: createCitationNodeView(citationConfigRef),
      };
    }, [bibliographyOrder, renderCitations, references]);

    const emitSelection = (state: EditorState) => {
      const handler = callbacksRef.current.onSelect;
      if (!handler) return;
      const { from, to, empty } = state.selection;
      if (empty) {
        handler(null, '');
        return;
      }
      const text = state.doc.textBetween(from, to, '\n', (node) => {
        if (node.type.name === 'citation') {
          const ids = Array.isArray((node as any).attrs?.ids)
            ? ((node as any).attrs.ids as string[]).map((id) => String(id)).filter(Boolean)
            : [];
          return ids.map((id) => `[[ref:${id}]]`).join(' ');
        }
        if (node.type.name === 'hard_break') {
          return '\n';
        }
        return '';
      });
      handler({ start: from, end: to }, text);
    };

    const dispatchTransaction = (tr: Transaction) => {
      const view = viewRef.current;
      if (!view) return;

      const tracking = callbacksRef.current.trackChanges;
      if (tr.docChanged && tracking) {
        const now = Date.now();
        const overrideEvent = tr.getMeta('manuscriptChangeEvent') as ChangeEventOverride | undefined;
        const actorOverride = tr.getMeta('manuscriptActor') as ChangeActor | undefined;
        const actor = actorOverride ?? tracking.actor;

        const existing = eventsRef.current || [];
        const last = existing[0];
        const allowMerge = !overrideEvent?.id;
        const shouldMerge =
          allowMerge &&
          !!last &&
          changeActorKey(last.actor) === changeActorKey(actor) &&
          now - last.timestamp < 2000;

        const eventId = overrideEvent?.id ? overrideEvent.id : shouldMerge ? last.id : generateId();
        const eventTimestamp =
          typeof overrideEvent?.timestamp === 'number' && Number.isFinite(overrideEvent.timestamp)
            ? overrideEvent.timestamp
            : now;
        const nextEvent: SectionChangeEvent = {
          id: eventId,
          timestamp: eventTimestamp,
          actor,
          selection:
            overrideEvent?.selection !== undefined
              ? overrideEvent.selection
              : tr.selection?.from !== undefined
                ? { from: tr.selection.from, to: tr.selection.to }
                : null,
          steps: tr.steps.map((step) => step.toJSON()),
        };

        const nextEvents = shouldMerge
          ? [
              {
                ...last,
                timestamp: now,
                steps: [...(Array.isArray(last.steps) ? last.steps : []), ...nextEvent.steps],
                selection: nextEvent.selection ?? last.selection ?? null,
              },
              ...existing.slice(1),
            ]
          : [nextEvent, ...existing];

        // Ensure the ProseMirror plugin sees the right attribution for this transaction.
        const data: TrackChangeData = {
          eventId,
          actorKey: changeActorKey(actor),
          actorLabel: changeActorLabel(actor),
          actorType: actor.type,
          timestamp: eventTimestamp,
        };
        tr.setMeta(trackChangesPluginKey, { type: 'add', data });
        eventsRef.current = nextEvents;
        tracking.onEventsChange(nextEvents);
      }

      const nextState = view.state.apply(tr);
      view.updateState(nextState);

      emitSelection(nextState);

      if (tr.docChanged) {
        isInternalUpdate.current = true;
        const serialized = proseMirrorDocToContent(nextState.doc);
        const previous = lastSerializedRef.current;
        lastSerializedRef.current = serialized;
        if (serialized !== previous) {
          callbacksRef.current.onChange(serialized);
        }
        isInternalUpdate.current = false;
      }
    };

    useEffect(() => {
      callbacksRef.current = { content, onChange, onSelect, onMouseUp, trackChanges };
    }, [content, onChange, onMouseUp, onSelect, trackChanges]);

    useEffect(() => {
      citationConfigRef.current = { bibliographyOrder, renderCitations, references };
    }, [bibliographyOrder, renderCitations, references]);

    useEffect(() => {
      eventsRef.current = trackChanges?.events ?? [];
    }, [trackChanges, trackChanges?.events]);

    useEffect(() => {
      if (!mountRef.current) return;
      const startDoc = contentToProseMirrorDoc(manuscriptSchema, content ?? '');
      lastSerializedRef.current = proseMirrorDocToContent(startDoc);

      const state = EditorState.create({
        schema: manuscriptSchema,
        doc: startDoc,
        plugins,
      });

      const view = new EditorView(mountRef.current, {
        state,
        dispatchTransaction,
        nodeViews,
        attributes: {
          class:
            `ProseMirror w-full h-full p-8 outline-none font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap ${className || ''}`.trim(),
          'data-readonly': readOnly ? 'true' : 'false',
        },
        editable: () => !readOnly,
        handleDOMEvents: {
          mouseup: (_view, event) => {
            const handler = callbacksRef.current.onMouseUp;
            if (handler) handler(event as unknown as React.MouseEvent);
            return false;
          },
        },
      });
      viewRef.current = view;

      emitSelection(view.state);

      return () => {
        viewRef.current?.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.setProps({ nodeViews });
      view.updateState(view.state);
    }, [nodeViews]);

    useEffect(() => {
      if (!trackChanges) return;
      const view = viewRef.current;
      if (!view) return;
      const state = trackChangesPluginKey.getState(view.state);
      if (!state) return;
      if (state.showHighlights === trackChanges.showHighlights) return;
      view.dispatch(
        view.state.tr.setMeta(trackChangesPluginKey, {
          type: 'toggle',
          showHighlights: trackChanges.showHighlights,
        })
      );
    }, [trackChanges, trackChanges?.showHighlights]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const incoming = content ?? '';
      if (isInternalUpdate.current) return;
      if (incoming === lastSerializedRef.current) return;

      const nextDoc = contentToProseMirrorDoc(manuscriptSchema, incoming);
      const nextState = EditorState.create({
        schema: manuscriptSchema,
        doc: nextDoc,
        plugins,
      });
      view.updateState(nextState);
      lastSerializedRef.current = incoming;
      emitSelection(nextState);
    }, [content, plugins]);

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor: (text: string) => {
          const view = viewRef.current;
          if (!view || readOnly) return;
          view.focus();
          view.dispatch(view.state.tr.insertText(text));
        },
        insertCitation: (ids: string[]) => {
          const view = viewRef.current;
          if (!view || readOnly) return;
          const safeIds = Array.isArray(ids) ? ids.map((id) => String(id)).filter(Boolean) : [];
          if (safeIds.length === 0) return;
          const { state } = view;
          const { from, to, empty, $from } = state.selection;

          const mergeCitationNode = (existingNode: any, replaceFrom: number, replaceTo: number) => {
            const existingIds = Array.isArray(existingNode?.attrs?.ids)
              ? (existingNode.attrs.ids as string[]).map((id) => String(id)).filter(Boolean)
              : [];
            const merged = Array.from(new Set([...existingIds, ...safeIds]));
            return manuscriptSchema.nodes.citation.create({ ids: merged });
          };

          let tr = state.tr;

          // If inserting next to an existing citation, merge into it to keep
          // the inline rendering compact (e.g. [1-3] instead of [1][2][3]).
          if (empty) {
            const before = $from.nodeBefore;
            if (before?.type?.name === 'citation') {
              const replaceFrom = from - before.nodeSize;
              const replaceTo = from;
              const mergedNode = mergeCitationNode(before, replaceFrom, replaceTo);
              tr = tr.replaceWith(replaceFrom, replaceTo, mergedNode);
              view.focus();
              view.dispatch(tr);
              return;
            }

            const after = $from.nodeAfter;
            if (after?.type?.name === 'citation') {
              const replaceFrom = from;
              const replaceTo = from + after.nodeSize;
              const mergedNode = mergeCitationNode(after, replaceFrom, replaceTo);
              tr = tr.replaceWith(replaceFrom, replaceTo, mergedNode);
              view.focus();
              view.dispatch(tr);
              return;
            }
          }

          const node = manuscriptSchema.nodes.citation.create({ ids: safeIds });
          tr = tr.replaceWith(from, to, node);
          view.focus();
          view.dispatch(tr);
        },
        lockSelection: () => {
          const view = viewRef.current;
          if (!view) return null;
          const { from, to, empty } = view.state.selection;
          if (empty) return null;
          const text = view.state.doc.textBetween(from, to, '\n', (node) => {
            if (node.type.name === 'citation') {
              const ids = Array.isArray((node as any).attrs?.ids)
                ? ((node as any).attrs.ids as string[]).map((id) => String(id)).filter(Boolean)
                : [];
              return ids.map((id) => `[[ref:${id}]]`).join(' ');
            }
            if (node.type.name === 'hard_break') return '\n';
            return '';
          });
          view.dispatch(view.state.tr.setMeta(selectionLockPluginKey, { type: 'set', from, to }));
          return text;
        },
        replaceLockedSelection: (text: string) => {
          const view = viewRef.current;
          if (!view) return content ?? '';
          const lock = selectionLockPluginKey.getState(view.state);
          const from = lock?.from ?? view.state.selection.from;
          const to = lock?.to ?? view.state.selection.to;

          // IMPORTANT: This returns the *proposed* content string without mutating the editor.
          // SectionEditor uses this during AI review flows and only applies updates on accept.
          const replacementDoc = contentToProseMirrorDoc(manuscriptSchema, text ?? '');
          const slice = Slice.maxOpen(replacementDoc.content);
          const tr = view.state.tr.replaceRange(from, to, slice);
          const nextState = view.state.apply(tr);
          const proposed = proseMirrorDocToContent(nextState.doc);

          // Clear the lock highlight in the live editor (no doc changes).
          view.dispatch(view.state.tr.setMeta(selectionLockPluginKey, { type: 'clear' }));

          return proposed;
        },
        clearLock: () => {
          const view = viewRef.current;
          if (!view) return;
          view.dispatch(view.state.tr.setMeta(selectionLockPluginKey, { type: 'clear' }));
        },
        setContent: (nextContent: string) => {
          const view = viewRef.current;
          if (!view) return;
          const nextDoc = contentToProseMirrorDoc(manuscriptSchema, nextContent ?? '');
          const nextState = EditorState.create({
            schema: manuscriptSchema,
            doc: nextDoc,
            plugins,
          });
          view.updateState(nextState);
          lastSerializedRef.current = nextContent ?? '';
          emitSelection(nextState);
        },
        getContent: () => {
          const view = viewRef.current;
          if (!view) return content ?? '';
          return proseMirrorDocToContent(view.state.doc);
        },
        applyContentReplacement: (
          nextContent: string,
          actor: ChangeActor,
          event?: Pick<SectionChangeEvent, 'id' | 'timestamp' | 'selection'>
        ) => {
          const view = viewRef.current;
          if (!view || readOnly) return;
          const nextDoc = contentToProseMirrorDoc(manuscriptSchema, nextContent ?? '');
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
          tr.setMeta('manuscriptActor', actor);
          if (event) {
            tr.setMeta('manuscriptChangeEvent', { id: event.id, timestamp: event.timestamp, selection: event.selection });
          }
          tr.setMeta(selectionLockPluginKey, { type: 'clear' });
          view.focus();
          view.dispatch(tr);
        },
        applyLockedSelectionReplacement: (
          text: string,
          actor: ChangeActor,
          event?: Pick<SectionChangeEvent, 'id' | 'timestamp' | 'selection'>
        ) => {
          const view = viewRef.current;
          if (!view || readOnly) return;
          const lock = selectionLockPluginKey.getState(view.state);
          const from = lock?.from ?? view.state.selection.from;
          const to = lock?.to ?? view.state.selection.to;
          const replacementDoc = contentToProseMirrorDoc(manuscriptSchema, text ?? '');
          const slice = Slice.maxOpen(replacementDoc.content);
          const tr = view.state.tr.replaceRange(from, to, slice);
          tr.setMeta('manuscriptActor', actor);
          if (event) {
            tr.setMeta('manuscriptChangeEvent', { id: event.id, timestamp: event.timestamp, selection: event.selection });
          }
          tr.setMeta(selectionLockPluginKey, { type: 'clear' });
          view.focus();
          view.dispatch(tr);
        },
      }),
      [content, plugins, readOnly]
    );

    return <div ref={mountRef} className="h-full w-full" />;
  }
);

ProseMirrorEditor.displayName = 'ProseMirrorEditor';

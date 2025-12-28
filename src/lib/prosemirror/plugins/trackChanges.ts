import { ChangeSet } from 'prosemirror-changeset';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Step } from 'prosemirror-transform';
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { colorForChangeActorKey } from '@/utils/changeColors';

export type TrackChangeData = {
  eventId: string;
  actorKey: string;
  actorLabel: string;
  actorType: 'USER' | 'LLM' | 'UNKNOWN';
  timestamp: number;
};

type TrackChangesState = {
  baseDoc: ProseMirrorNode;
  changeSet: ChangeSet;
  showHighlights: boolean;
  focusedEventId: string | null;
};

type TrackChangesMeta =
  | { type: 'toggle'; showHighlights: boolean }
  | { type: 'add'; data: TrackChangeData }
  | { type: 'focus'; eventId: string | null };

export const trackChangesPluginKey = new PluginKey<TrackChangesState>('trackChanges');

const replayEvents = (
  schema: Schema,
  baseDoc: ProseMirrorNode,
  events: Array<{ steps: unknown[]; data: TrackChangeData }>
) => {
  let doc = baseDoc;
  let changeSet = ChangeSet.create(baseDoc);

  for (const event of events) {
    for (const stepJson of event.steps) {
      try {
        const step = Step.fromJSON(schema, stepJson as any);
        const result = step.apply(doc);
        if (result.failed) continue;
        doc = result.doc;
        changeSet = changeSet.addSteps(doc, [step.getMap()], event.data);
      } catch {
        // Ignore bad persisted steps; they can be garbage collected in a future "repair" flow.
        continue;
      }
    }
  }

  return changeSet;
};

const titleForData = (data: TrackChangeData | null | undefined) => {
  if (!data) return '';
  const who = data.actorLabel || 'Unknown';
  const when = new Date(data.timestamp).toLocaleString();
  return `${who} • ${when}`;
};

const buildDecorations = (state: TrackChangesState, doc: ProseMirrorNode): DecorationSet | null => {
  if (!state.showHighlights) return null;

  const decorations: Decoration[] = [];
  const baseDoc = state.baseDoc;
  const focusedEventId = state.focusedEventId;

  for (const change of state.changeSet.changes) {
    // Inserted spans (exist in the current doc, B)
    let posB = change.fromB;
    for (const span of change.inserted) {
      const data = span.data as TrackChangeData | null | undefined;
      const color = colorForChangeActorKey(data?.actorKey || 'unknown');
      const from = posB;
      const to = posB + span.length;
      if (from < to) {
        const isFocused = !!focusedEventId && data?.eventId === focusedEventId;
        const focusStyle = isFocused ? `outline:2px solid ${color.border};outline-offset:1px;border-radius:2px;` : '';
        decorations.push(
          Decoration.inline(from, to, {
            class: `pm-change pm-change-insert${isFocused ? ' pm-change-focused' : ''}`,
            style: `background:${color.bg};box-shadow:inset 0 -2px 0 ${color.border};${focusStyle}`,
            title: titleForData(data),
            'data-event-id': data?.eventId || '',
            'data-actor-key': data?.actorKey || '',
          })
        );
      }
      posB = to;
    }

    // Deleted spans (exist only in base doc, A)
    if (change.deleted.length) {
      let posA = change.fromA;
      for (const span of change.deleted) {
        const data = span.data as TrackChangeData | null | undefined;
        const color = colorForChangeActorKey(data?.actorKey || 'unknown');
        const fromA = posA;
        const toA = posA + span.length;
        posA = toA;

        const deletedText = baseDoc.textBetween(fromA, toA, '\n');
        if (!deletedText) continue;
        const isFocused = !!focusedEventId && data?.eventId === focusedEventId;

        decorations.push(
          Decoration.widget(
            change.fromB,
            () => {
              const el = document.createElement('span');
              el.className = `pm-change pm-change-delete${isFocused ? ' pm-change-focused' : ''}`;
              el.textContent = deletedText;
              el.title = titleForData(data);
              el.dataset.eventId = data?.eventId || '';
              el.dataset.actorKey = data?.actorKey || '';
              el.style.background = color.bgSoft;
              el.style.color = color.text;
              el.style.textDecoration = 'line-through';
              el.style.textDecorationColor = color.border;
              el.style.textDecorationThickness = '2px';
              el.style.textDecorationStyle = 'solid';
              el.style.borderBottom = `2px solid ${color.border}`;
              if (isFocused) {
                el.style.outline = `2px solid ${color.border}`;
                el.style.outlineOffset = '1px';
              }
              el.style.borderRadius = '4px';
              el.style.padding = '0 2px';
              el.style.marginRight = '2px';
              el.style.pointerEvents = 'auto';
              return el;
            },
            { side: -1 }
          )
        );
      }
    }
  }

  return DecorationSet.create(doc, decorations);
};

export const trackChangesPlugin = ({
  schema,
  baseDoc,
  initialEvents,
  showHighlights,
}: {
  schema: Schema;
  baseDoc: ProseMirrorNode;
  initialEvents: Array<{ steps: unknown[]; data: TrackChangeData }>;
  showHighlights: boolean;
}) =>
  new Plugin<TrackChangesState>({
    key: trackChangesPluginKey,
    state: {
      init() {
        const changeSet = replayEvents(schema, baseDoc, initialEvents);
        return { baseDoc, changeSet, showHighlights, focusedEventId: null };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(trackChangesPluginKey) as TrackChangesMeta | undefined;

        if (meta?.type === 'toggle') {
          return { ...prev, showHighlights: meta.showHighlights };
        }

        if (meta?.type === 'focus') {
          return { ...prev, focusedEventId: meta.eventId };
        }

        if (tr.docChanged) {
          const data = meta?.type === 'add' ? meta.data : null;
          const safeData: TrackChangeData =
            data ?? ({
              eventId: 'unknown',
              actorKey: 'unknown',
              actorLabel: 'Unknown',
              actorType: 'UNKNOWN',
              timestamp: Date.now(),
            } satisfies TrackChangeData);
          return {
            ...prev,
            changeSet: prev.changeSet.addSteps(tr.doc, tr.mapping.maps, safeData),
          };
        }

        return prev;
      },
    },
    props: {
      decorations(editorState) {
        const state = trackChangesPluginKey.getState(editorState);
        if (!state) return null;
        return buildDecorations(state, editorState.doc);
      },
    },
  });

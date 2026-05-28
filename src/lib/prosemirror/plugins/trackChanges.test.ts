import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { trackChangesPlugin, trackChangesPluginKey } from './trackChanges';
import { buildReplaceSelectionAiReview } from '@/lib/prosemirror/aiReview';
import { manuscriptSchema } from '@/lib/prosemirror/schema';
import { contentToProseMirrorDoc } from '@/lib/prosemirror/serialization';
import type { ChangeActor, SectionChangeEvent } from '@/types';

const eventData = (event: SectionChangeEvent) => ({
  eventId: event.id,
  actorKey: event.actor.type === 'LLM' ? `LLM:${event.actor.model}` : `USER:${event.actor.userId}`,
  actorLabel: event.actor.type === 'LLM' ? event.actor.model : event.actor.name || event.actor.userId,
  actorType: event.actor.type,
  timestamp: event.timestamp,
});

describe('trackChangesPlugin', () => {
  it('replays persisted newest-first edit events in chronological order', () => {
    const actor: ChangeActor = { type: 'LLM', model: 'local-test-model' };
    const baseContent = 'Alpha beta gamma delta.';

    const first = buildReplaceSelectionAiReview({
      baseContent,
      from: 7,
      to: 11,
      replacementText: 'substantially longer beta phrase',
      actor,
      request: 'expand beta',
    });
    const second = buildReplaceSelectionAiReview({
      baseContent: first.previewContent,
      from: first.previewContent.indexOf('gamma') + 1,
      to: first.previewContent.indexOf('gamma') + 'gamma'.length + 1,
      replacementText: 'short',
      actor,
      request: 'rewrite gamma',
    });

    const currentDoc = contentToProseMirrorDoc(manuscriptSchema, second.previewContent);
    const state = EditorState.create({
      schema: manuscriptSchema,
      doc: currentDoc,
      plugins: [
        trackChangesPlugin({
          schema: manuscriptSchema,
          baseDoc: contentToProseMirrorDoc(manuscriptSchema, baseContent),
          initialEvents: [
            { steps: second.event.steps, data: eventData(second.event) },
            { steps: first.event.steps, data: eventData(first.event) },
          ],
          showHighlights: true,
        }),
      ],
    });

    const pluginState = trackChangesPluginKey.getState(state);
    const seenEventIds = new Set(
      pluginState?.changeSet.changes.flatMap((change) => [
        ...change.inserted.map((span) => span.data?.eventId),
        ...change.deleted.map((span) => span.data?.eventId),
      ])
    );

    expect(seenEventIds.has(first.event.id)).toBe(true);
    expect(seenEventIds.has(second.event.id)).toBe(true);
  });
});

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { SectionCommentThread } from '@/types';

export const commentHighlightsPluginKey = new PluginKey('commentHighlights');

type CommentHighlightConfig = {
  threads: SectionCommentThread[];
  selectedThreadId: string | null;
};

const clampPos = (pos: number, maxPos: number) => Math.max(0, Math.min(pos, maxPos));

const buildDecorations = (
  doc: ProseMirrorNode,
  threads: SectionCommentThread[],
  selectedThreadId: string | null
) => {
  if (!Array.isArray(threads) || threads.length === 0) return null;

  const maxPos = doc.content.size;
  const decorations: Decoration[] = [];

  for (const thread of threads) {
    const anchor = thread?.anchor;
    if (!anchor) continue;
    if (anchor.orphaned) continue;
    const from = clampPos(anchor.from, maxPos);
    const to = clampPos(anchor.to, maxPos);
    if (from >= to) continue;

    const isSelected = !!selectedThreadId && thread.id === selectedThreadId;
    const statusClass = thread.status === 'RESOLVED' ? 'pm-comment-resolved' : 'pm-comment-open';
    const selectedClass = isSelected ? 'pm-comment-selected' : '';
    decorations.push(
      Decoration.inline(from, to, {
        class: `pm-comment ${statusClass} ${selectedClass}`.trim(),
        'data-comment-id': thread.id,
      })
    );
  }

  if (decorations.length === 0) return null;
  return DecorationSet.create(doc, decorations);
};

export const commentHighlightsPlugin = (configRef: { current: CommentHighlightConfig }) =>
  new Plugin({
    key: commentHighlightsPluginKey,
    props: {
      decorations(state) {
        const config = configRef.current;
        return buildDecorations(state.doc, config.threads, config.selectedThreadId);
      },
    },
  });


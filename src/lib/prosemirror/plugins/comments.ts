import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { SectionCommentThread } from '@/types';

export const commentHighlightsPluginKey = new PluginKey('commentHighlights');

export type CommentViewMode = 'NONE' | 'HIGHLIGHTS';

type CommentHighlightConfig = {
  threads: SectionCommentThread[];
  selectedThreadId: string | null;
  viewMode: CommentViewMode;
  onSelectThread?: (threadId: string) => void;
};

const clampPos = (pos: number, maxPos: number) => Math.max(0, Math.min(pos, maxPos));

const statusClassForThread = (thread: SectionCommentThread) =>
  thread.status === 'RESOLVED' ? 'pm-comment-resolved' : 'pm-comment-open';

const buildDecorations = (doc: ProseMirrorNode, configRef: { current: CommentHighlightConfig }) => {
  const { threads, selectedThreadId, viewMode } = configRef.current;
  if (viewMode !== 'HIGHLIGHTS') return null;
  if (!Array.isArray(threads) || threads.length === 0) return null;

  const maxPos = doc.content.size;
  const decorations: Decoration[] = [];

  const addInlineHighlight = (thread: SectionCommentThread, isSelected: boolean) => {
    const anchor = thread?.anchor;
    if (!anchor || anchor.orphaned) return;
    const from = clampPos(anchor.from, maxPos);
    const to = clampPos(anchor.to, maxPos);
    if (from >= to) return;
    const statusClass = statusClassForThread(thread);
    const selectedClass = isSelected ? 'pm-comment-selected' : '';
    decorations.push(
      Decoration.inline(from, to, {
        class: `pm-comment ${statusClass} ${selectedClass}`.trim(),
        'data-comment-id': thread.id,
      })
    );
  };

  for (const thread of threads) {
    addInlineHighlight(thread, !!selectedThreadId && thread.id === selectedThreadId);
  }

  if (decorations.length === 0) return null;
  return DecorationSet.create(doc, decorations);
};

export const commentHighlightsPlugin = (configRef: { current: CommentHighlightConfig }) =>
  new Plugin({
    key: commentHighlightsPluginKey,
    props: {
      decorations(state) {
        return buildDecorations(state.doc, configRef);
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const el = target.closest('[data-comment-id]') as HTMLElement | null;
        const threadId = el?.dataset?.commentId;
        if (!threadId) return false;
        // Only treat clicks on highlighted comment spans (not regular text).
        if (!el.classList.contains('pm-comment')) return false;
        configRef.current.onSelectThread?.(threadId);
        return true;
      },
    },
  });

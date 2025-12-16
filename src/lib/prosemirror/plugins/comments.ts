import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { SectionCommentThread } from '@/types';

export const commentHighlightsPluginKey = new PluginKey('commentHighlights');

export type CommentViewMode = 'BUBBLES' | 'HIGHLIGHTS';

type CommentHighlightConfig = {
  threads: SectionCommentThread[];
  selectedThreadId: string | null;
  viewMode: CommentViewMode;
  onSelectThread?: (threadId: string) => void;
};

const clampPos = (pos: number, maxPos: number) => Math.max(0, Math.min(pos, maxPos));

const statusClassForThread = (thread: SectionCommentThread) =>
  thread.status === 'RESOLVED' ? 'pm-comment-resolved' : 'pm-comment-open';

const bubbleClassForThread = (thread: SectionCommentThread) =>
  thread.status === 'RESOLVED' ? 'pm-comment-bubble-resolved' : 'pm-comment-bubble-open';

const createBubbleDom = (
  view: EditorView,
  pos: number,
  thread: SectionCommentThread,
  configRef: { current: CommentHighlightConfig }
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pm-comment-bubble ${bubbleClassForThread(thread)}`.trim();
  button.dataset.commentId = thread.id;
  const preview = (thread.messages?.[0]?.content || 'Comment').trim().replace(/\s+/g, ' ');
  button.title = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;
  button.setAttribute('aria-label', 'Open comment');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
    </svg>
  `.trim();

  const position = () => {
    const coords = view.coordsAtPos(pos);
    const rect = view.dom.getBoundingClientRect();
    const center = (coords.top + coords.bottom) / 2;
    const top = center - rect.top + view.dom.scrollTop;
    button.style.top = `${Math.max(0, top)}px`;
  };

  position();

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    configRef.current.onSelectThread?.(thread.id);
  });

  return button;
};

const buildDecorations = (doc: ProseMirrorNode, configRef: { current: CommentHighlightConfig }) => {
  const { threads, selectedThreadId, viewMode } = configRef.current;
  if (!Array.isArray(threads) || threads.length === 0) return null;

  const maxPos = doc.content.size;
  const decorations: Decoration[] = [];

  const selectedThread = selectedThreadId ? threads.find((t) => t.id === selectedThreadId) ?? null : null;

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

  if (viewMode === 'HIGHLIGHTS') {
    for (const thread of threads) {
      addInlineHighlight(thread, !!selectedThreadId && thread.id === selectedThreadId);
    }
  } else {
    if (selectedThread) {
      addInlineHighlight(selectedThread, true);
    }
    for (const thread of threads) {
      const anchor = thread?.anchor;
      if (!anchor || anchor.orphaned) continue;
      const from = clampPos(anchor.from, maxPos);
      if (from < 0 || from > maxPos) continue;
      decorations.push(
        Decoration.widget(
          from,
          (view) => createBubbleDom(view, from, thread, configRef),
          {
            key: `comment-bubble:${thread.id}`,
            side: 1,
            stopEvent: () => true,
          }
        )
      );
    }
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
    view(editorView) {
      const reposition = () => {
        const { threads, viewMode } = configRef.current;
        const bubbles = editorView.dom.querySelectorAll<HTMLElement>('.pm-comment-bubble[data-comment-id]');
        if (!bubbles.length) return;
        const rect = editorView.dom.getBoundingClientRect();
        const maxPos = editorView.state.doc.content.size;

        for (const bubble of bubbles) {
          const id = bubble.dataset.commentId;
          const thread = id ? threads.find((t) => t.id === id) ?? null : null;
          const anchor = thread?.anchor;
          if (!thread || viewMode !== 'BUBBLES' || !anchor || anchor.orphaned) {
            bubble.style.display = 'none';
            continue;
          }
          bubble.style.display = '';
          const pos = clampPos(anchor.from, maxPos);
          const coords = editorView.coordsAtPos(pos);
          const center = (coords.top + coords.bottom) / 2;
          const top = center - rect.top + editorView.dom.scrollTop;
          bubble.style.top = `${Math.max(0, top)}px`;
        }
      };

      const onResize = () => reposition();
      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(editorView.dom);

      return {
        update() {
          reposition();
        },
        destroy() {
          resizeObserver.disconnect();
        },
      };
    },
  });

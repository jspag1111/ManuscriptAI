import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const isDocEmpty = (doc: any) =>
  doc?.childCount === 1 &&
  doc.firstChild?.type?.name === 'paragraph' &&
  doc.firstChild.content.size === 0;

export const placeholderPlugin = (placeholder: string) =>
  new Plugin({
    props: {
      decorations(state) {
        if (!placeholder) return null;
        if (!isDocEmpty(state.doc)) return null;

        const deco = Decoration.widget(
          1,
          () => {
            const span = document.createElement('span');
            span.className = 'pm-placeholder';
            span.textContent = placeholder;
            return span;
          },
          { side: -1 }
        );

        return DecorationSet.create(state.doc, [deco]);
      },
    },
  });

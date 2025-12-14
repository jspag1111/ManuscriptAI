import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';

export const manuscriptSchema = new Schema({
  nodes: basicSchema.spec.nodes.addBefore('text', 'citation', {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    attrs: {
      ids: { default: [] as string[] },
    },
    toDOM(node) {
      const ids = Array.isArray(node.attrs.ids) ? node.attrs.ids : [];
      return [
        'span',
        {
          'data-ids': ids.join(','),
          class: 'pm-citation',
          contenteditable: 'false',
        },
        ids.map((id) => `[[ref:${id}]]`).join(' '),
      ];
    },
    parseDOM: [
      {
        tag: 'span.pm-citation[data-ids]',
        getAttrs(dom) {
          if (!(dom instanceof HTMLElement)) return false;
          const raw = dom.getAttribute('data-ids') || '';
          const ids = raw
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
          return { ids };
        },
      },
    ],
  }),
  marks: basicSchema.spec.marks,
});

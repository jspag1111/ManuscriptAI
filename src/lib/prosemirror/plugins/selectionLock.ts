import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export type SelectionLockState = { from: number; to: number } | null;

export const selectionLockPluginKey = new PluginKey<SelectionLockState>('selectionLock');

type SelectionLockMeta =
  | { type: 'set'; from: number; to: number }
  | { type: 'clear' };

const applyMeta = (tr: Transaction, prev: SelectionLockState): SelectionLockState => {
  const meta = tr.getMeta(selectionLockPluginKey) as SelectionLockMeta | undefined;
  if (!meta) return prev;
  if (meta.type === 'clear') return null;
  if (meta.type === 'set') {
    if (meta.from >= meta.to) return null;
    return { from: meta.from, to: meta.to };
  }
  return prev;
};

export const selectionLockPlugin = () =>
  new Plugin<SelectionLockState>({
    key: selectionLockPluginKey,
    state: {
      init: () => null,
      apply(tr, prev) {
        const viaMeta = applyMeta(tr, prev);
        if (!viaMeta) return null;
        if (!tr.docChanged) return viaMeta;
        const from = tr.mapping.map(viaMeta.from);
        const to = tr.mapping.map(viaMeta.to);
        if (from >= to) return null;
        return { from, to };
      },
    },
    props: {
      decorations(state) {
        const lock = selectionLockPluginKey.getState(state);
        if (!lock) return null;
        return DecorationSet.create(state.doc, [
          Decoration.inline(lock.from, lock.to, {
            class: 'pm-selection-lock',
          }),
        ]);
      },
    },
  });


import { EditorState } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { manuscriptSchema } from '@/lib/prosemirror/schema';
import { contentToProseMirrorDoc, proseMirrorDocToContent } from '@/lib/prosemirror/serialization';
import { generateId } from '@/lib/projects';
import type { ChangeActor, SectionChangeEvent } from '@/types';

export const buildReplaceAllAiReview = ({
  baseContent,
  nextContent,
  actor,
  request,
}: {
  baseContent: string;
  nextContent: string;
  actor: ChangeActor;
  request?: string | null;
}): { previewContent: string; event: SectionChangeEvent } => {
  const baseDoc = contentToProseMirrorDoc(manuscriptSchema, baseContent ?? '');
  const nextDoc = contentToProseMirrorDoc(manuscriptSchema, nextContent ?? '');
  const state = EditorState.create({ schema: manuscriptSchema, doc: baseDoc });
  const tr = state.tr.replaceWith(0, state.doc.content.size, nextDoc.content);
  const previewContent = proseMirrorDocToContent(tr.doc);
  const now = Date.now();
  const trimmedRequest = typeof request === 'string' ? request.trim() : '';

  return {
    previewContent,
    event: {
      id: generateId(),
      timestamp: now,
      actor,
      selection: { from: 0, to: state.doc.content.size },
      ...(trimmedRequest ? { request: trimmedRequest } : {}),
      steps: tr.steps.map((step) => step.toJSON()),
    },
  };
};

export const buildReplaceSelectionAiReview = ({
  baseContent,
  from,
  to,
  replacementText,
  actor,
  request,
}: {
  baseContent: string;
  from: number;
  to: number;
  replacementText: string;
  actor: ChangeActor;
  request?: string | null;
}): { previewContent: string; event: SectionChangeEvent } => {
  const baseDoc = contentToProseMirrorDoc(manuscriptSchema, baseContent ?? '');
  const state = EditorState.create({ schema: manuscriptSchema, doc: baseDoc });
  const safeFrom = Math.max(0, Math.min(from, state.doc.content.size));
  const safeTo = Math.max(0, Math.min(to, state.doc.content.size));
  const replacementDoc = contentToProseMirrorDoc(manuscriptSchema, replacementText ?? '');
  const slice = Slice.maxOpen(replacementDoc.content);
  const tr = state.tr.replaceRange(safeFrom, safeTo, slice);
  const previewContent = proseMirrorDocToContent(tr.doc);
  const now = Date.now();
  const trimmedRequest = typeof request === 'string' ? request.trim() : '';

  return {
    previewContent,
    event: {
      id: generateId(),
      timestamp: now,
      actor,
      selection: { from: safeFrom, to: safeTo },
      ...(trimmedRequest ? { request: trimmedRequest } : {}),
      steps: tr.steps.map((step) => step.toJSON()),
    },
  };
};

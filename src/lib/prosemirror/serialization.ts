import { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model';
import { CITATION_REGEX, CITATION_SEQUENCE_REGEX } from '@/utils/citationUtils';

type CitationToken = { type: 'citation'; ids: string[] };
type Token = { type: 'text'; value: string } | CitationToken;

const splitIntoParagraphs = (content: string) => content.replace(/\r\n/g, '\n').split('\n');

const parseInlineTokens = (text: string): Token[] => {
  if (!text) return [{ type: 'text', value: '' }];

  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_SEQUENCE_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    const raw = match[0];
    const ids: string[] = [];
    for (const idMatch of raw.matchAll(CITATION_REGEX)) {
      ids.push(idMatch[1]);
    }

    if (ids.length > 0) {
      tokens.push({ type: 'citation', ids });
    } else {
      tokens.push({ type: 'text', value: raw });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
};

export const contentToProseMirrorDoc = (schema: Schema, content: string): ProseMirrorNode => {
  const paragraphs = splitIntoParagraphs(content ?? '');
  const blocks: ProseMirrorNode[] = paragraphs.map((line) => {
    const inline: ProseMirrorNode[] = [];
    for (const token of parseInlineTokens(line)) {
      if (token.type === 'text') {
        if (token.value) inline.push(schema.text(token.value));
        continue;
      }
      inline.push(schema.nodes.citation.create({ ids: token.ids }));
    }
    return schema.nodes.paragraph.create(null, Fragment.fromArray(inline));
  });

  return schema.nodes.doc.create(null, Fragment.fromArray(blocks));
};

const serializeCitation = (ids: unknown): string => {
  const safeIds = Array.isArray(ids)
    ? ids.map((id) => String(id)).filter(Boolean)
    : [];
  if (safeIds.length === 0) return '[[ref:UNKNOWN]]';
  return safeIds.map((id) => `[[ref:${id}]]`).join(' ');
};

export const proseMirrorDocToContent = (doc: ProseMirrorNode): string => {
  const lines: string[] = [];

  doc.forEach((block) => {
    if (block.type.name !== 'paragraph') {
      lines.push(block.textContent);
      return;
    }

    let line = '';
    block.forEach((inline) => {
      if (inline.isText) {
        line += inline.text ?? '';
        return;
      }
      if (inline.type.name === 'citation') {
        const serialized = serializeCitation(inline.attrs?.ids);
        if (line.length > 0 && !/\s$/.test(line)) line += ' ';
        line += serialized;
        return;
      }
      line += inline.textContent;
    });

    lines.push(line);
  });

  return lines.join('\n');
};


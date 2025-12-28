import { describe, expect, it } from 'vitest';
import { manuscriptSchema } from '../schema';
import { contentToProseMirrorDoc, proseMirrorDocToContent } from '../serialization';

describe('ProseMirror Serialization', () => {
  describe('contentToProseMirrorDoc', () => {
    it('parses plain text into a document', () => {
      const content = 'Hello world';
      const doc = contentToProseMirrorDoc(manuscriptSchema, content);

      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe('paragraph');
      expect(doc.firstChild?.textContent).toBe('Hello world');
    });

    it('parses text with citations', () => {
      const content = 'Hello [[ref:1]] world';
      const doc = contentToProseMirrorDoc(manuscriptSchema, content);

      const paragraph = doc.firstChild!;
      // Note: The implementation details of how spaces are handled around citations might vary.
      // We check that the citation node exists and has correct ID.

      let foundCitation = false;
      paragraph.forEach((node) => {
        if (node.type.name === 'citation') {
          expect(node.attrs.ids).toEqual(['1']);
          foundCitation = true;
        }
      });
      expect(foundCitation).toBe(true);
    });

    it('handles multiple paragraphs', () => {
      const content = 'Para 1\nPara 2';
      const doc = contentToProseMirrorDoc(manuscriptSchema, content);

      expect(doc.childCount).toBe(2);
      expect(doc.child(0).textContent).toBe('Para 1');
      expect(doc.child(1).textContent).toBe('Para 2');
    });
  });

  describe('proseMirrorDocToContent', () => {
    it('serializes simple document back to text', () => {
      const content = 'Hello world';
      const doc = contentToProseMirrorDoc(manuscriptSchema, content);
      const output = proseMirrorDocToContent(doc);
      expect(output).toBe(content);
    });

    it('serializes document with citations', () => {
      // Note: Exact spacing might depend on implementation.
      // If the original had "Hello [[ref:1]] world", let's ensure it comes back mostly the same.
      // Or at least that it contains the citation.

      const content = 'Hello [[ref:1]] world';
      const doc = contentToProseMirrorDoc(manuscriptSchema, content);
      const output = proseMirrorDocToContent(doc);
      expect(output).toBe(content);
    });

    it('serializes multiline document', () => {
       const content = 'Line 1\nLine 2';
       const doc = contentToProseMirrorDoc(manuscriptSchema, content);
       const output = proseMirrorDocToContent(doc);
       expect(output).toBe(content);
    });
  });
});

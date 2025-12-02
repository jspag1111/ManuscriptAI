import { contentToHtml, compileText, formatCitationRanges, getBibliographyOrder, htmlToContent } from '../citationUtils';
import type { Section } from '../../types';

describe('getBibliographyOrder', () => {
  const sections: Section[] = [
    {
      id: 's1',
      title: 'Intro',
      content: 'Hello [[ref:a]] world [[ref:b]]',
      userNotes: '',
      versions: [],
      lastModified: Date.now(),
      useReferences: true,
      includeInWordCount: true,
    },
    {
      id: 's2',
      title: 'Body',
      content: 'More text [[ref:b]] and [[ref:c]]',
      userNotes: '',
      versions: [],
      lastModified: Date.now(),
      useReferences: true,
      includeInWordCount: true,
    },
  ];

  it('returns unique reference ids in order of appearance', () => {
    expect(getBibliographyOrder(sections)).toEqual(['a', 'b', 'c']);
  });
});

describe('formatCitationRanges', () => {
  it('formats contiguous ranges and separated numbers', () => {
    expect(formatCitationRanges([3, 1, 2, 5, 7, 6])).toBe('[1-3, 5-7]');
  });

  it('returns empty string for no numbers', () => {
    expect(formatCitationRanges([])).toBe('');
  });
});

describe('compileText', () => {
  const refOrder = ['ref-a', 'ref-b', 'ref-c', 'ref-d'];

  it('replaces grouped citations with numbered ranges', () => {
    const input = 'First [[ref:ref-a]] [[ref:ref-b]]. Later [[ref:ref-d]].';
    const compiled = compileText(input, refOrder);
    expect(compiled).toBe('First [1-2]. Later [4].');
  });

  it('leaves unmatched references intact', () => {
    const input = 'Unknown [[ref:missing]] reference';
    expect(compileText(input, refOrder)).toBe(input);
  });
});

describe('contentToHtml and htmlToContent', () => {
  const refOrder = ['one', 'two', 'three'];

  it('renders citation spans with grouped labels', () => {
    const html = contentToHtml('Uses [[ref:one]] [[ref:two]]', refOrder);
    const spanCount = (html.match(/citation-object/g) || []).length;
    expect(spanCount).toBe(1);
    expect(html).toContain('[1-2]');
  });

  it('round-trips citation spans back to content format', () => {
    const container = document.createElement('div');
    container.innerHTML = contentToHtml('Alpha [[ref:one]] text', refOrder);

    const parsed = htmlToContent(container);
    expect(parsed.trim()).toBe('Alpha  [[ref:one]] text');
  });

  it('preserves literal characters when rendering without citations', () => {
    const html = contentToHtml('<script>alert(1)</script>', refOrder, false);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

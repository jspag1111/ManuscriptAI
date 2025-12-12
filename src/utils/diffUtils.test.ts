import { describe, expect, it } from 'vitest';
import { computeDiff } from './diffUtils';

describe('computeDiff', () => {
  it('groups replacements into cohesive delete/insert blocks', () => {
    const result = computeDiff('The quick brown fox', 'The quick agile fox');

    expect(result).toEqual([
      { type: 'equal', value: 'The quick ' },
      { type: 'delete', value: 'brown ' },
      { type: 'insert', value: 'agile ' },
      { type: 'equal', value: 'fox' },
    ]);
  });

  it('keeps separate change regions distinct without alternating tokens', () => {
    const before = 'Clinical notes from the day prior to 6am of the index date.';
    const after = 'Clinical notes from the day prior to 24 hours before the index date.';

    const result = computeDiff(before, after);

    expect(result).toEqual([
      { type: 'equal', value: 'Clinical notes from the day prior to ' },
      { type: 'delete', value: '6am of ' },
      { type: 'insert', value: '24 hours before ' },
      { type: 'equal', value: 'the index date.' },
    ]);
  });
});

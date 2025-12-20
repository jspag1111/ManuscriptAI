import { describe, expect, it } from 'vitest';

import { calculateTextStats } from '../textStats';

describe('calculateTextStats', () => {
  it('handles empty or undefined input safely', () => {
    expect(calculateTextStats('')).toEqual({
      words: 0,
      charsWithSpaces: 0,
      charsWithoutSpaces: 0,
    });

    expect(calculateTextStats()).toEqual({
      words: 0,
      charsWithSpaces: 0,
      charsWithoutSpaces: 0,
    });
  });

  it('counts words and characters across varied whitespace', () => {
    const text = '  Hello   world!\nThis is\n a test.  ';
    const stats = calculateTextStats(text);

    expect(stats.words).toBe(6);
    expect(stats.charsWithSpaces).toBe(text.length);
    expect(stats.charsWithoutSpaces).toBe(text.replace(/\s+/g, '').length);
  });
});

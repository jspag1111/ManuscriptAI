import { describe, expect, it } from 'vitest';
import { calculateTextStats } from '../textStats';

describe('calculateTextStats', () => {
  it('returns zeros for empty string', () => {
    expect(calculateTextStats('')).toEqual({
      words: 0,
      charsWithSpaces: 0,
      charsWithoutSpaces: 0,
    });
  });

  it('returns zeros for string with only spaces', () => {
    expect(calculateTextStats('   ')).toEqual({
      words: 0,
      charsWithSpaces: 3,
      charsWithoutSpaces: 0,
    });
  });

  it('correctly counts simple text', () => {
    const text = 'Hello world';
    expect(calculateTextStats(text)).toEqual({
      words: 2,
      charsWithSpaces: 11,
      charsWithoutSpaces: 10,
    });
  });

  it('handles multiple spaces between words', () => {
    const text = 'Hello   world';
    expect(calculateTextStats(text)).toEqual({
      words: 2,
      charsWithSpaces: 13,
      charsWithoutSpaces: 10,
    });
  });

  it('handles newlines and tabs', () => {
    const text = 'Hello\nworld\t!';
    expect(calculateTextStats(text)).toEqual({
      words: 3,
      charsWithSpaces: 13,
      charsWithoutSpaces: 11,
    });
  });
});

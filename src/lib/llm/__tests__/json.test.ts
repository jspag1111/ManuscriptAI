import { describe, expect, it } from 'vitest';
import { extractJsonFromText, parseJsonFromText } from '../json';

describe('llm/json', () => {
  it('extracts JSON objects from fenced blocks', () => {
    const text = '```json\\n{ \"ok\": true, \"n\": 1 }\\n```';
    expect(extractJsonFromText(text)).toBe('{ \"ok\": true, \"n\": 1 }');
    expect(parseJsonFromText<{ ok: boolean; n: number }>(text).data).toEqual({ ok: true, n: 1 });
  });

  it('extracts JSON arrays when present', () => {
    const text = 'some preface\\n[1,2,3]\\ntrailing';
    expect(extractJsonFromText(text)).toBe('[1,2,3]');
    expect(parseJsonFromText<number[]>(text).data).toEqual([1, 2, 3]);
  });
});


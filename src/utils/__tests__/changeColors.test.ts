import { describe, expect, it } from 'vitest';

import { colorForChangeActorKey } from '../changeColors';

describe('colorForChangeActorKey', () => {
  it('returns a stable palette entry for a given actor key', () => {
    const paletteEntry = colorForChangeActorKey('user1');

    expect(paletteEntry).toEqual({
      base: '#0d9488',
      bg: 'rgba(13, 148, 136, 0.16)',
      bgSoft: 'rgba(13, 148, 136, 0.08)',
      border: 'rgba(13, 148, 136, 0.55)',
      text: '#0f172a',
    });
  });

  it('falls back to a deterministic color when the key is empty', () => {
    const emptyKeyColor = colorForChangeActorKey('');
    const unknownKeyColor = colorForChangeActorKey('unknown');

    expect(emptyKeyColor).toEqual(unknownKeyColor);
  });

  it('produces different palette indices for different keys when possible', () => {
    const first = colorForChangeActorKey('user1');
    const second = colorForChangeActorKey('user2');

    expect(first.base).not.toBe(second.base);
  });
});

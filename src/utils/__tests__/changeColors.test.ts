import { describe, expect, it } from 'vitest';
import { colorForChangeActorKey } from '../changeColors';

describe('colorForChangeActorKey', () => {
  it('returns a color object with expected properties', () => {
    const color = colorForChangeActorKey('user1');
    expect(color).toHaveProperty('base');
    expect(color).toHaveProperty('bg');
    expect(color).toHaveProperty('bgSoft');
    expect(color).toHaveProperty('border');
    expect(color).toHaveProperty('text');
  });

  it('returns deterministic color for the same key', () => {
    const color1 = colorForChangeActorKey('user1');
    const color2 = colorForChangeActorKey('user1');
    expect(color1).toEqual(color2);
  });

  it('produces valid hex colors', () => {
    const color = colorForChangeActorKey('user1');
    expect(color.base).toMatch(/^#[0-9a-f]{6}$/i);
    expect(color.text).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles empty key gracefully', () => {
     const color = colorForChangeActorKey('');
     expect(color).toBeDefined();
     expect(color.base).toBeDefined();
  });
});

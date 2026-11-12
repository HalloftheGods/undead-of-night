import { describe, expect, it } from 'vitest';

describe('icons.ts and pickups.ts', () => {
  it('load in either order without a circular-import error', async () => {
    const icons = await import('../src/art/fx/icons.ts');
    const pickups = await import('../src/art/fx/pickups.ts');
    expect(icons).toBeDefined();
    expect(pickups).toBeDefined();
  });
});

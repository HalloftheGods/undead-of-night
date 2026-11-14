import { describe, expect, it } from 'vitest';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildArtBook } from '../src/art/index.ts';
import { composeScene, magazinePhotos, townClip } from '../src/game/magazine-photos.ts';
import { handArrowPath, handCirclePath } from '../src/game/magazine-marks.ts';
import { installFakeBrowser } from './client-fake-dom.ts';

// The town photos paint on a canvas, which node does not have: the fake one stands in.
installFakeBrowser();

const opaqueShare = (rgba: Uint8ClampedArray) => {
  const alphas = rgba.filter((_, index) => index % 4 === 3);
  return alphas.filter((alpha) => alpha === 255).length / alphas.length;
};

describe('magazine photos', () => {
  // The fake canvas keeps no pixels, so the solid-picture check needs a real canvas and cannot run under node.
  it.skip('develops every snapshot as a solid picture', () => {
    const photos = magazinePhotos(buildArtBook());
    for (const photo of Object.values(photos)) {
      expect(photo.rgba.length).toBe(photo.w * photo.h * 4);
      expect(opaqueShare(photo.rgba)).toBe(1);
    }
  });

  it('develops them once per art book', () => {
    const art = buildArtBook();
    expect(magazinePhotos(art)).toBe(magazinePhotos(art));
  });

  it('stands a sprite on the ground at its anchor', () => {
    const art = buildArtBook();
    const bare = composeScene(art, 48, 48, () => 'grass', []);
    const placed = composeScene(art, 48, 48, () => 'grass', [{ sprite: art.ui.pickupIcons.medkit, x: 24, y: 24 }]);
    expect(placed.rgba).not.toEqual(bare.rgba);
  });

  it('clips a real town without running off the map', () => {
    const art = buildArtBook();
    const map = generateWorldMap(7);
    const clip = townClip(art, map, 0, map.height, 96, 64);
    expect(clip.w).toBe(96);
    expect(clip.h).toBe(64);
    expect(opaqueShare(clip.rgba)).toBe(1);
  });
});

describe('magazine marker pen', () => {
  it('draws the same wobble every time', () => {
    expect(handCirclePath(10, 10, 5)).toBe(handCirclePath(10, 10, 5));
    expect(handArrowPath(0, 0, 40, 20)).toBe(handArrowPath(0, 0, 40, 20));
  });

  it('ends an arrow on its target, with a head', () => {
    const path = handArrowPath(0, 0, 40, 20);
    expect(path).toContain('L40 20');
    expect(path.match(/M/g)).toHaveLength(3);
  });
});

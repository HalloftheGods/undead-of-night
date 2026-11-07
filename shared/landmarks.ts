import type { LandmarkId } from './biomes.ts';
import type { MapBuilder } from './map-builder.ts';
import type { PropKind } from './protocol.ts';
import { randRange } from './rng.ts';

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Props this close are meant to touch: a wreck jammed against a wreck. */
const TIGHT = 2;

function ring(b: MapBuilder, kind: PropKind, at: Spot, radius: number, count: number, gap = 6): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    b.place(b.species(kind), Math.round(at.x + Math.cos(angle) * radius), Math.round(at.y + Math.sin(angle) * radius), gap);
  }
}

function litter(b: MapBuilder, kind: PropKind, at: Spot, radius: number, count: number): void {
  for (let i = 0; i < count; i++) {
    b.place(kind, Math.round(at.x + randRange(b.rng, -radius, radius)), Math.round(at.y + randRange(b.rng, -radius, radius)), TIGHT);
  }
}

/** A line of vehicles side by side, as a convoy stopped where it was. */
function convoy(b: MapBuilder, at: Spot, kinds: readonly PropKind[]): void {
  const pitch = 46;
  kinds.forEach((kind, i) => {
    const offset = (i - (kinds.length - 1) / 2) * pitch;
    b.place(kind, Math.round(at.x + offset), Math.round(at.y + (i % 2 === 0 ? -6 : 8)), TIGHT);
  });
}

const BUILD: Record<LandmarkId, (b: MapBuilder, at: Spot) => void> = {
  // A fountain gone to a pond, ringed by oaks.
  plaza(b, at) {
    b.blob(at.x, at.y, 30, 'water', ['grass', 'dirt']);
    ring(b, 'tree', at, 64, 8);
    ring(b, 'bush', at, 44, 6, TIGHT);
    litter(b, 'rubble', at, 14, 2);
  },
  // Everything the district could not move, piled where the road gave out.
  scrapheap(b, at) {
    b.place('car_wreck_h', at.x - 30, at.y - 8, TIGHT);
    b.place('van_h', at.x + 12, at.y - 16, TIGHT);
    b.place('car_sedan_h', at.x - 8, at.y + 14, TIGHT);
    b.place('car_wreck_h', at.x + 38, at.y + 10, TIGHT);
    ring(b, 'barrier', at, 74, 7, 10);
    litter(b, 'crate_stack', at, 56, 3);
    litter(b, 'fire_barrel', at, 50, 2);
    litter(b, 'rubble', at, 60, 5);
  },
  // Cars left in the water where the flood took them.
  drowned_convoy(b, at) {
    b.blob(at.x, at.y, 74, 'water', ['grass', 'dirt']);
    b.blob(at.x + 36, at.y + 10, 56, 'water', ['grass', 'dirt']);
    convoy(b, at, ['car_sedan_h', 'van_h', 'car_wreck_h', 'car_sedan_h']);
    ring(b, 'reeds', at, 86, 12, TIGHT);
    litter(b, 'rubble', at, 50, 3);
  },
  // A pit of sludge, burn barrels round the lip and fungus beyond.
  sludge_pit(b, at) {
    b.blob(at.x, at.y, 62, 'sludge', ['grass', 'dirt']);
    b.blob(at.x, at.y, 46, 'sludge', ['grass', 'dirt']);
    ring(b, 'fire_barrel', at, 76, 5, 8);
    ring(b, 'fungus', at, 98, 6, 8);
    litter(b, 'rubble', at, 40, 3);
  },
  // Somebody's camp at the heart of the wood.
  campsite(b, at) {
    ring(b, 'pine', at, 92, 10, 8);
    b.place('fire_barrel', at.x, at.y, 8);
    b.place('crate_stack', at.x - 38, at.y + 10, 8);
    b.place('crate_stack', at.x + 36, at.y + 8, 8);
    b.place('sandbags', at.x, at.y - 40, 8);
    b.place('van_h', at.x + 6, at.y + 46, 8);
  },
  // A cordon compound: barrier lines, a gap to drive through, vans and fire inside.
  checkpoint(b, at) {
    for (let dx = -88; dx <= 88; dx += 36) {
      const isRoadGap = Math.abs(dx) < 20;
      if (isRoadGap) continue;
      b.place('barrier', at.x + dx, at.y - 56, TIGHT);
      b.place('barrier', at.x + dx, at.y + 60, TIGHT);
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) b.place('sandbags', at.x + sx * 100, at.y + sy * 34, TIGHT);
    }
    b.place('van_h', at.x - 40, at.y, 8);
    b.place('van_h', at.x + 40, at.y + 6, 8);
    litter(b, 'crate_stack', at, 50, 3);
    litter(b, 'fire_barrel', at, 44, 2);
  },
  // A convoy buried in a drift.
  frozen_convoy(b, at) {
    b.blob(at.x, at.y, 82, 'snow', ['grass', 'dirt']);
    convoy(b, at, ['van_h', 'car_wreck_h', 'car_sedan_h', 'van_h']);
    litter(b, 'dead_tree', at, 70, 3);
    litter(b, 'rubble', at, 50, 3);
  },
  // Fungus grown in two rings round a sunken bed.
  nest(b, at) {
    b.blob(at.x, at.y, 42, 'sludge', ['grass', 'dirt']);
    ring(b, 'fungus', at, 66, 9, 4);
    ring(b, 'fungus', at, 102, 12, 4);
    litter(b, 'rubble', at, 34, 3);
  },
  // Where something came down: a scorched patch, a van thrown clear, burning wreckage.
  crash_site(b, at) {
    b.blob(at.x, at.y, 72, 'ash', ['grass', 'dirt']);
    b.place('van_h', at.x, at.y, TIGHT);
    b.place('car_wreck_h', at.x + 50, at.y + 20, TIGHT);
    ring(b, 'fire_barrel', at, 46, 4, 6);
    litter(b, 'dead_tree', at, 80, 3);
    litter(b, 'rubble', at, 60, 7);
  },
};

export function raiseLandmark(b: MapBuilder, id: LandmarkId, at: Spot): void {
  BUILD[id](b, at);
}

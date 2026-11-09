// Pieces with something built into them: drawers under a bed, doors under a counter or a bench.
// The stock prop is the starting point, so only the part that opens is redrawn.

import { finish, startPiece } from '../environment/furniture.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { bakeStage, over, paper, stage, tipped } from './stage.ts';
import type { ContainerArt } from './stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, brick } = RAMPS;

const BED_RISE = 6;
const COUNTER_RISE = 12;
const BENCH_RISE = 10;
const DESK_RISE = 7;

function drawerFront(c: PixelCanvas, x: number, y: number, w: number): void {
  c.rect(x, y, w, 4, wood[2]).rect(x, y, w, 1, wood[3]).rect(x + Math.floor(w / 2) - 1, y + 2, 2, 1, metal[3]);
}

function bedClosed(bed: PixelSprite): PixelSprite {
  const s = stage('bed', bed, 0, 0);
  const y = s.ground - BED_RISE + 1;
  drawerFront(s.c, s.left + 2, y, 9);
  drawerFront(s.c, s.left + 13, y, 9);
  return bakeStage(s);
}

function bedOpened(bed: PixelSprite): PixelSprite {
  const s = stage('bed', bed, 5, 9);
  const { c, left, ground } = s;
  const y = ground - BED_RISE + 1;
  drawerFront(c, left + 13, y + 1, 9);
  // The pillow goes on the floor and the sheet shows where it lay.
  c.rect(left + 3, ground - 37, 18, 7, bone[1]).rect(left + 3, ground - 37, 18, 1, bone[0]);
  c.rect(left + 2, y, 9, 4, ink[0]);
  over(c, (layer) => {
    // Pulled right out and left hanging, its contents dragged over the lip.
    layer.rect(left + 1, y + 1, 11, 9, wood[2]).rect(left + 2, y + 1, 9, 7, ink[0]);
    layer.rect(left + 1, y + 8, 11, 3, wood[3]).rect(left + 5, y + 9, 3, 1, metal[3]);
    layer.rect(left + 3, y + 2, 4, 3, denim[1]).rect(left + 6, y + 4, 4, 3, brick[1]).px(left + 4, y + 3, denim[2]);
    layer.rect(left + 14, ground + 2, 6, 3, denim[1]).rect(left + 15, ground + 2, 4, 1, denim[2]);
    layer.rect(left - 4, ground - 8, 3, 7, bone[2]).rect(left - 4, ground - 8, 3, 1, bone[3]);
  });
  return bakeStage(s);
}

export function buildBedArt(bed: PixelSprite): ContainerArt {
  return { closed: bedClosed(bed), opened: bedOpened(bed) };
}

function panel(c: PixelCanvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, wood[1]).rect(x, y, w, 1, wood[2]).rect(x, y, 1, h, wood[2]);
  c.rect(x + w - 2, y + Math.floor(h / 2) - 1, 1, 2, metal[3]);
}

/** A cupboard door swung out on its left hinge and sagging, over the dark it used to close. */
function hanging(c: PixelCanvas, hinge: number, y: number, h: number): void {
  c.poly([[hinge, y], [hinge + 7, y + 3], [hinge + 7, y + h + 3], [hinge, y + h - 1]], wood[3]);
  c.line(hinge, y, hinge + 7, y + 3, bone[1]);
  c.rect(hinge + 5, y + 6, 1, 2, metal[3]);
}

function counterClosed(): PixelSprite {
  const p = startPiece('counter', COUNTER_RISE);
  const { c, left, right, ground, front, top, w } = p;
  c.rect(left, top, w, 12, wood[2]);
  c.rect(left, top, w, 1, wood[3]).rect(left, top, 1, 12, wood[3]).rect(right, top, 1, 12, wood[1]);
  for (const [x, y, len] of [[8, 3, 12], [24, 7, 9], [38, 4, 7]] as const) c.rect(left + x, top + y, len, 1, wood[1]);
  // The till, shut.
  c.rect(left + 6, top - 2, 13, 9, metal[1]).rect(left + 6, top - 2, 13, 1, metal[3]).rect(left + 8, top, 9, 3, ink[1]);
  c.rect(left + 9, top + 1, 4, 1, teal[1]).rect(left + 6, top + 6, 13, 1, metal[0]);
  c.rect(left, front, w, COUNTER_RISE, wood[0]);
  c.rect(left, front, w, 1, wood[0]);
  for (const x of [1, 17, 33]) panel(c, left + x, front + 1, 14, 9);
  c.rect(left, ground - 2, w, 2, ink[1]);
  return finish(p);
}

function cavity(c: PixelCanvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, ink[0]).rect(x, y + h - 3, w, 1, wood[0]);
}

/** The stock counter already has its till hanging open and its paper spilled. */
function counterOpened(counter: PixelSprite): PixelSprite {
  const s = stage('counter', counter, 2, 7);
  const { c, left, ground } = s;
  const y = ground - COUNTER_RISE + 1;
  cavity(c, left + 1, y, 14, 9);
  cavity(c, left + 33, y, 14, 9);
  c.rect(left + 4, y + 2, 3, 3, blood[1]);
  over(c, (layer) => {
    hanging(layer, left + 1, y, 9);
    hanging(layer, left + 33, y, 9);
    tipped(layer, left + 20, ground + 1, bone[2]);
    paper(layer, left + 27, ground + 3);
    tipped(layer, left + 10, ground + 3, teal[1]);
  });
  return bakeStage(s);
}

export function buildCounterArt(counter: PixelSprite): ContainerArt {
  return { closed: counterClosed(), opened: counterOpened(counter) };
}

function benchClosed(bench: PixelSprite): PixelSprite {
  const s = stage('workbench', bench, 0, 0);
  const { c, left, ground } = s;
  const y = ground - BENCH_RISE + 3;
  c.rect(left + 4, y, 32, 7, wood[0]);
  panel(c, left + 4, y, 15, 6);
  panel(c, left + 20, y, 15, 6);
  return bakeStage(s);
}

function benchOpened(bench: PixelSprite): PixelSprite {
  const s = stage('workbench', bench, 2, 7);
  const { c, left, ground } = s;
  const y = ground - BENCH_RISE + 3;
  c.rect(left + 4, y, 32, 7, ink[0]);
  over(c, (layer) => {
    hanging(layer, left + 4, y, 6);
    hanging(layer, left + 27, y, 6);
    // The toolbox tipped out on the floor, spanners sliding from it.
    layer.poly([[left + 13, ground + 1], [left + 23, ground - 1], [left + 25, ground + 3], [left + 15, ground + 5]], blood[1]);
    layer.line(left + 13, ground + 1, left + 23, ground - 1, blood[2]);
    layer.line(left + 26, ground + 3, left + 31, ground + 4, metal[3]);
    layer.line(left + 8, ground + 4, left + 12, ground + 5, metal[2]);
  });
  return bakeStage(s);
}

export function buildBenchArt(bench: PixelSprite): ContainerArt {
  return { closed: benchClosed(bench), opened: benchOpened(bench) };
}

/** A school desk: the table with a shallow drawer slung under its front edge. */
function deskClosed(table: PixelSprite): PixelSprite {
  const s = stage('table', table, 0, 0);
  drawerFront(s.c, s.left + 7, s.ground - DESK_RISE + 1, 10);
  return bakeStage(s);
}

function deskOpened(table: PixelSprite): PixelSprite {
  const s = stage('table', table, 2, 7);
  const { c, left, ground } = s;
  const y = ground - DESK_RISE + 1;
  c.rect(left + 7, y, 10, 4, ink[0]);
  over(c, (layer) => {
    // Pulled out and left, the homework slid off onto the floor.
    layer.rect(left + 6, y + 2, 12, 5, wood[2]).rect(left + 7, y + 2, 10, 3, ink[0]).rect(left + 6, y + 6, 12, 1, wood[3]);
    layer.rect(left + 8, y + 3, 3, 1, blood[2]).rect(left + 12, y + 3, 4, 1, teal[1]);
    paper(layer, left + 1, ground + 3);
    paper(layer, left + 17, ground + 2);
  });
  return bakeStage(s);
}

export function buildDeskArt(table: PixelSprite): ContainerArt {
  return { closed: deskClosed(table), opened: deskOpened(table) };
}

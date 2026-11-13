// The things on the map screen that come and go during a run: the escape van, the supply drop on its parachute
// and the crate once it lands, and the check and cross a player earns on the buildings they have been through.

import { CURSOR_COLOR } from './map-cursor.ts';
import { drawRows, drawRowsCentred, MAP_INK, rowsIcon } from './map-sprite.ts';
import type { MapIcon, SpriteLegend } from './map-sprite.ts';

export const EXIT_COLOR = '#ffc03c';
export const DROP_COLOR = '#e0463a';
export const TICK_COLOR = '#b6e04a';
export const CROSS_COLOR = '#e0463a';

const VAN_LEGEND: SpriteLegend = { K: MAP_INK, Y: EXIT_COLOR, y: '#c07a1c', c: '#9fd8ff', m: '#7c8494' };
/** The van side on, nose to the left, a dark stripe down its flank. */
const VAN: readonly string[] = [
  '..KKKKKKKKKK.',
  '.KcKYYYYYYYYK',
  'KccKYYYYYYYYK',
  'KYYYYYYYYYYYK',
  'KyyyyyyyyyyyK',
  'KKmKKKKKKKmKK',
  '.KKK.....KKK.',
];

const DROP_LEGEND: SpriteLegend = { K: MAP_INK, R: DROP_COLOR, W: '#ece2c6', k: '#a8a492', w: '#ac8458', b: '#7c5840' };
/** A red and white canopy with the crate hanging under it. */
const CHUTE: readonly string[] = [
  '..KKKKKKK..',
  '.KRRWWWRRK.',
  'KRRWWWWWRRK',
  'KKKKKKKKKKK',
  '.k...k...k.',
  '..k..k..k..',
  '...KKKKK...',
  '...KwbwK...',
  '...KRRRK...',
  '...KKKKK...',
];
/** The crate on the ground, strapped with red. */
const CRATE: readonly string[] = [
  'KKKKKKKKK',
  'KwwwbwwwK',
  'KwbwbwbwK',
  'KRRRRRRRK',
  'KwbwbwbwK',
  'KwwwbwwwK',
  'KKKKKKKKK',
];

const TICK_LEGEND: SpriteLegend = { K: MAP_INK, T: TICK_COLOR };
const TICK: readonly string[] = ['....KK', '...KTK', 'KK.KTK', 'KTKTK.', 'KTTTK.', '.KTK..', '..K...'];

const CROSS_LEGEND: SpriteLegend = { K: MAP_INK, X: CROSS_COLOR };
const CROSS: readonly string[] = ['XK...KX', 'KXK.KXK', '.KXKXK.', '..KXK..', '.KXKXK.', 'KXK.KXK', 'XK...KX'];

const CURSOR_LEGEND: SpriteLegend = { K: MAP_INK, C: CURSOR_COLOR, W: '#ffffff' };
const CURSOR: readonly string[] = [
  'CCC...CCC',
  'C.......C',
  'C...W...C',
  '...WWW...',
  '..WWWWW..',
  '.........',
  'C.......C',
  'C.......C',
  'CCC...CCC',
];

/** The S.O.S. Fireworks bus, pink like the sparks it sells. */
export const FIREWORKS_COLOR = '#ff7ad0';
const BUS_LEGEND: SpriteLegend = { K: MAP_INK, Y: EXIT_COLOR, P: FIREWORKS_COLOR, p: '#b04a90', c: '#9fd8ff', W: '#ece2c6', R: '#e0463a', m: '#7c8494' };
/** The bus side on, its sign on the roof and its striped awning out over the hatch. */
const FIREWORKS_BUS: readonly string[] = [
  '...KKKKKKKK...',
  '...KYYYYYYK...',
  'KKKKKKKKKKKKKK',
  'KcPPRWRWRWPPPK',
  'KcPPKKKKKKPcPK',
  'KppppppppppppK',
  'KKmKKKKKKKKmKK',
  '.KKK......KKK.',
];

export function drawFireworksBus(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawRowsCentred(ctx, x, y, FIREWORKS_BUS, BUS_LEGEND);
}

export function drawVan(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawRowsCentred(ctx, x, y, VAN, VAN_LEGEND);
}

/** The crate under its parachute while it falls, and on the ground once it is down. */
export function drawDropSprite(ctx: CanvasRenderingContext2D, x: number, y: number, landed: boolean): void {
  if (landed) drawRowsCentred(ctx, x, y, CRATE, DROP_LEGEND);
  else drawRows(ctx, x - 5, y - 7, CHUTE, DROP_LEGEND);
}

/** The check in a building's top right corner, (x, y) being the footprint's corner. */
export function drawTickMark(ctx: CanvasRenderingContext2D, right: number, top: number): void {
  drawRows(ctx, right - 7, top, TICK, TICK_LEGEND);
}

/** Heights above the centre where the van and drop carry their names. */
export const VAN_LABEL_RISE = 5;
export const DROP_LABEL_RISE = 9;

export const VAN_ICON: MapIcon = rowsIcon(VAN, VAN_LEGEND);
export const FIREWORKS_BUS_ICON: MapIcon = rowsIcon(FIREWORKS_BUS, BUS_LEGEND);
export const DROP_ICON: MapIcon = rowsIcon(CHUTE, DROP_LEGEND);
export const TICK_ICON: MapIcon = rowsIcon(TICK, TICK_LEGEND);
export const CROSS_ICON: MapIcon = rowsIcon(CROSS, CROSS_LEGEND);
export const CURSOR_ICON: MapIcon = rowsIcon(CURSOR, CURSOR_LEGEND);

/** A bunker station: a lamp-lit machine you hold E at. */
export const STATION_COLOR = '#ffb066';
const STATION_LEGEND: SpriteLegend = { K: MAP_INK, S: STATION_COLOR, s: '#a0602c', W: '#fff0b4' };
const STATION: readonly string[] = ['KKKKK', 'KWSsK', 'KSSsK', 'KsssK', 'KKKKK'];

export function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawRowsCentred(ctx, x, y, STATION, STATION_LEGEND);
}

export const STATION_ICON: MapIcon = rowsIcon(STATION, STATION_LEGEND);

/** The emergency radio tower on the town map: antenna mast with red beacon. */
export const TOWER_COLOR = '#ff4444';
const TOWER_LEGEND: SpriteLegend = { K: MAP_INK, R: '#ff2222', W: '#ffffff', M: '#7c8494', m: '#484e68' };
const RADIO_TOWER: readonly string[] = [
  '..R..',
  '.MWM.',
  '..M..',
  '.m.m.',
  'm...m',
];

export function drawRadioTowerMarker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawRowsCentred(ctx, x, y, RADIO_TOWER, TOWER_LEGEND);
}

export const RADIO_TOWER_ICON: MapIcon = rowsIcon(RADIO_TOWER, TOWER_LEGEND);

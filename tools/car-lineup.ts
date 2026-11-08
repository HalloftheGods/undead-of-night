// Every car body in every coat, shut and searched, with the light bars lit, so the town's traffic
// can be judged side by side.
//   node --experimental-strip-types tools/car-lineup.ts <outfile.png> [scale]

import { writeFileSync } from 'node:fs';
import type { PropKind } from '../shared/protocol.ts';
import { buildArtBook } from '../src/art/index.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { encodePng } from './png.ts';
import { drawSprite, Sheet } from './sheet.ts';

const [out = 'car-lineup.png', scaleArg = '3'] = process.argv.slice(2);
const scale = Number(scaleArg);
const art = buildArtBook();
const CELL_W = 64;
const CELL_H = 62;
const LABEL = 10;

const emergency: PropKind[] = ['police_h', 'police_v', 'ambulance_h'];
const rows: { label: string; sprites: PixelSprite[] }[] = [];
for (const [kind, coats] of Object.entries(art.paintedContainers)) {
  rows.push({ label: kind.toUpperCase(), sprites: coats!.map((coat) => coat.closed) });
}
const lit = emergency.flatMap((kind) => art.environment.beacons[kind]!.frames.map((frame) => ({ kind, frame })));
rows.push({ label: 'LIGHTS', sprites: [] });
const searched = Object.values(art.paintedContainers).map((coats) => coats![2].opened);
const emergencyLooks = ['police', 'police_v', 'ambulance'] as const;
rows.push({ label: 'SEARCHED', sprites: [...searched, ...emergencyLooks.map((look) => art.containers[look].opened)] });

const cols = Math.max(12, ...rows.map((row) => row.sprites.length), lit.length);
const sheet = new Sheet(cols * CELL_W, rows.length * (CELL_H + LABEL), 0x3a3c4c);
rows.forEach((row, r) => {
  const top = r * (CELL_H + LABEL);
  for (let i = 0; i < row.label.length * 4; i++) sheet.set(2 + i, top + 1, 0x3a3c4c);
  row.sprites.forEach((sprite, col) => {
    drawSprite(sheet, sprite, col * CELL_W + 32 - sprite.ax, top + LABEL + CELL_H - 8 - sprite.ay, 1);
  });
});
// The light bars, each frame laid over its body.
const lightsTop = rows.findIndex((row) => row.label === 'LIGHTS') * (CELL_H + LABEL);
lit.forEach(({ kind, frame }, col) => {
  const body = art.environment.props[kind];
  drawSprite(sheet, body, col * CELL_W + 32 - body.ax, lightsTop + LABEL + CELL_H - 8 - body.ay, 1);
  drawSprite(sheet, frame, col * CELL_W + 32 - frame.ax, lightsTop + LABEL + CELL_H - 8 - frame.ay, 1);
});
const big = sheet.scaled(scale);
writeFileSync(out, encodePng(big.w, big.h, big.data));

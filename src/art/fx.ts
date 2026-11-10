// The effects lane: flashes, gore, debris and ground pickups. The art lives in fx/.

import type { PickupType } from '../../shared/protocol.ts';
import type { Clip, FxArt } from './types.ts';
import { buildAmbientFx } from './fx/ambient.ts';
import { buildCasing, buildImpact, buildShell, buildSmoke } from './fx/debris.ts';
import { buildAcidDecals, buildBloodDecals } from './fx/decals.ts';
import { buildAcidBurst, buildBloodBurst } from './fx/gore.ts';
import { buildMuzzle, buildTracer } from './fx/muzzle.ts';
import { buildPickupClips } from './fx/pickups.ts';
import { gridSprite } from './fx/shared.ts';
import { MAG_GRID, MAG_LEGEND } from './survivors/weapons.ts';

export function buildFx(): FxArt {
  return {
    ambient: buildAmbientFx(),
    muzzle: buildMuzzle(),
    tracer: buildTracer(),
    bulletImpact: buildImpact(),
    bloodBurst: buildBloodBurst(),
    bloodDecals: buildBloodDecals(),
    acidBurst: buildAcidBurst(),
    acidDecals: buildAcidDecals(),
    smokePuff: buildSmoke(),
    shellCasing: buildCasing(),
    shotgunShell: buildShell(),
    droppedMag: gridSprite(MAG_GRID, MAG_LEGEND, 0, 0),
  };
}

export function buildPickups(): Record<PickupType, Clip> {
  return buildPickupClips();
}

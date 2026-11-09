// The four merchants: a standing figure, the walking, shooting and falling clips they move about the
// bunker in, a portrait for the How to Play book and a bust for the shop screen. The figure and portrait are drawn on the survivor rig (merchant-people/), so the
// merchants share the playable cast's build, outline, palette and lighting.

import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import type { Clip, MerchantArt, PixelSprite, SurvivorWeaponArt } from '../types.ts';
import type { BustDef } from '../survivors/bust.ts';
import { bustOf } from '../survivors/bust.ts';
import { weaponClips } from '../survivors/clips.ts';
import { deadClip, downedClip, standingFrame } from '../survivors/fallen.ts';
import { portraitOf } from '../survivors/portrait.ts';
import { gunDrop } from '../survivors/rig.ts';
import type { Person } from '../survivors/rig.ts';
import { GUNSMITH_BUST } from './merchant-busts/gunsmith.ts';
import { MEDIC_BUST } from './merchant-busts/medic.ts';
import { POWDER_BUST } from './merchant-busts/powder.ts';
import { QUARTERMASTER_BUST } from './merchant-busts/quartermaster.ts';
import { GUNSMITH } from './merchant-people/gunsmith.ts';
import { MEDIC } from './merchant-people/medic.ts';
import { POWDER } from './merchant-people/powder.ts';
import { QUARTERMASTER } from './merchant-people/quartermaster.ts';

const PEOPLE: Record<MerchantId, Person> = {
  gunsmith: GUNSMITH,
  quartermaster: QUARTERMASTER,
  medic: MEDIC,
  powder: POWDER,
};

/** Standing behind the stall: the survivor rig's front pose, hands at the sides, feet on the anchor. */
const figure = (id: MerchantId): PixelSprite => standingFrame(PEOPLE[id], 0, 'stand', 0, 0, 0);

/** The same crop the survivors' portraits use, so a merchant stands at their scale in the book. */
const portrait = (id: MerchantId): PixelSprite => portraitOf(PEOPLE[id]);

const eachMerchant = <T>(build: (id: MerchantId) => T): Record<MerchantId, T> =>
  Object.fromEntries(MERCHANT_IDS.map((id) => [id, build(id)])) as Record<MerchantId, T>;

export function buildMerchantProps(): Record<MerchantId, PixelSprite> {
  return eachMerchant(figure);
}

const BUSTS: Record<MerchantId, BustDef> = {
  gunsmith: GUNSMITH_BUST,
  quartermaster: QUARTERMASTER_BUST,
  medic: MEDIC_BUST,
  powder: POWDER_BUST,
};

export function buildMerchants(): Record<MerchantId, MerchantArt> {
  return eachMerchant((id) => ({ figure: figure(id), portrait: portrait(id), bust: bustOf(BUSTS[id]) }));
}

/** A merchant walking the bunker with their gun, drawn as a survivor is. */
export interface MerchantBody {
  readonly set: SurvivorWeaponArt;
  readonly downed: Clip;
  readonly dead: Clip;
  /** Pixels their gun sits below the standard build's, for the muzzle flash. */
  readonly gunDrop: number;
}

const bodies = new Map<string, MerchantBody>();

/** Drawn the first time the bunker shows them, then kept: the title screen and the towns never pay for it. */
export function merchantBody(id: MerchantId, weapon: WeaponId): MerchantBody {
  const key = `${id}/${weapon}`;
  const found = bodies.get(key);
  if (found) return found;
  const person = PEOPLE[id];
  const body = { set: weaponClips(person, weapon), downed: downedClip(person), dead: deadClip(person, weapon), gunDrop: gunDrop(person) };
  bodies.set(key, body);
  return body;
}

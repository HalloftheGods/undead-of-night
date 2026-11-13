// One line about an item, for the line under its name when it is in hand. Candies carry their own blurb.

import { CANDIES, isCandyId } from '../../../shared/candy.ts';

const BLURBS: Readonly<Record<string, string>> = {
  bandage: 'Clean cloth wrap. Stops the bleeding.',
  canned_food: 'A dented tin, still sealed. Takes the edge off the hunger.',
  water_bottle: 'Clean water, still capped. Cools a dry throat.',
  disinfectant: 'Stings like hell. Cleans a wound before it turns.',
  antibiotics: 'A half-used course of pills. Fights off an infection.',
  medkit: 'Everything a medic would reach for.',
  knife: 'Short, sharp and quiet.',
  plank: 'Rough lumber. Good for boarding a door.',
  nails: 'A fistful of bent nails. Holds a board in place.',
  hammer_tool: 'Heavy and steady. Drives the nails home.',
  crowbar: 'Pries open what somebody nailed shut.',
  sheet_curtain: 'Torn cloth. Might make a bandage.',
  pistol_ammo: 'A full magazine of pistol rounds.',
  carbine_ammo: 'A full magazine of carbine rounds.',
  shells: 'A tube full of shotgun shells.',
};

/** A line about the item, or '' when there is nothing to say. */
export function itemBlurb(type: string): string {
  if (isCandyId(type)) return CANDIES[type].blurb;
  return BLURBS[type] ?? '';
}

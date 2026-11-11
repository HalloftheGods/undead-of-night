// The names that cross the sim/client boundary, declared once. `protocol.ts` derives its
// types from these and the packet guards check against them, so a name added here is
// accepted everywhere without a second hand list.

import { PART_ORDER } from './gun-upgrade-data.ts';
import { KIT_ORDER } from './round-effect-data.ts';

export const GAME_PHASES = ['intermission', 'wave', 'gameover'] as const;

/** Towns hold jewels only; silver comes from the forge, quests and the overrun chest, straight into the bank. */
export const TREASURE_TYPES = ['jewel_small', 'jewel_large'] as const;

export const SURVIVAL_ITEM_TYPES = ['canned_food', 'water_bottle', 'disinfectant', 'antibiotics'] as const;

/** Found in town and banked at home, where the press turns it into round kits. Never in a loadout. */
export const SALVAGE_TYPES = ['fuel_can', 'car_battery', 'scrap_steel', 'sedatives'] as const;

export const FORTIFICATION_TYPES = ['plank', 'nails', 'hammer_tool', 'sheet_curtain', 'crowbar'] as const;

export const PICKUP_TYPES = [
  'bandage', 'medkit', 'pistol_ammo', 'carbine_ammo', 'shells', 'carbine', 'shotgun', 'knife', 'radio',
  ...PART_ORDER, ...KIT_ORDER, ...TREASURE_TYPES, ...SURVIVAL_ITEM_TYPES, ...SALVAGE_TYPES, ...FORTIFICATION_TYPES,
] as const;

export const GAME_EVENT_TYPES = [
  'shot', 'dry_fire', 'melee', 'heal', 'zombie_alert', 'zombie_track', 'reload_start', 'reload_end', 'weapon_switch', 'bullet_impact',
  'zombie_hit', 'zombie_status', 'headshot', 'zombie_die', 'zombie_attack', 'bloater_burst', 'player_hurt',
  'player_downed', 'player_revived', 'candy_eaten', 'keepsake_taken', 'player_dead', 'pickup', 'container_opened', 'stairs_taken', 'bottle_smash', 'spinner_lit', 'fountain_lit', 'car_alarm', 'drop_called', 'drop_landed', 'boss_arrive', 'boss_trick', 'boss_down', 'wave_intermission',
  'wave_start', 'wave_clear', 'exit_open', 'level_complete', 'level_start', 'game_over', 'trip_start',
  'overrun_warning', 'overrun_breach', 'overrun_end', 'merchant_hurt', 'merchant_downed', 'emote',
] as const;

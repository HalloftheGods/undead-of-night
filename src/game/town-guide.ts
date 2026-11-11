// The Town Guide: what each kind of building holds, read straight off the loot tables, so the book
// can never promise a medkit the town would not have put there.
//
// A place's finds come from four sources: what lies on its floors (LOOT_RULES), what is put away in its
// furniture (CONTAINER_LOOT), what a search hides besides (fireworks and candy), and the few gun parts,
// round kits and Radios a whole town has. Each find is ranked Always, Often, Sometimes or Rare.

import { BOTTLE_FIND_CHANCE, CAR_ALARM_CHANCE } from "../../shared/bottles.ts";
import { CANDY_ODDS, DOORSTEP_HOMES } from "../../shared/candy.ts";
import { CONTAINER_LOOT } from "../../shared/container-loot.ts";
import { BOOTH_FIREWORKS } from "../../shared/fireworks-booth.ts";
import { OUTDOOR_CONTAINERS, ROOM_CONTAINERS } from "../../shared/containers.ts";
import type { ContainerKind } from "../../shared/containers.ts";
import { KITCHEN_KNIFE_ODDS, KITCHENS } from "../../shared/kitchen-knives.ts";
import { LOOT_RULES } from "../../shared/loot.ts";
import { PART_SOURCES } from "../../shared/part-loot.ts";
import { BUILDING_DEFS } from "../../shared/protocol.ts";
import type { BuildingKind, PickupType } from "../../shared/protocol.ts";
import { CAR_RADIO_ODDS, RADIO_ODDS, RADIO_PLACES } from "../../shared/radio.ts";
import { GUN_EFFECTS, KIT_SOURCES } from "../../shared/round-effect-data.ts";
import type { GunEffect } from "../../shared/round-effect-data.ts";
import {
  CAR_FOUNTAIN_ODDS,
  FIREWORK_CARRY,
  FOUNTAIN_ODDS,
  FIREWORK_ODDS
} from "../../shared/throwables.ts";
import type { LeafColor } from "./changelog.ts";

export const TOWN_GUIDE_TITLE = "Town Guide";

export type FindTier = "always" | "often" | "sometimes" | "rare";
export const TIER_ORDER: readonly FindTier[] = ["always", "often", "sometimes", "rare"];
export const TIER_LABELS: Readonly<Record<FindTier, string>> = {
  always: "Always",
  often: "Often",
  sometimes: "Sometimes",
  rare: "Rare"
};

/** The picture beside a find: a pickup's own icon, one of the HUD's throwables, or the candy wrapper. */
export type FindIcon = PickupType | "fountain" | "firework" | "candy";

export interface GuideFind {
  readonly id: string;
  readonly name: string;
  readonly icon: FindIcon;
  readonly tier: FindTier;
  /** How likely within its tier, to rank finds and places that share one: a share, odds, or a source's total weight. */
  readonly weight: number;
  /** A few words more, such as which gun parts, or Campaign only. */
  readonly note?: string;
}

/** A house's upstairs and an apartment's share a page, under `upstairs`; the floors over the hospital and school go on theirs. The sewers hold nothing to find, so they get no page. */
export type PlaceId =
  | Exclude<
      BuildingKind,
      "apartment_upstairs" | "hospital_upstairs" | "school_upstairs" | `sewer_${string}`
    >
  | "cars"
  | "fireworks_bus";

export interface GuidePlace {
  readonly id: PlaceId;
  readonly name: string;
  /** The picture the page shows: a building's facade, or the furniture searched where no facade is ever seen. */
  readonly picture: { readonly building: BuildingKind } | { readonly container: ContainerKind };
  readonly blurb: string;
  readonly searchIn: readonly ContainerKind[];
  readonly finds: readonly GuideFind[];
}

/** What every find reads as in the book. Gun parts and round kits are one line each, named in its note. */
const FIND_NAMES: Readonly<Partial<Record<PickupType, string>>> = {
  bandage: "Bandages",
  medkit: "Medkits",
  pistol_ammo: "Pistol rounds",
  carbine_ammo: "Carbine rounds",
  shells: "Shotgun shells",
  carbine: "Carbine",
  shotgun: "Shotgun",
  knife: "Knife",
  radio: "Radio",
  canned_food: "Food",
  water_bottle: "Water",
  disinfectant: "Disinfectant",
  antibiotics: "Antibiotics"
};

const PART_NAMES: Readonly<Record<string, string>> = {
  barrel: "barrel",
  grip: "grip",
  magazine: "magazine",
  suppressor: "suppressor",
  toolkit: "toolkit"
};
const KIT_NAMES: Readonly<Record<GunEffect, string>> = {
  incendiary: "flame",
  acid: "acid",
  piercing: "piercing",
  tranq: "tranq"
};

/** The order pages run in: medicine, guns, the workshops, the shops, then where people lived, then the street. */
const PLACE_ORDER: readonly PlaceId[] = [
  "hospital",
  "pharmacy",
  "clinic",
  "police",
  "gun_shop",
  "garage",
  "warehouse",
  "radio_station",
  "grocery",
  "discount",
  "diner",
  "school",
  "house",
  "apartment",
  "upstairs",
  "cellar",
  "cars",
  "fireworks_bus"
];

/** Each place's line under its name: the magazine's voice, never a rule the tables do not hold. */
const BLURBS: Readonly<Record<PlaceId, string>> = {
  hospital:
    "The biggest building in town. A medkit waits in the emergency bay every time, with antibiotics in the wards.",
  pharmacy:
    "The first stop for anyone bleeding or septic. Check behind the counter for antibiotics.",
  clinic:
    "Disinfectant waits on the counter every time, and the lockers keep antibiotics and bandages.",
  police:
    "A carbine is always left in the station, and the lockers are full of rounds and confiscated fountains.",
  gun_shop: "A shotgun on the rack every time, and shells to go with it.",
  garage: "Spinners on the shelves, the odd fountain, gun parts by the bench.",
  warehouse: "Big, dark and mostly empty, but the cabinets hold spinners and gun parts lie about.",
  radio_station: "Broadcast consoles, emergency frequencies, and the towering transmitter mast in the yard.",
  grocery: "Always has canned food on the floor, and the coolers keep bottled water.",
  discount:
    "Cheap goods: canned food and bottled water, with rare kits and gun parts on the shelves.",
  diner:
    "A kitchen always keeps canned food and bottled water, and a knife turns up more often here than anywhere.",
  school:
    "Desks and lockers by the dozen: mostly empty, but this is where the confiscated candy went.",
  house: "Where the spare ammo and pantry rations went. Candy waits on the step.",
  apartment: "Like a house, with more pantries and drawers to scavenge for food and water.",
  upstairs: "Bedrooms: where a night's candy haul gets hidden.",
  cellar: "Worth the trip down for first aid, and the noise it brings.",
  cars: "Every car has a radio. Cop cars carry extra firepower, while ambulances carry medical supplies.",
  fireworks_bus:
    "An old city bus in the downtown car park, turned fireworks stand. Fill your hands, then come back for more."
};

const tierRank = (tier: FindTier): number => TIER_ORDER.indexOf(tier);

/** Better tier first, then the likelier of two in the same tier. */
const likelierFirst = (a: GuideFind, b: GuideFind): number =>
  tierRank(a.tier) - tierRank(b.tier) || b.weight - a.weight;

/** A find's share of a weighted table, as a tier: what a place mostly holds is Often. */
function shareTier(share: number): FindTier {
  const isMostOf = share >= 0.3;
  if (isMostOf) return "often";
  return share >= 0.12 ? "sometimes" : "rare";
}

/** Odds that one search hides something besides its loot, as a tier. */
function stashTier(odds: number): FindTier {
  const isLikely = odds >= 0.2;
  if (isLikely) return "often";
  return odds >= 0.08 ? "sometimes" : "rare";
}

const totalOf = (odds: Partial<Record<string, number>>): number =>
  Object.values(odds).reduce<number>((sum, weight) => sum + (weight ?? 0), 0);

function shareOf(table: Partial<Record<PickupType, number>>, type: PickupType): number {
  const total = Object.values(table).reduce((sum, weight) => sum + (weight ?? 0), 0);
  return total > 0 ? (table[type] ?? 0) / total : 0;
}

/** Names in the order their odds run, most likely first. */
function byWeight<K extends string>(
  odds: Partial<Record<K, number>>,
  names: Readonly<Record<K, string>>
): string {
  const ranked = (Object.entries(odds) as [K, number][]).sort((a, b) => b[1] - a[1]);
  return ranked.map(([key]) => names[key]).join(", ");
}

/** A rough count of searchable furniture in a room, for weighing what it keeps put away against what lies on its floor. */
const FURNITURE_GUESS = 4;

/** Items a floor holds on average: a roll below zero is an empty floor. */
function floorItems([low, high]: readonly [number, number]): number {
  const counts = Array.from({ length: high - low + 1 }, (_, at) => Math.max(0, low + at));
  return counts.reduce((sum, count) => sum + count, 0) / counts.length;
}

/**
 * What lies on the floors and in the furniture. The larger share of the two decides the tier: what a place
 * mostly holds is Often. How many turn up in all decides which of two places the index sends a player to first.
 */
function stockFinds(kind: BuildingKind | "outdoors"): GuideFind[] {
  const floor = kind === "outdoors" ? null : LOOT_RULES[kind];
  const kept = CONTAINER_LOOT[kind];
  const types = new Set<PickupType>([
    ...(floor?.fixed ?? []),
    ...Object.keys(floor?.table ?? {}),
    ...Object.keys(kept.table)
  ] as PickupType[]);
  return [...types].map((type) => {
    const fixed = floor?.fixed?.includes(type) === true;
    const floorShare = floor ? shareOf(floor.table, type) : 0;
    const keptShare = shareOf(kept.table, type);
    const onFloor = floor ? floorShare * floorItems(floor.items) : 0;
    const expected = onFloor + keptShare * kept.odds * FURNITURE_GUESS;
    const tier = fixed ? "always" : shareTier(Math.max(floorShare, keptShare));
    return {
      id: type,
      name: FIND_NAMES[type] ?? type,
      icon: type,
      tier,
      weight: fixed ? 1 + expected : expected
    };
  });
}

/** Fireworks and candy a search turns up besides its loot. */
function stashFinds(kind: BuildingKind | "outdoors", inCars: boolean): GuideFind[] {
  const fountain = inCars ? CAR_FOUNTAIN_ODDS : (FOUNTAIN_ODDS[kind] ?? 0);
  const firework = FIREWORK_ODDS[kind] ?? 0;
  const candy = inCars ? 0 : (CANDY_ODDS[kind] ?? 0);
  const stashes: readonly (readonly [Omit<GuideFind, "tier" | "weight">, number])[] = [
    [
      {
        id: "fountain",
        name: "Fountain fireworks",
        icon: "fountain",
        note: "A lure that lights whatever reaches it"
      },
      fountain
    ],
    [
      {
        id: "firework",
        name: "Spinner fireworks",
        icon: "firework",
        note: "Light one for a ground spinner"
      },
      firework
    ],
    [{ id: "candy", name: "Candy", icon: "candy" }, candy]
  ];
  return stashes
    .filter(([, odds]) => odds > 0)
    .map(([find, odds]) => ({ ...find, tier: stashTier(odds), weight: odds }));
}

/** What a whole town has only a handful of: gun parts, round kits, and a Radio. */
function townFinds(kind: BuildingKind): GuideFind[] {
  const finds: GuideFind[] = [];
  const parts = PART_SOURCES[kind];
  if (parts)
    finds.push({
      id: "parts",
      name: "Gun parts",
      icon: "barrel",
      tier: "rare",
      weight: totalOf(parts),
      note: byWeight(parts, PART_NAMES)
    });
  const kits = KIT_SOURCES[kind];
  if (kits) {
    const likeliest = (Object.entries(kits) as [GunEffect, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
    finds.push({
      id: "kits",
      name: "Round kits",
      icon: GUN_EFFECTS[likeliest].kit,
      tier: "rare",
      weight: totalOf(kits),
      note: byWeight(kits, KIT_NAMES)
    });
  }
  const keepsRadio = RADIO_PLACES.has(kind);
  if (keepsRadio)
    finds.push({
      id: "radio",
      name: "Radio",
      icon: "radio",
      tier: "rare",
      weight: RADIO_ODDS,
      note: "About one town in two keeps one"
    });
  return finds;
}

/** Best first; among equals, in the order the sources were read. */
function ranked(finds: readonly GuideFind[]): GuideFind[] {
  return [...finds].sort(likelierFirst);
}

/** Two kinds read as one place keep each find at the better of its two tiers. */
function mergeFinds(first: readonly GuideFind[], second: readonly GuideFind[]): GuideFind[] {
  const merged = new Map(first.map((find) => [find.id, find]));
  for (const find of second) {
    const held = merged.get(find.id);
    const isBetter = held === undefined || tierRank(find.tier) < tierRank(held.tier);
    if (isBetter) merged.set(find.id, find);
  }
  return [...merged.values()];
}

/** Floors above and below are only ever seen from inside, so their pages show what is searched there. */
const PICTURES: Partial<Record<PlaceId, GuidePlace["picture"]>> = {
  upstairs: { container: "drawer" },
  cellar: { container: "shelf" },
  cars: { container: "car" }
};

const CONTAINER_ORDER: readonly ContainerKind[] = [
  "bowl",
  "drawer",
  "fridge",
  "cabinet",
  "shelf",
  "locker",
  "box",
  "car",
  "booth"
];

function searchSpots(kinds: readonly Partial<Record<string, ContainerKind>>[]): ContainerKind[] {
  const found = new Set(kinds.flatMap((spots) => Object.values(spots)));
  return CONTAINER_ORDER.filter((kind) => found.has(kind));
}

/** A kitchen's fridges often keep a knife, on top of what its tables hold. */
function kitchenFinds(kind: BuildingKind): GuideFind[] {
  const isKitchen = KITCHENS.has(kind);
  return isKitchen
    ? [
        {
          id: "knife",
          name: FIND_NAMES.knife ?? "Knife",
          icon: "knife",
          tier: stashTier(KITCHEN_KNIFE_ODDS),
          weight: KITCHEN_KNIFE_ODDS
        }
      ]
    : [];
}

/** Halloween night: a home's candy bowl by the front door always holds one. */
function doorstepFinds(kind: BuildingKind): GuideFind[] {
  const hasBowl = DOORSTEP_HOMES.has(kind);
  return hasBowl
    ? [
        {
          id: "candy",
          name: "Candy",
          icon: "candy",
          tier: "always",
          weight: 1,
          note: "In the bowl by the front door"
        }
      ]
    : [];
}

function buildingFinds(kind: BuildingKind): GuideFind[] {
  const inside = mergeFinds(
    [...stockFinds(kind), ...stashFinds(kind, false), ...townFinds(kind)],
    kitchenFinds(kind)
  );
  return mergeFinds(inside, doorstepFinds(kind));
}

/** The street: cars and the crates left by the road. */
function carsPlace(): GuidePlace {
  const radio: GuideFind = {
    id: "radio",
    name: "Radio",
    icon: "radio",
    tier: stashTier(CAR_RADIO_ODDS),
    weight: CAR_RADIO_ODDS,
    note: "Cars only"
  };
  const finds = [...stockFinds("outdoors"), ...stashFinds("outdoors", true), radio];
  return {
    id: "cars",
    name: "Cars & Streets",
    picture: { container: "car" },
    blurb: BLURBS.cars,
    searchIn: searchSpots([OUTDOOR_CONTAINERS]).filter(
      (spot) => spot !== "bowl" && spot !== "booth"
    ),
    finds: ranked(finds)
  };
}

/** The S.O.S. Fireworks bus: fireworks and nothing else, an armful a search, till it sells out. */
function fireworksBusPlace(): GuidePlace {
  const note = `${BOOTH_FIREWORKS} a town, ${FIREWORK_CARRY} at a time`;
  const fireworks: GuideFind = {
    id: "firework",
    name: "Fireworks",
    icon: "firework",
    tier: "always",
    weight: BOOTH_FIREWORKS,
    note
  };
  return {
    id: "fireworks_bus",
    name: "S.O.S. Fireworks",
    picture: { container: "booth" },
    blurb: BLURBS.fireworks_bus,
    searchIn: ["booth"],
    finds: [fireworks]
  };
}

/** Floors read on another kind's page, since their tables differ from it only in a piece or two. */
const SAME_PAGE: Partial<Record<PlaceId, BuildingKind>> = {
  upstairs: "apartment_upstairs",
  hospital: "hospital_upstairs",
  school: "school_upstairs"
};

function buildingPlace(kind: Exclude<PlaceId, "cars" | "fireworks_bus">): GuidePlace {
  const also = SAME_PAGE[kind];
  const finds = also ? mergeFinds(buildingFinds(kind), buildingFinds(also)) : buildingFinds(kind);
  const spots = also ? [ROOM_CONTAINERS[kind], ROOM_CONTAINERS[also]] : [ROOM_CONTAINERS[kind]];
  const hasBowl = DOORSTEP_HOMES.has(kind);
  if (hasBowl) spots.push({ candy_bowl: "bowl" });
  return {
    id: kind,
    name: BUILDING_DEFS[kind].label,
    picture: PICTURES[kind] ?? { building: kind },
    blurb: BLURBS[kind],
    searchIn: searchSpots(spots),
    finds: ranked(finds)
  };
}

/** Every place in the book, in page order. */
export function guidePlaces(): readonly GuidePlace[] {
  return PLACE_ORDER.map((id) => {
    const isStreet = id === "cars";
    if (isStreet) return carsPlace();
    return id === "fireworks_bus" ? fireworksBusPlace() : buildingPlace(id);
  });
}

/** One line of the front index: a find, and the places best for it. */
export interface WhereToLook {
  readonly id: string;
  readonly name: string;
  readonly icon: FindIcon;
  readonly places: readonly { readonly id: PlaceId; readonly name: string }[];
}

/** The finds the index lists, in the order a player goes looking for them. */
const LOOKED_FOR: readonly string[] = [
  "canned_food",
  "water_bottle",
  "disinfectant",
  "antibiotics",
  "medkit",
  "bandage",
  "pistol_ammo",
  "carbine_ammo",
  "shells",
  "carbine",
  "shotgun",
  "knife",
  "fountain",
  "firework",
  "candy",
  "parts",
  "kits",
  "radio"
];
const PLACES_PER_LINE = 3;

/** For each find, the places it turns up most, best tier first, at most three. */
export function whereToLook(places: readonly GuidePlace[] = guidePlaces()): readonly WhereToLook[] {
  return LOOKED_FOR.map((id) => {
    const isMatchingId = (find: GuideFind): boolean => find.id === id;
    const holding = places.flatMap((place) =>
      place.finds.filter(isMatchingId).map((find) => ({ place, find }))
    );
    const best = [...holding]
      .sort((a, b) => likelierFirst(a.find, b.find))
      .slice(0, PLACES_PER_LINE);
    const hasHolding = holding.length > 0;
    if (!hasHolding) {
      return { id, name: id, icon: id as FindIcon, places: [] };
    }
    const { name, icon } = holding[0].find;
    const toPlaceEntry = ({ place }: { place: GuidePlace }) => ({ id: place.id, name: place.name });
    return { id, name, icon, places: best.map(toPlaceEntry) };
  });
}

/** Tips that hold everywhere, from the same numbers the game plays by. */
export const GUIDE_TIPS: readonly string[] = [
  `Any search can turn up an empty bottle, about ${Math.round(BOTTLE_FIND_CHANCE * 100)} times in 100, even when there is nothing else.`,
  `About one car in ${Math.round(1 / CAR_ALARM_CHANCE)} sets its alarm off when searched. Everything nearby hears it.`,
  "Gun parts, round kits and Radios are few to a town. When one turns up, take it.",
  "Your candy bag has no bottom: empty every bowl. X opens it to pick a candy, and eating one already working makes it last longer."
];

export type GuideLeaf =
  | {
      readonly kind: "front";
      readonly id: string;
      readonly head: string;
      readonly color: LeafColor;
    }
  | {
      readonly kind: "index";
      readonly id: string;
      readonly head: string;
      readonly color: LeafColor;
    }
  | {
      readonly kind: "place";
      readonly id: string;
      readonly head: string;
      readonly color: LeafColor;
      readonly place: GuidePlace;
    };

const COLORS: readonly LeafColor[] = ["teal", "tomato", "mustard", "violet", "sky", "pink", "lime"];

/** The front page with its contents, the Where to Look index, then a page per place. */
export function guideLeaves(places: readonly GuidePlace[] = guidePlaces()): readonly GuideLeaf[] {
  const leaves: GuideLeaf[] = [
    { kind: "front", id: "front", head: "Contents", color: "teal" },
    { kind: "index", id: "index", head: "Where to look", color: "tomato" }
  ];
  for (const place of places)
    leaves.push({
      kind: "place",
      id: place.id,
      head: place.name,
      color: COLORS[leaves.length % COLORS.length],
      place
    });
  return leaves;
}

/** The page a place is on, from 1, for the contents and the index. */
export function placePage(id: PlaceId, leaves: readonly GuideLeaf[] = guideLeaves()): number {
  return leaves.findIndex((leaf) => leaf.id === id) + 1;
}

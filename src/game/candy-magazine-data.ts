import type { CandyId } from '../../shared/protocol.ts';
import { CANDIES, CANDY_ORDER, CANDY_SEC, FULL_SIZE_SEC } from '../../shared/candy.ts';
import type { MagazineColor } from './magazine-types.ts';

export const CANDY_MAGAZINE_TITLE = 'Sweet Tooth';
export const CANDY_MAGAZINE_SUBTITLE = 'The Survivor\'s Confectionery Quarterly';
export const CANDY_MAGAZINE_ISSUE = 'Vol. 13: Halloween Trick-or-Treat Edition';
export const CANDY_MAGAZINE_PRICE = 'Free with any empty bag';

export interface NutritionFactRowData {
  readonly name: string;
  readonly amount: string;
  readonly percent?: string;
  readonly bold?: boolean;
}

export interface CandyNutritionData {
  readonly servingSize: string;
  readonly servingsPerContainer: string;
  readonly calories: number;
  readonly facts: readonly NutritionFactRowData[];
  readonly ingredients: string;
}

export interface CandyMagazineReview {
  readonly quote: string;
  readonly author: string;
  readonly stars: number;
}

export interface CandyMagazineStamp {
  readonly text: string;
  readonly tilt: number;
}

export interface CandyMagazineEntry {
  readonly id: CandyId;
  readonly name: string;
  readonly stat: string;
  readonly color: MagazineColor;
  readonly kicker: string;
  readonly deck: string;
  readonly burst: string;
  readonly caption: string;
  readonly boostDescription: string;
  readonly tacticalAdvice: string;
  readonly foundIn: string;
  readonly durationSec: number;
  readonly nutrition: CandyNutritionData;
  readonly review: CandyMagazineReview;
  readonly stamp: CandyMagazineStamp;
}

export const CANDY_ENTRIES: Readonly<Record<CandyId, CandyMagazineEntry>> = {
  sour_skulls: {
    id: 'sour_skulls',
    name: CANDIES.sour_skulls.name,
    stat: CANDIES.sour_skulls.stat,
    color: 'lime',
    kicker: 'Acid dissolution',
    deck: 'Softens up tough infected with corrosive acid rounds.',
    burst: 'ACID COAT!',
    caption: 'Fig. 1: Actual size. Highly abrasive.',
    boostDescription: 'Bullets apply acid corrosion, increasing damage taken by the target by up to 30%.',
    tacticalAdvice: 'Coat heavy brutes and tough bosses so standard gunfire melts their health away.',
    foundIn: 'Bedrooms, diner drawers and front door bowls.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '3 skulls (45g)',
      servingsPerContainer: 'About 6',
      calories: 160,
      facts: [
        { name: 'Total Sugar', amount: '38g', percent: '76%', bold: true },
        { name: 'Corrosive Acid', amount: '12g', percent: '450%', bold: true },
        { name: 'Panic Suppression', amount: '100%', percent: '100%' },
        { name: 'Armor Softening', amount: '+30% dmg', percent: '130%', bold: true },
        { name: 'Enamel Wear', amount: 'Severe', percent: '95%' },
      ],
      ingredients: 'Pure cane sugar, citric acid, battery acid extract, tartaric acid, lime juice concentrate, artificial color Green 3.',
    },
    review: {
      quote: 'Puckered my face so tight the zombie hesitated. Softened a brute up in four shots.',
      author: 'Miller, Gun Shop Owner',
      stars: 5,
    },
    stamp: { text: 'ACID ROUNDS', tilt: -4 },
  },

  fang_taffy: {
    id: 'fang_taffy',
    name: CANDIES.fang_taffy.name,
    stat: CANDIES.fang_taffy.stat,
    color: 'pink',
    kicker: 'Vampiric chew',
    deck: 'Drains life from the fallen straight back into your veins.',
    burst: '+2 HP / KILL!',
    caption: 'Fig. 2: Will pull your fillings out.',
    boostDescription: 'Restores 2 health points instantly for every enemy felled by any weapon or shove.',
    tacticalAdvice: 'Fires up shotgun blasts against tight crowds to refill your health bar without consuming medkits.',
    foundIn: 'Kitchens, diner pantries and apartment counters.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 strip (30g)',
      servingsPerContainer: '1',
      calories: 120,
      facts: [
        { name: 'Total Sugar', amount: '24g', percent: '48%', bold: true },
        { name: 'Taffy Elasticity', amount: '400%', percent: '400%' },
        { name: 'Shove Force', amount: '30 dmg', percent: '200%', bold: true },
        { name: 'Blade Penetration', amount: '110 dmg', percent: '200%', bold: true },
        { name: 'Vampire Essence', amount: 'Trace', percent: '15%' },
      ],
      ingredients: 'Corn syrup, sweetened condensed milk, artificial strawberry flavour, red 40, powdered bat wing.',
    },
    review: {
      quote: 'Pushed a walker into three others and they all went flying. Tastes like real strawberry.',
      author: 'Clara, Scavenger',
      stars: 5,
    },
    stamp: { text: 'HEAVY IMPACT', tilt: 5 },
  },

  ghost_gum: {
    id: 'ghost_gum',
    name: CANDIES.ghost_gum.name,
    stat: CANDIES.ghost_gum.stat,
    color: 'violet',
    kicker: 'Spectral hush',
    deck: 'Run across asphalt without alerting a soul.',
    burst: 'TOTAL SILENCE!',
    caption: 'Fig. 3: Never loses flavour.',
    boostDescription: 'Sprinting makes zero decibels of noise, keeping nearby sleeping infected undisturbed.',
    tacticalAdvice: 'Cross wide avenue intersections or raid convenience stores at top sprint speed.',
    foundIn: 'Pantry shelves, bedroom nightstands and front porch bowls.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 pieces (6g)',
      servingsPerContainer: '10',
      calories: 15,
      facts: [
        { name: 'Total Sugar', amount: '3g', percent: '6%', bold: true },
        { name: 'Decibels Generated', amount: '0 dB', percent: '0%', bold: true },
        { name: 'Ectoplasm Blend', amount: '850mg', percent: '85%' },
        { name: 'Bubble Size', amount: 'Enormous', percent: '150%' },
        { name: 'Stealth Rating', amount: 'Silent', percent: '100%', bold: true },
      ],
      ingredients: 'Gum base, xylitol, natural peppermint, poltergeist mist, ghostly essence, confectioner glaze.',
    },
    review: {
      quote: 'Ran right behind a brute in full sprint. Didn\'t even turn around.',
      author: 'Vic, Scout',
      stars: 5,
    },
    stamp: { text: 'ZERO NOISE', tilt: -3 },
  },

  pumpkin_fizz: {
    id: 'pumpkin_fizz',
    name: CANDIES.pumpkin_fizz.name,
    stat: CANDIES.pumpkin_fizz.stat,
    color: 'mustard',
    kicker: 'Citric overdrive',
    deck: 'One effervescent gulp halves your time behind the barrel.',
    burst: '2X RELOAD!',
    caption: 'Fig. 4: Explosive carbonation inside.',
    boostDescription: 'Cuts firearm reload duration by 50% across pistol, carbine and shotgun.',
    tacticalAdvice: 'Pop one when shotgun shells or carbine drum reloads would otherwise leave you pinned.',
    foundIn: 'Kitchen counters, school lockers and front porch bowls.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 pouch (25g)',
      servingsPerContainer: '1',
      calories: 90,
      facts: [
        { name: 'Total Sugar', amount: '22g', percent: '44%', bold: true },
        { name: 'Carbonated Fizz', amount: 'High', percent: '300%' },
        { name: 'Reload Acceleration', amount: '2x speed', percent: '200%', bold: true },
        { name: 'Jittery Fingers', amount: 'Extreme', percent: '150%' },
        { name: 'Burp Volume', amount: 'Loud', percent: '80%' },
      ],
      ingredients: 'Sugar, sodium bicarbonate, citric acid, pumpkin spice blend, orange 6, carbonated sugar crystals.',
    },
    review: {
      quote: 'Poured a packet down the hatch. Had the carbine drum reloaded before the shell hit the ground.',
      author: 'Officer Hayes',
      stars: 4,
    },
    stamp: { text: '2X SPEED', tilt: 6 },
  },

  witchs_brittle: {
    id: 'witchs_brittle',
    name: CANDIES.witchs_brittle.name,
    stat: CANDIES.witchs_brittle.stat,
    color: 'violet',
    kicker: 'Hexed momentum',
    deck: 'Five times the window to keep score multipliers burning.',
    burst: '5X CHAIN!',
    caption: 'Fig. 5: Jagged shards of dark molasses.',
    boostDescription: 'Extends kill chain timer from 1.4 seconds to 7.0 seconds between hits.',
    tacticalAdvice: 'Crucial for arcade mode high-score runs and carrying combos between city blocks.',
    foundIn: 'Cellars, upstairs bedrooms and apothecary drawers.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 brittle shard (40g)',
      servingsPerContainer: '3',
      calories: 190,
      facts: [
        { name: 'Total Sugar', amount: '28g', percent: '56%', bold: true },
        { name: 'Combo Retention', amount: '7.0 sec', percent: '500%', bold: true },
        { name: 'Dark Magic', amount: '666mg', percent: '66%' },
        { name: 'Tooth Hazards', amount: 'Extreme', percent: '250%' },
        { name: 'Peanut Shards', amount: '14g', percent: '28%' },
      ],
      ingredients: 'Cane sugar, molasses, roasted peanut shards, cauldron broth, pulverized toadstool, black treacle.',
    },
    review: {
      quote: 'Held a thirty-kill chain all the way across town to the diner. Kept the multiplier pinned.',
      author: 'Doc Martin',
      stars: 5,
    },
    stamp: { text: 'LONG CHAIN', tilt: -5 },
  },

  bat_bites: {
    id: 'bat_bites',
    name: CANDIES.bat_bites.name,
    stat: CANDIES.bat_bites.stat,
    color: 'tomato',
    kicker: 'Over-penetration',
    deck: 'One round tears through the first infected and strikes the next.',
    burst: '+1 PIERCE!',
    caption: 'Fig. 6: Rubbery, aerodynamic wings.',
    boostDescription: 'Bullets penetrate through their first target and punch into the zombie standing directly behind.',
    tacticalAdvice: 'Doubles ammo value in narrow hallways, motel corridors and tight alleyways.',
    foundIn: 'Grocery shelves, discount store bins and bedroom dressers.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '5 bats (35g)',
      servingsPerContainer: '4',
      calories: 130,
      facts: [
        { name: 'Total Sugar', amount: '26g', percent: '52%', bold: true },
        { name: 'Ballistic Penetration', amount: '+1 body', percent: '200%', bold: true },
        { name: 'Chewiness', amount: 'Rubbery', percent: '180%' },
        { name: 'Echo Location', amount: 'Inactive', percent: '0%' },
        { name: 'Gelatin Strength', amount: 'Armor grade', percent: '100%' },
      ],
      ingredients: 'Corn syrup, sugar, beef gelatin, concentrated grape juice, fruit pectin, nocturnal adrenaline.',
    },
    review: {
      quote: 'Lined up five walkers in an alley. Three carbine taps dropped the whole column.',
      author: 'Sarah, Sniper',
      stars: 5,
    },
    stamp: { text: 'PIERCING', tilt: 4 },
  },

  corn_rush: {
    id: 'corn_rush',
    name: CANDIES.corn_rush.name,
    stat: CANDIES.corn_rush.stat,
    color: 'mustard',
    kicker: 'Sugar rush sprint',
    deck: 'A quarter faster on your feet from the first tri-color kernel.',
    burst: '+25% SPEED!',
    caption: 'Fig. 7: The tri-color survivor staple.',
    boostDescription: 'Boosts both walking and sprinting movement speed by 25%.',
    tacticalAdvice: 'Outpaces fast crawler packs and sprinter zombies during sudden street ambushes.',
    foundIn: 'Every doorstep bowl in town without fail.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '19 kernels (40g)',
      servingsPerContainer: '5',
      calories: 140,
      facts: [
        { name: 'Total Sugar', amount: '32g', percent: '64%', bold: true },
        { name: 'Escape Velocity', amount: '+25%', percent: '125%', bold: true },
        { name: 'Pure Dextrose', amount: '100%', percent: '100%' },
        { name: 'Carnauba Wax', amount: 'Shiny', percent: '45%' },
        { name: 'Nostalgia Factor', amount: 'Maximum', percent: '100%' },
      ],
      ingredients: 'Sugar, corn syrup, confectioner glaze, honey, yellow 5, yellow 6, red 3, carnauba wax.',
    },
    review: {
      quote: 'Chewed a fistful of candy corn and ran circles around the horde. Never felt lighter.',
      author: 'Leo, Score Chaser',
      stars: 4,
    },
    stamp: { text: 'SPEED BURST', tilt: -6 },
  },

  jawbreaker: {
    id: 'jawbreaker',
    name: CANDIES.jawbreaker.name,
    stat: CANDIES.jawbreaker.stat,
    color: 'sky',
    kicker: 'Solid enamel',
    deck: 'Shrugs off bites, claws and blunt strikes like rain.',
    burst: '-50% DAMAGE!',
    caption: 'Fig. 8: Impenetrable sugar core.',
    boostDescription: 'Cuts incoming damage taken from all enemy attacks in half.',
    tacticalAdvice: 'Essential protection before entering narrow cellars or tight garage corners.',
    foundIn: 'Homes, discount stores and school lockers.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 sphere (60g)',
      servingsPerContainer: '1 (takes 3 hours)',
      calories: 220,
      facts: [
        { name: 'Total Sugar', amount: '56g', percent: '112%', bold: true },
        { name: 'Impact Resistance', amount: '-50% dmg', percent: '50%', bold: true },
        { name: 'Hardness Score', amount: '9.5 Mohs', percent: '95%' },
        { name: 'Dental Risk', amount: 'Severe', percent: '400%' },
        { name: 'Titanium Shell', amount: 'Trace', percent: '10%' },
      ],
      ingredients: 'Pure dextrose, artificial colors, titanium dioxide, carnauba wax, crystallized diamond dust.',
    },
    review: {
      quote: 'Took a brute right hook to the ribs and barely stumbled. Worth every molar.',
      author: 'Frank, Bouncer',
      stars: 5,
    },
    stamp: { text: 'HEAVY ARMOR', tilt: 3 },
  },

  licorice_lash: {
    id: 'licorice_lash',
    name: CANDIES.licorice_lash.name,
    stat: CANDIES.licorice_lash.stat,
    color: 'teal',
    kicker: 'Whip-crack melee',
    deck: 'Turns polite shoves and knife strikes into lethal skull crackers.',
    burst: '2X MELEE!',
    caption: 'Fig. 9: Pitch black anise twists.',
    boostDescription: 'Doubles damage dealt by shoving (bare hands) and knife stabbing.',
    tacticalAdvice: 'Conserves ammunition against wandering walkers; drops standard zombies in one quiet strike.',
    foundIn: 'Old pantries, diner booths and pharmacy counters.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 laces (38g)',
      servingsPerContainer: '4',
      calories: 130,
      facts: [
        { name: 'Total Sugar', amount: '18g', percent: '36%', bold: true },
        { name: 'Shove Force', amount: '30 dmg', percent: '200%', bold: true },
        { name: 'Blade Penetration', amount: '110 dmg', percent: '200%', bold: true },
        { name: 'Anise Concentration', amount: 'Heavy', percent: '200%' },
        { name: 'Whiplash Power', amount: '2x impact', percent: '200%' },
      ],
      ingredients: 'Molasses, wheat flour, licorice root extract, anise seed oil, charcoal black, salt.',
    },
    review: {
      quote: 'Whipped a walker into three others and they all went flying. Tastes sharp and hits harder.',
      author: 'Renee, Tracker',
      stars: 5,
    },
    stamp: { text: '2X MELEE', tilt: -4 },
  },

  caramel_apple: {
    id: 'caramel_apple',
    name: CANDIES.caramel_apple.name,
    stat: CANDIES.caramel_apple.stat,
    color: 'tomato',
    kicker: 'Second wind',
    deck: 'Defies the reaper once with a stick and fresh caramel.',
    burst: 'SECOND LIFE!',
    caption: 'Fig. 10: Includes sturdy birch handle.',
    boostDescription: 'If your health drops to zero while active, revive immediately with 30% health.',
    tacticalAdvice: 'The ultimate survival insurance policy before storming siren horde events.',
    foundIn: 'Kitchen fridges, upstairs bedrooms and diner kitchens.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 apple (120g)',
      servingsPerContainer: '1',
      calories: 310,
      facts: [
        { name: 'Total Sugar', amount: '45g', percent: '90%', bold: true },
        { name: 'Resurrection Chance', amount: '100%', percent: '100%', bold: true },
        { name: 'Stand-up Health', amount: '30% max', percent: '30%', bold: true },
        { name: 'Dietary Fiber', amount: '4g', percent: '16%' },
        { name: 'Caramel Stickiness', amount: 'Maximum', percent: '350%' },
      ],
      ingredients: 'Crisp green apple, heavy cream, brown sugar, butter, wooden stick, stubborn survival instinct.',
    },
    review: {
      quote: 'Got dragged down in the dark. Thought I was done for until the sugar kicked in.',
      author: 'Tom, Courier',
      stars: 5,
    },
    stamp: { text: 'REVIVAL', tilt: 5 },
  },

  popping_eyeballs: {
    id: 'popping_eyeballs',
    name: CANDIES.popping_eyeballs.name,
    stat: CANDIES.popping_eyeballs.stat,
    color: 'lime',
    kicker: 'Pyrotechnic pop',
    deck: 'Throws burning fireworks sparks half as far again.',
    burst: '+50% RANGE!',
    caption: 'Fig. 11: Filled with fizzy jelly.',
    boostDescription: 'Sparks thrown by firework spinners cover 50% more ground distance.',
    tacticalAdvice: 'Pair with fireworks to clear out whole street crossings and parking lots.',
    foundIn: 'Discount stores, garages and upstairs bedrooms.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 eyeballs (30g)',
      servingsPerContainer: '3',
      calories: 105,
      facts: [
        { name: 'Total Sugar', amount: '20g', percent: '40%', bold: true },
        { name: 'Spark Radius', amount: '+50%', percent: '150%', bold: true },
        { name: 'Popping Crystals', amount: 'Crackling', percent: '250%' },
        { name: 'Gummy Sclera', amount: 'Chewy', percent: '80%' },
        { name: 'Spatter Hazard', amount: 'Present', percent: '100%' },
      ],
      ingredients: 'Glucose syrup, sugar, gelatin, popping candy, marshmallow paste, citric acid, food coloring.',
    },
    review: {
      quote: 'Lit one spinner in the town square and the shower of sparks reached the porch steps.',
      author: 'Gabe, Demolitions',
      stars: 5,
    },
    stamp: { text: 'BIG SPARK', tilt: -3 },
  },

  fireballs: {
    id: 'fireballs',
    name: CANDIES.fireballs.name,
    stat: CANDIES.fireballs.stat,
    color: 'tomato',
    kicker: 'Incendiary fuel',
    deck: 'Ignites every bullet leaving your gun barrel with fiery rage.',
    burst: 'INCENDIARY!',
    caption: 'Fig. 12: Hot to the touch.',
    boostDescription: 'Every gun shot becomes an incendiary flame round, setting zombies ablaze.',
    tacticalAdvice: 'Ignited zombies spread flames to nearby pack members, burning crowds over time.',
    foundIn: 'Upstairs bedrooms, cellars and discount shops.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '4 balls (32g)',
      servingsPerContainer: '5',
      calories: 120,
      facts: [
        { name: 'Total Sugar', amount: '30g', percent: '60%', bold: true },
        { name: 'Thermal Radiance', amount: '1,000,000 SHU', percent: '500%', bold: true },
        { name: 'Ignition Chance', amount: '100% on hit', percent: '100%', bold: true },
        { name: 'Cinnamon Heat', amount: 'Extreme', percent: '300%' },
        { name: 'Tongue Blisters', amount: 'Guaranteed', percent: '100%' },
      ],
      ingredients: 'Sugar, modified food starch, artificial cinnamon flavor, carnauba wax, gum arabic, pure liquid fire.',
    },
    review: {
      quote: 'Turned a pitch black parking lot into daylight with one pistol magazine.',
      author: 'Dan, Patrol',
      stars: 5,
    },
    stamp: { text: 'FLAME ROUNDS', tilt: 4 },
  },

  full_size_bar: {
    id: 'full_size_bar',
    name: CANDIES.full_size_bar.name,
    stat: CANDIES.full_size_bar.stat,
    color: 'mustard',
    kicker: 'The grand prize',
    deck: 'Half the power of every other sweet packed into twenty glorious seconds.',
    burst: 'ALL-IN-ONE!',
    caption: 'Fig. 13: Full king size. Unopened.',
    boostDescription: 'Grants 50% power of all twelve other candies simultaneously for 20 seconds.',
    tacticalAdvice: 'Unleash when surrounded during final horde extractions to become unstoppable.',
    foundIn: 'Rarely in upstairs bedrooms and locked house safe boxes.',
    durationSec: FULL_SIZE_SEC,
    nutrition: {
      servingSize: '1 bar (85g)',
      servingsPerContainer: '1',
      calories: 480,
      facts: [
        { name: 'Total Sugar', amount: '54g', percent: '108%', bold: true },
        { name: 'Saturated Fat', amount: '12g', percent: '60%' },
        { name: 'Omni-Boost Power', amount: '50% all stats', percent: '600%', bold: true },
        { name: 'Pure Triumph', amount: '100%', percent: '100%', bold: true },
        { name: 'Survivor Morale', amount: 'Sky high', percent: '500%' },
      ],
      ingredients: 'Milk chocolate, roasted peanuts, caramel, nougat, enriched flour, survivor tears, pure triumph.',
    },
    review: {
      quote: 'Popped this when the siren roared. Felt like a freight train on fire.',
      author: 'Commander Vance',
      stars: 5,
    },
    stamp: { text: 'GRAND PRIZE', tilt: -5 },
  },

  skull_pops: {
    id: 'skull_pops',
    name: CANDIES.skull_pops.name,
    stat: CANDIES.skull_pops.stat,
    color: 'sky',
    kicker: 'True aim',
    deck: 'Broadens critical hit zones for snappy headshots.',
    burst: 'SWEET SPOT!',
    caption: 'Fig. 14: Sweet skull on a stick.',
    boostDescription: 'Expands headshot hitboxes by 3 pixels margin, landing critical decaps with ease.',
    tacticalAdvice: 'Saves valuable pistol and rifle ammunition by guaranteeing one-tap skull fractures.',
    foundIn: 'Classrooms, bedroom dressers and front door bowls.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 pop (22g)',
      servingsPerContainer: '1',
      calories: 85,
      facts: [
        { name: 'Total Sugar', amount: '19g', percent: '38%', bold: true },
        { name: 'Headshot Margin', amount: '+3 px', percent: '150%', bold: true },
        { name: 'Targeting Clarity', amount: 'Laser sharp', percent: '200%' },
        { name: 'Bone Meal Sweetness', amount: '500mg', percent: '10%' },
        { name: 'Stick Durability', amount: 'Birch wood', percent: '100%' },
      ],
      ingredients: 'Corn syrup, sugar, powdered bone sugar, natural flavors, titanium dioxide, carnauba wax.',
    },
    review: {
      quote: 'Sucked on this pop and every walker head looked twice as wide. Clean decaps all night.',
      author: 'Renee, Tracker',
      stars: 5,
    },
    stamp: { text: 'EASY CRITS', tilt: 4 },
  },

  frost_bites: {
    id: 'frost_bites',
    name: CANDIES.frost_bites.name,
    stat: CANDIES.frost_bites.stat,
    color: 'teal',
    kicker: 'Absolute zero',
    deck: 'Chills the undead in their tracks with sub-zero impacts.',
    burst: 'DEEP FREEZE!',
    caption: 'Fig. 15: Sub-zero peppermint drops.',
    boostDescription: 'Bullets chill zombies, reducing move speed by 50% for 3 seconds.',
    tacticalAdvice: 'Keeps fast runners and ferocious brutes at a safe, manageable distance.',
    foundIn: 'Clinic fridges and supermarket freezers.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '4 drops (20g)',
      servingsPerContainer: '5',
      calories: 70,
      facts: [
        { name: 'Total Sugar', amount: '16g', percent: '32%', bold: true },
        { name: 'Cryo Stasis', amount: '-50% speed', percent: '150%', bold: true },
        { name: 'Glacial Menthol', amount: '1200mg', percent: '300%' },
        { name: 'Frostbite Risk', amount: 'Mild', percent: '15%' },
        { name: 'Breath Freshness', amount: 'Frigid', percent: '200%' },
      ],
      ingredients: 'Sugar, glucose, natural peppermint oil, glacial crystals, menthol, blue 1, wintergreen extract.',
    },
    review: {
      quote: 'Tagged a brute in full sprint. He slowed down like he was wading through molasses.',
      author: 'Jax, Gunner',
      stars: 5,
    },
    stamp: { text: 'CHILL FACTOR', tilt: -3 },
  },

  cherry_bombs: {
    id: 'cherry_bombs',
    name: CANDIES.cherry_bombs.name,
    stat: CANDIES.cherry_bombs.stat,
    color: 'tomato',
    kicker: 'Flesh firecracker',
    deck: 'Pop a head and watch the crowd scatter in crimson bursts.',
    burst: 'BOOM!',
    caption: 'Fig. 16: Two sweet cherry explosives.',
    boostDescription: 'Headshot kills trigger a localized flesh burst damaging adjacent zombies.',
    tacticalAdvice: 'Aim for the center walker in a packed crowd to trigger devastating collateral damage.',
    foundIn: 'Diner kitchens and fireworks booths.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 cherries (30g)',
      servingsPerContainer: '3',
      calories: 110,
      facts: [
        { name: 'Total Sugar', amount: '25g', percent: '50%', bold: true },
        { name: 'Blast Radius', amount: '36 px', percent: '100%', bold: true },
        { name: 'Explosive Yield', amount: '35 dmg', percent: '140%', bold: true },
        { name: 'Cherry Concentrate', amount: '15%', percent: '30%' },
        { name: 'Fuse Spark', amount: 'Live', percent: '100%' },
      ],
      ingredients: 'Cane sugar, tart cherry juice concentrate, gunpowder syrup, red 40, citric acid, edible sulfur.',
    },
    review: {
      quote: 'Popped one walker head and three others behind him fell over like bowling pins.',
      author: 'Boomer Bob',
      stars: 5,
    },
    stamp: { text: 'FLESH BURST', tilt: 5 },
  },

  shock_tarts: {
    id: 'shock_tarts',
    name: CANDIES.shock_tarts.name,
    stat: CANDIES.shock_tarts.stat,
    color: 'mustard',
    kicker: 'High voltage',
    deck: 'Hair-trigger speed on every trigger pull.',
    burst: 'OVERDRIVE!',
    caption: 'Fig. 17: Tart sour lightning candy.',
    boostDescription: 'Increases firearm rate of fire by 30%.',
    tacticalAdvice: 'Turns standard pistols and carbines into rapid bullet hoses.',
    foundIn: 'School lockers and garage toolboxes.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '6 wafers (30g)',
      servingsPerContainer: '4',
      calories: 115,
      facts: [
        { name: 'Total Sugar', amount: '27g', percent: '54%', bold: true },
        { name: 'Trigger Velocity', amount: '+30%', percent: '130%', bold: true },
        { name: 'Static Charge', amount: '10,000V', percent: '500%' },
        { name: 'Sour Malic Acid', amount: '1500mg', percent: '250%' },
        { name: 'Electrolyte Punch', amount: 'High', percent: '120%' },
      ],
      ingredients: 'Dextrose, malic acid, electric tartaric salts, calcium stearate, yellow 5 lake, artificial electric zest.',
    },
    review: {
      quote: 'Pistol was spitting lead faster than a submachine gun. Electric kick down to the toes.',
      author: 'Silas, Pointman',
      stars: 4,
    },
    stamp: { text: 'RAPID FIRE', tilt: -6 },
  },

  glow_worms: {
    id: 'glow_worms',
    name: CANDIES.glow_worms.name,
    stat: CANDIES.glow_worms.stat,
    color: 'lime',
    kicker: 'Night beacon',
    deck: 'Pierces the fog of night with brilliant radiance.',
    burst: 'LIGHT UP!',
    caption: 'Fig. 18: Bioluminescent neon chews.',
    boostDescription: 'Doubles flashlight beam radius and illuminates zombies through darkness.',
    tacticalAdvice: 'Invaluable during Blackout nights or dense mist.',
    foundIn: 'Camping trailers and bedroom nightstands.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '3 worms (42g)',
      servingsPerContainer: '4',
      calories: 140,
      facts: [
        { name: 'Total Sugar', amount: '28g', percent: '56%', bold: true },
        { name: 'Lumens Generated', amount: '2x reach', percent: '200%', bold: true },
        { name: 'Luciferin Extract', amount: '800mg', percent: '160%' },
        { name: 'Night Vision Gain', amount: 'Crisp', percent: '100%' },
        { name: 'Glow Persistence', amount: 'Vibrant', percent: '180%' },
      ],
      ingredients: 'Corn syrup, gelatin, bioluminescent moss extract, riboflavin, citric acid, natural lime flavor.',
    },
    review: {
      quote: 'Turned a pitch-black parking lot into broad daylight. Spotted three screamers early.',
      author: 'Nora, Lookout',
      stars: 5,
    },
    stamp: { text: '2X BEAM', tilt: 3 },
  },

  sticky_fingers: {
    id: 'sticky_fingers',
    name: CANDIES.sticky_fingers.name,
    stat: CANDIES.sticky_fingers.stat,
    color: 'mustard',
    kicker: 'Fast scrounger',
    deck: 'Rummage through furniture in the blink of an eye.',
    burst: 'QUICK HANDS!',
    caption: 'Fig. 19: Gooey caramel scrounge sticks.',
    boostDescription: 'Halves container search duration for rapid looting.',
    tacticalAdvice: 'Raid entire houses and apartment complexes in record time.',
    foundIn: 'Discount stores and pawn shop drawers.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 bars (36g)',
      servingsPerContainer: '3',
      calories: 160,
      facts: [
        { name: 'Total Sugar', amount: '22g', percent: '44%', bold: true },
        { name: 'Search Acceleration', amount: '-50% time', percent: '200%', bold: true },
        { name: 'Tactile Adhesion', amount: 'Very high', percent: '350%' },
        { name: 'Pocket Clutter', amount: 'Heavy', percent: '90%' },
        { name: 'Caramel Pull', amount: 'Taffy grade', percent: '120%' },
      ],
      ingredients: 'Caramel, condensed milk, molasses, wheat flour, salt, artificial vanilla, butterfat.',
    },
    review: {
      quote: 'Cleaned out a six-drawer dresser in five seconds flat while the horde was banging on the front door.',
      author: 'Fingers McGee',
      stars: 4,
    },
    stamp: { text: 'FAST LOOT', tilt: -4 },
  },

  deadeye_drops: {
    id: 'deadeye_drops',
    name: CANDIES.deadeye_drops.name,
    stat: CANDIES.deadeye_drops.stat,
    color: 'sky',
    kicker: 'Bullseye drops',
    deck: 'Tames bullet scatter into laser accuracy.',
    burst: 'PINPOINT!',
    caption: 'Fig. 20: Crosshair stamped hard lozenges.',
    boostDescription: 'Eliminates weapon spread for laser precision and ultra-tight shotgun patterns.',
    tacticalAdvice: 'Turns shotguns into heavy slug cannons at medium range.',
    foundIn: 'Police armories and gun shop counters.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '3 lozenges (18g)',
      servingsPerContainer: '6',
      calories: 60,
      facts: [
        { name: 'Total Sugar', amount: '15g', percent: '30%', bold: true },
        { name: 'Spread Reduction', amount: '100%', percent: '100%', bold: true },
        { name: 'Ballistic Stability', amount: 'Absolute', percent: '250%' },
        { name: 'Optic Caliber', amount: 'Telescopic', percent: '180%' },
        { name: 'Steadiness', amount: 'Rock solid', percent: '200%' },
      ],
      ingredients: 'Sugar, peppermint oil, target starch, zinc oxide, gum arabic, micro-crosshairs.',
    },
    review: {
      quote: 'Buckshot flew tighter than a rifle bullet. Dropped three walkers in three clean blasts.',
      author: 'Gunnar, Marshal',
      stars: 5,
    },
    stamp: { text: 'ZERO SPREAD', tilt: 5 },
  },

  monster_mash: {
    id: 'monster_mash',
    name: CANDIES.monster_mash.name,
    stat: CANDIES.monster_mash.stat,
    color: 'lime',
    kicker: 'Heavy impact',
    deck: 'Hits that send the dead sailing down the street.',
    burst: 'WALLOP!',
    caption: 'Fig. 21: Spiked gummy knuckles.',
    boostDescription: 'Strikes and shots deliver triple knockback force against enemies.',
    tacticalAdvice: 'Create huge breathing room when cornered against walls.',
    foundIn: 'Gym lockers and garage workbenches.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 knuckles (45g)',
      servingsPerContainer: '2',
      calories: 150,
      facts: [
        { name: 'Total Sugar', amount: '30g', percent: '60%', bold: true },
        { name: 'Knockback Force', amount: '3x distance', percent: '300%', bold: true },
        { name: 'Kinetic Momentum', amount: 'Crushing', percent: '250%' },
        { name: 'Gummy Resilience', amount: 'High', percent: '110%' },
        { name: 'Brawler Energy', amount: 'Pugilist', percent: '200%' },
      ],
      ingredients: 'Corn syrup, gelatin, sour apple juice, creatine monohydrate, malic acid, green 3.',
    },
    review: {
      quote: 'Shoved a walker so hard he slid twenty feet backward into a mailbox. Glorious.',
      author: 'Tiny, Brawler',
      stars: 5,
    },
    stamp: { text: '3X KNOCKBACK', tilt: -5 },
  },

  everlasting_chews: {
    id: 'everlasting_chews',
    name: CANDIES.everlasting_chews.name,
    stat: CANDIES.everlasting_chews.stat,
    color: 'pink',
    kicker: 'Bottomless chew',
    deck: 'Every fourth round is on the house.',
    burst: 'FREE ROUNDS!',
    caption: 'Fig. 22: Concentric multi-colored jawbreaker.',
    boostDescription: '25% chance that fired shots consume no ammunition.',
    tacticalAdvice: 'Extends precious carbine and shotgun reserve ammunition indefinitely.',
    foundIn: 'Toy stores and front porch candy pails.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 ball (50g)',
      servingsPerContainer: '1',
      calories: 180,
      facts: [
        { name: 'Total Sugar', amount: '42g', percent: '84%', bold: true },
        { name: 'Ammo Conservation', amount: '25% free', percent: '125%', bold: true },
        { name: 'Layer Count', amount: '64 layers', percent: '640%' },
        { name: 'Endurance', amount: 'Infinite chew', percent: '500%' },
        { name: 'Salivation', amount: 'Copious', percent: '150%' },
      ],
      ingredients: 'Sugar, corn syrup, carnauba wax, titanium dioxide, red 40, yellow 5, blue 1, everlasting essence.',
    },
    review: {
      quote: 'Fired forty shotgun shells and my ammo pouch was still half full. Magic candy.',
      author: 'Buck, Farmer',
      stars: 5,
    },
    stamp: { text: '25% AMMO SAVE', tilt: 4 },
  },

  spiky_suckers: {
    id: 'spiky_suckers',
    name: CANDIES.spiky_suckers.name,
    stat: CANDIES.spiky_suckers.stat,
    color: 'violet',
    kicker: 'Barbed retaliator',
    deck: 'Zombies that swing at you get punctured back.',
    burst: 'RETALIATE!',
    caption: 'Fig. 23: Spiked prickly berry hard pop.',
    boostDescription: 'Melee hits from zombies reflect 40 damage and stumble the attacker.',
    tacticalAdvice: 'Safe insurance when navigating tight hallways swarming with crawlers.',
    foundIn: 'Hospital storage and clinic cabinets.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 sucker (28g)',
      servingsPerContainer: '1',
      calories: 95,
      facts: [
        { name: 'Total Sugar', amount: '21g', percent: '42%', bold: true },
        { name: 'Thorns Retaliation', amount: '40 dmg', percent: '200%', bold: true },
        { name: 'Prickly Spikes', amount: 'Sharp', percent: '180%' },
        { name: 'Tongue Tingling', amount: 'Stinging', percent: '140%' },
        { name: 'Bramble Extract', amount: '750mg', percent: '75%' },
      ],
      ingredients: 'Sugar, blackberry concentrate, thorny bramble juice, citric acid, purple carrot juice, salt.',
    },
    review: {
      quote: 'A walker clawed my arm and immediately keeled over clutching his face. Karma on a stick.',
      author: 'Maya, Medic',
      stars: 5,
    },
    stamp: { text: '40 THORNS', tilt: -3 },
  },

  boom_drops: {
    id: 'boom_drops',
    name: CANDIES.boom_drops.name,
    stat: CANDIES.boom_drops.stat,
    color: 'tomato',
    kicker: 'Demolition burst',
    deck: 'Toss ordnance further with colossal explosions.',
    burst: 'BIG BOOM!',
    caption: 'Fig. 24: High-yield gunpowder licorice.',
    boostDescription: 'Throwables gain +50% throw distance and +35% blast radius.',
    tacticalAdvice: 'Clear entire streets with wide-arc spinners and devastating molotovs.',
    foundIn: 'Fireworks buses and military checkpoints.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '3 pellets (24g)',
      servingsPerContainer: '4',
      calories: 90,
      facts: [
        { name: 'Total Sugar', amount: '18g', percent: '36%', bold: true },
        { name: 'Throw Distance', amount: '+50%', percent: '150%', bold: true },
        { name: 'Blast Radius', amount: '+35%', percent: '135%', bold: true },
        { name: 'Sulfur Notes', amount: 'Pungent', percent: '120%' },
        { name: 'Combustion Index', amount: 'Dangerous', percent: '250%' },
      ],
      ingredients: 'Blackstrap molasses, saltpeter sugar, charcoal dust, cinnamon oil, cayenne pepper, red iron oxide.',
    },
    review: {
      quote: 'Threw a spinner across a four-lane avenue. The spark ring engulfed the entire intersection.',
      author: 'Sparks, Pyrotech',
      stars: 5,
    },
    stamp: { text: 'HEAVY ORDNANCE', tilt: 5 },
  },

  grave_gels: {
    id: 'grave_gels',
    name: CANDIES.grave_gels.name,
    stat: CANDIES.grave_gels.stat,
    color: 'teal',
    kicker: 'Mortal repair',
    deck: 'Steady soothing vitality on the march.',
    burst: 'RESTORE!',
    caption: 'Fig. 25: Tombstone shaped herbal pectin gummy.',
    boostDescription: 'Passively restores 1 health every 3 seconds while walking or resting.',
    tacticalAdvice: 'Saves valuable medkits between horde encounters.',
    foundIn: 'Pharmacy shelves and hospital emergency bays.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '2 tombstones (32g)',
      servingsPerContainer: '3',
      calories: 100,
      facts: [
        { name: 'Total Sugar', amount: '20g', percent: '40%', bold: true },
        { name: 'Cellular Regen', amount: '+1 HP / 3s', percent: '150%', bold: true },
        { name: 'Medicinal Herbs', amount: '900mg', percent: '90%' },
        { name: 'Restorative Pectin', amount: 'High', percent: '100%' },
        { name: 'Calming Aloe', amount: 'Soothing', percent: '120%' },
      ],
      ingredients: 'Pectin, fruit juice blend, aloe vera, willow bark extract, vitamin C, zinc gluconate, green tea leaf.',
    },
    review: {
      quote: 'Patched up all my scratches just by walking two blocks to the next safehouse.',
      author: 'Tess, Survivor',
      stars: 5,
    },
    stamp: { text: 'HEALTH REGEN', tilt: -4 },
  },

  scatter_skittles: {
    id: 'scatter_skittles',
    name: CANDIES.scatter_skittles.name,
    stat: CANDIES.scatter_skittles.stat,
    color: 'tomato',
    kicker: 'Cluster volley',
    deck: 'An extra lead greeting with every single trigger pull.',
    burst: 'VOLLEY!',
    caption: 'Fig. 26: Multi-colored burst dragées.',
    boostDescription: 'Every weapon discharge fires an additional bullet or pellet.',
    tacticalAdvice: 'Drastically multiplies shotgun pellet count and carbine DPS.',
    foundIn: 'Supermarket checkout aisles and convenience shelves.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '25 lentils (35g)',
      servingsPerContainer: '2',
      calories: 140,
      facts: [
        { name: 'Total Sugar', amount: '31g', percent: '62%', bold: true },
        { name: 'Extra Projectile', amount: '+1 round', percent: '200%', bold: true },
        { name: 'Rainbow Blend', amount: '5 flavors', percent: '100%' },
        { name: 'Pellet Saturation', amount: 'Maximum', percent: '250%' },
        { name: 'Shell Crunch', amount: 'Crisp', percent: '80%' },
      ],
      ingredients: 'Sugar, corn syrup, hydrogenated palm kernel oil, citric acid, tapioca dextrin, modified corn starch.',
    },
    review: {
      quote: 'Pistol double-tapped on single clicks. Shotgun blew through crowds like a snowplow.',
      author: 'Gunner Gus',
      stars: 5,
    },
    stamp: { text: '+1 BULLET', tilt: 4 },
  },

  cadaver_chews: {
    id: 'cadaver_chews',
    name: CANDIES.cadaver_chews.name,
    stat: CANDIES.cadaver_chews.stat,
    color: 'lime',
    kicker: 'Putrid disguise',
    deck: 'Smell like one of them to walk unnoticed.',
    burst: 'CAMOUFLAGE!',
    caption: 'Fig. 27: Mold-ripened zombie chew chunk.',
    boostDescription: 'Reduces zombie detection radius by 50% and makes them lose your trail faster.',
    tacticalAdvice: 'Slip through packed outdoor plazas without triggering screamers.',
    foundIn: 'Cellars, damp basements and morgues.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 chunk (30g)',
      servingsPerContainer: '2',
      calories: 110,
      facts: [
        { name: 'Total Sugar', amount: '18g', percent: '36%', bold: true },
        { name: 'Scent Camouflage', amount: '-50% range', percent: '200%', bold: true },
        { name: 'Decomp Notes', amount: 'Pungent', percent: '400%' },
        { name: 'Stomach Fortitude', amount: 'Ironclad', percent: '100%' },
        { name: 'Mold Cultures', amount: 'Live', percent: '50%' },
      ],
      ingredients: 'Corn syrup, gelatin, aged blue cheese powder, black fungus, peat moss essence, dark cocoa.',
    },
    review: {
      quote: 'Tasted awful, smelled worse, but I walked through an entire town square and not a single head turned.',
      author: 'Ghost, Infiltrator',
      stars: 5,
    },
    stamp: { text: 'CAMOUFLAGE', tilt: -5 },
  },

  reaper_ribbons: {
    id: 'reaper_ribbons',
    name: CANDIES.reaper_ribbons.name,
    stat: CANDIES.reaper_ribbons.stat,
    color: 'violet',
    kicker: 'Final harvest',
    deck: 'One touch finishes wounded dead on the spot.',
    burst: 'EXECUTE!',
    caption: 'Fig. 28: Black scythe licorice ribbon.',
    boostDescription: 'Instantly decapitates standard zombies struck while below 30% health.',
    tacticalAdvice: 'Finishes off armored walkers and tough targets without wasting ammo.',
    foundIn: 'Antique desks and abandoned funeral homes.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 ribbon (35g)',
      servingsPerContainer: '2',
      calories: 125,
      facts: [
        { name: 'Total Sugar', amount: '22g', percent: '44%', bold: true },
        { name: 'Execute Threshold', amount: '30% HP', percent: '150%', bold: true },
        { name: 'Scythe Sharpness', amount: 'Razor', percent: '250%' },
        { name: 'Grim Presence', amount: 'Chilling', percent: '180%' },
        { name: 'Dark Molasses', amount: 'Rich', percent: '100%' },
      ],
      ingredients: 'Molasses, dark cane syrup, pulverized scythe iron, black currant extract, edible ash, salt.',
    },
    review: {
      quote: 'One knife graze on a wounded walker and off came the head. The cleanest reaper in town.',
      author: 'Crow, Assassin',
      stars: 5,
    },
    stamp: { text: 'INSTANT KILL', tilt: 6 },
  },

  toffee_timber: {
    id: 'toffee_timber',
    name: CANDIES.toffee_timber.name,
    stat: CANDIES.toffee_timber.stat,
    color: 'mustard',
    kicker: 'Hardwood resilience',
    deck: 'Barkskin toughness that resists impacts and shoves.',
    burst: 'BARKSKIN!',
    caption: 'Fig. 29: Wood grain molasses toffee log.',
    boostDescription: 'Tough woodbark fortitude absorbs damage and repels attackers.',
    tacticalAdvice: 'Provides sturdy resilience when fighting in tight interiors.',
    foundIn: 'Lumber yards and cellar workbenches.',
    durationSec: CANDY_SEC,
    nutrition: {
      servingSize: '1 log (40g)',
      servingsPerContainer: '2',
      calories: 175,
      facts: [
        { name: 'Total Sugar', amount: '26g', percent: '52%', bold: true },
        { name: 'Bark Durability', amount: 'Double', percent: '200%', bold: true },
        { name: 'Woodgrain Fiber', amount: '12g', percent: '48%' },
        { name: 'Molasses Density', amount: 'Dense', percent: '150%' },
        { name: 'Impact Absorption', amount: 'Stout', percent: '180%' },
      ],
      ingredients: 'Brown sugar, butter, maple syrup, oak wood smoke, cinnamon bark, sea salt, cream of tartar.',
    },
    review: {
      quote: 'Chewed a log of timber toffee and stood my ground in the doorway like an oak tree.',
      author: 'Lumberjack Dan',
      stars: 4,
    },
    stamp: { text: 'BARKSKIN', tilt: -4 },
  },
};

export type CandyMagazineLeaf =
  | { readonly kind: 'cover'; readonly id: string; readonly color: MagazineColor; readonly head: string }
  | { readonly kind: 'contents'; readonly id: string; readonly color: MagazineColor; readonly head: string }
  | { readonly kind: 'art'; readonly id: string; readonly candy: CandyMagazineEntry; readonly color: MagazineColor; readonly head: string }
  | { readonly kind: 'detail'; readonly id: string; readonly candy: CandyMagazineEntry; readonly color: MagazineColor; readonly head: string };

/** Generates the 60 leaves of the printed Sweet Tooth magazine. */
export function candyMagazineLeaves(): readonly CandyMagazineLeaf[] {
  const coverLeaf: CandyMagazineLeaf = {
    kind: 'cover',
    id: 'candy-cover',
    color: 'tomato',
    head: 'Cover',
  };

  const contentsLeaf: CandyMagazineLeaf = {
    kind: 'contents',
    id: 'candy-contents',
    color: 'mustard',
    head: 'Contents',
  };

  const candyPairs: CandyMagazineLeaf[] = CANDY_ORDER.flatMap((id) => {
    const candy = CANDY_ENTRIES[id];
    const artLeaf: CandyMagazineLeaf = {
      kind: 'art',
      id: `candy-art-${id}`,
      candy,
      color: candy.color,
      head: candy.name,
    };
    const detailLeaf: CandyMagazineLeaf = {
      kind: 'detail',
      id: `candy-detail-${id}`,
      candy,
      color: candy.color,
      head: 'Nutrition & Effects',
    };
    return [artLeaf, detailLeaf];
  });

  return [coverLeaf, contentsLeaf, ...candyPairs];
}

/** The leaf index where a specific candy\'s spread begins (its cover art leaf). */
export function candySpreadIndex(candyId: CandyId): number {
  const index = CANDY_ORDER.indexOf(candyId);
  const found = index >= 0;
  return found ? 2 + index * 2 : 0;
}

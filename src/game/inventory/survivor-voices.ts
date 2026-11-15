// What each survivor says when an item in hand hovers over them: one voice per character, in the order of
// shared/characters.ts. Lines are short (about 24 characters) because they are drawn in the 5px canvas font.

/** Why a survivor wants the item now. */
export type NeedReason = 'hunger' | 'thirst' | 'bleed' | 'wound' | 'sick' | 'hurt';

/**
 * How the survivor takes the item: `need` helps something wrong right now, `fine` works but nothing is urgent,
 * `full` would be wasted (the sim refuses it), `cant` is not something a survivor uses on themselves.
 */
export type QuipMood = 'need' | 'fine' | 'full' | 'cant';

/** What a survivor says on their own: on picking something up, and on dropping it. */
export type SpeechKind = 'pickup' | 'drop';

export type Voice = Readonly<Record<NeedReason | Exclude<QuipMood, 'need'> | SpeechKind, readonly string[]>>;

/** Night: quiet, gloomy, a little poetic. */
const NIGHT: Voice = {
  hunger: ['THE VOID IS HUNGRY.', 'EVEN SHADOWS EAT.'],
  thirst: ['DRY AS A TOMB.', 'WATER. QUIETLY.'],
  bleed: ["I'M LEAKING. HUSH.", 'WRAP IT. NO FUSS.'],
  wound: ['STING ME. QUIETLY.', 'CLEAN THE CUT.'],
  sick: ['THE ROT WHISPERS.', 'PILLS. BEFORE I TURN.'],
  hurt: ['PATCH ME UP.', 'STILL BREATHING. BARELY.'],
  fine: ['IF YOU INSIST.', 'A SMALL MERCY.'],
  full: ['NOT TONIGHT.', 'SAVE IT FOR LATER.'],
  cant: ["THAT'S NOT FOR ME.", "I DON'T EAT METAL."],
  pickup: ['MINE NOW.', 'THE DARK PROVIDES.', 'QUIETLY POCKETED.'],
  drop: ['LET IT GO.', 'DUST TO DUST.', 'LEAVE IT FOR THE DEAD.'],
};

/** Bear: gruff, tough, always thinking about food. */
const BEAR: Voice = {
  hunger: ['FOOD! GIVE IT HERE!', 'MY BELLY GROWLS LOUDER.'],
  thirst: ['PARCHED. POUR IT IN.', 'WATER! NOW!'],
  bleed: ['JUST A FLESH WOUND...', 'STOP THE LEAK.'],
  wound: ["THAT'LL STING. DO IT.", "CLEAN IT. I'M TOUGH."],
  sick: ['I FEEL GRIZZLY. PILLS.', "SOMETHING'S IN ME."],
  hurt: ['BEAR NEEDS A BANDAID.', 'HEAL ME, CHAMP.'],
  fine: ['ALWAYS ROOM FOR MORE.', 'SNACK? SURE.'],
  full: ['STUFFED. FOR NOW.', 'BEAR IS FULL. RARE.'],
  cant: ["CAN'T EAT THAT. TRIED.", 'HUH? NO.'],
  pickup: ['INTO THE BAG!', 'OOH, SHINY.', 'BEAR FIND THING.'],
  drop: ['TOO HEAVY. BYE.', 'NOT HUNGRY FOR THAT.', 'CLEARING SPACE.'],
};

/** Kat: aloof, demanding, a cat about everything. */
const KAT: Voice = {
  hunger: ['FEED ME, HUMAN.', 'I DEMAND TRIBUTE.'],
  thirst: ['WATER BOWL. NOW.', 'MY TONGUE IS SANDPAPER.'],
  bleed: ["I'M BLEEDING. CHIC.", 'WRAP THE PAW.'],
  wound: ['HISS. FINE, CLEAN IT.', 'NOT THE SPRAY...'],
  sick: ['I FEEL... OFF. MEOW.', 'HACK. PILLS, PLEASE.'],
  hurt: ['NINE LIVES? DOWN TO TWO.', 'FIX ME. GENTLY.'],
  fine: ["I'LL ALLOW IT.", 'MEH. OKAY.'],
  full: ['NOT HUNGRY. GO AWAY.', "I'LL KNOCK IT OFF."],
  cant: ["I'LL SIT ON IT.", 'IS THAT A TOY?'],
  pickup: ['MINE. OBVIOUSLY.', "I'LL ALLOW THIS.", 'FINDERS KEEPERS.'],
  drop: ['*KNOCKS IT OVER*', 'BORED OF IT.', 'YOU CAN HAVE IT.'],
};

/** Rex: a loud kid in a dino suit. */
const REX: Voice = {
  hunger: ['RAWR! HUNGRY!', 'CHOMP CHOMP TIME!'],
  thirst: ['DINO NEEDS DRINK!', 'THIRSTY-SAURUS!'],
  bleed: ['OWIE! BIG OWIE!', 'BANDAGE! RAWR!'],
  wound: ["IT'S GONNA STING!", 'BRAVE DINO. DO IT.'],
  sick: ['TUMMY FEELS ZOMBIE.', 'MEDICINE-SAURUS!'],
  hurt: ['EXTINCTION SOON!', 'FIX MY SCALES!'],
  fine: ['OKAY! RAWR!', 'YUM? YUM!'],
  full: ['NO MORE! TOO FULL!', 'DINO SAYS NO.'],
  cant: ['ARMS TOO SHORT.', 'WHAT DOES IT DO?'],
  pickup: ['TREASURE! RAWR!', 'DINO HOARD!', 'GOT IT GOT IT!'],
  drop: ['BYE BYE THING!', 'STOMP. DROPPED.', "DON'T NEED IT!"],
};

/** Rich: the looter, who prices everything. */
const RICH: Voice = {
  hunger: ["I'D PAY FOR THAT.", 'FREE LUNCH? DEAL.'],
  thirst: ['DRINKS ON ME. GIMME.', 'HYDRATE THE ASSET.'],
  bleed: ['THIS SUIT WAS NEW!', 'BANDAGE. ON MY TAB.'],
  wound: ['STERILIZE ME. PRONTO.', 'CLEAN ME UP. BILL ME.'],
  sick: ['TOO RICH TO TURN.', 'PILLS! PRIORITY!'],
  hurt: ['PROTECT THE INVESTMENT.', "I'M INSURED. HEAL ME."],
  fine: ['ADD IT TO MY TAB.', 'A GOOD DEAL.'],
  full: ["SELL IT. I'M FULL.", "KEEP IT. IT'S WORTH MORE."],
  cant: ['NICE. IS IT RARE?', "I'LL KEEP IT. VALUE."],
  pickup: ['CHA-CHING!', 'ADDED TO PORTFOLIO.', 'WORTH SOMETHING.'],
  drop: ['LIQUIDATING ASSETS.', 'WRITE IT OFF.', "SOMEONE ELSE'S PROBLEM."],
};

/** Indexed by a player's skin, like CHARACTERS. */
export const VOICES: readonly Voice[] = [NIGHT, BEAR, KAT, REX, RICH];

export function voiceOf(skin: number): Voice {
  return VOICES[skin] ?? VOICES[0];
}

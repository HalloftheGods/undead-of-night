import type { DifficultyId } from '../../shared/difficulty.ts';
import type { EmoteId } from '../../shared/emotes.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { MerchantId } from '../../shared/home-protocol.ts';
import type { BuildingKind, CandyId, PickupType, PropKind, TileKind, WeaponId, ZombieType } from '../../shared/protocol.ts';
import type { ContainerArt, ContainerLook } from './containers.ts';

/**
 * A baked image. Art is pure data so it builds in Node (contact sheets, tests)
 * as well as the browser. The renderer uploads rgba to canvases once at load.
 */
export interface PixelSprite {
  readonly w: number;
  readonly h: number;
  /** Anchor in sprite pixels: the feet of a character, footprint bottom-centre of a prop. */
  readonly ax: number;
  readonly ay: number;
  /** w*h*4 straight-alpha RGBA. Every alpha is 0 or 255: no anti-aliasing. */
  readonly rgba: Uint8ClampedArray;
}

export interface Clip {
  readonly frames: readonly PixelSprite[];
  readonly fps: number;
  readonly loop: boolean;
}

/** Eight clips indexed by dirFromAngle: 0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE (y down). */
export type DirClips = readonly Clip[];

export function dirFromAngle(angle: number): number {
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

export interface SurvivorWeaponArt {
  readonly idle: DirClips;
  readonly walk: DirClips;
  readonly fire: DirClips;
  readonly reload: DirClips;
}

export interface SurvivorArt {
  readonly weapons: Record<WeaponId, SurvivorWeaponArt>;
  readonly downed: Clip;
  readonly dead: Clip;
  /** The figure the title screen shows. */
  readonly portrait: PixelSprite;
  /** The same figure at the portrait's crop, one frame per facing in dirFromAngle order. */
  readonly portraits: readonly PixelSprite[];
  /** The character select screen's large head-and-shoulders picture (survivors/bust.ts). */
  readonly select: PixelSprite;
  /** Pixels this survivor's gun sits below the standard build's, for the muzzle flash. */
  readonly gunDrop: number;
  /**
   * One record per costume, in the order of shared/characters.ts costumesOf(skin), default
   * first. Index 0 is the survivor's own record, the same object. Every other record is
   * drawn the first time its index is read, wears its survivor's select bust, and shares
   * this same list. Not enumerable, so walking the book's keys does not draw any of them.
   */
  readonly costumes: readonly SurvivorArt[];
}

export interface ZombieArt {
  readonly walk: DirClips;
  readonly attack: DirClips;
  /** Plays once. The last frame stays on the ground as the corpse. */
  readonly death: Clip;
  /**
   * Rows from the anchor down to the planted soles, so the ground shadow sits under the feet
   * rather than the anchor. buildZombies (zombies.ts) sets it from values measured off the walk frames; a type's own builder leaves it out.
   */
  readonly footDrop?: number;
}

export interface MerchantArt {
  /** Stands behind the stall. The same sprite as the merchant's prop. */
  readonly figure: PixelSprite;
  /** Shown beside their shop. */
  readonly portrait: PixelSprite;
  /** The shop screen's large head-and-shoulders picture (survivors/bust.ts format, drawn in environment/merchant-busts/). */
  readonly bust: PixelSprite;
}

export interface EnvironmentArt {
  /** Variants per tile kind, each exactly TILE_SIZE square. */
  readonly tiles: Record<TileKind, readonly PixelSprite[]>;
  readonly props: Record<PropKind, PixelSprite>;
  /**
   * The other coats a car comes in, each the same size and anchor as its prop, which is the first.
   * A car's spot on the map picks its coat, so every client sees the same one.
   */
  readonly paintJobs: Partial<Record<PropKind, readonly PixelSprite[]>>;
  /** Light bars blinking over their props, same size and anchor, drawn after the lightmap. */
  readonly beacons: Partial<Record<PropKind, Clip>>;
  /** The overrun's other frames: props.blast_door is shut and props.chest is closed. The door frames share its size. */
  readonly overrun: {
    readonly doorBuckling: PixelSprite;
    readonly doorBurst: PixelSprite;
    readonly chestOpen: PixelSprite;
  };
  /**
   * Exterior shell per building: roof plus south front wall with the door at doorX, anchored
   * at the bottom-centre of the footprint. The roof fades out when the local player is
   * inside, revealing floor tiles and walls, so a shell must cover its whole footprint.
   * Several facades per kind stop repeats reading as copies.
   */
  readonly buildings: Record<BuildingKind, readonly PixelSprite[]>;
  /** Tiled along walls seen from inside. wallFace is 16 wide, the north wall's inner face; wallCap is 16x16, the wall tops. */
  readonly interior: { readonly wallFace: PixelSprite; readonly wallCap: PixelSprite; readonly doorMat: PixelSprite };
  /** fire_barrel flames, drawn over its prop. */
  readonly barrelFire: Clip;
  /** The way out of a level, and its blinking hazard lights. */
  readonly escapeVan: PixelSprite;
  readonly escapeVanLights: Clip;
}

/** Impact, weather, particle, debris and ground-mark extras (fx/ambient.ts). */
export interface AmbientFxArt {
  /** Metal sparks where a bullet hits a wall, car or door. Plays once. */
  readonly hitSpark: Clip;
  /** One falling rain streak, looped; the renderer moves it. */
  readonly rainStreak: Clip;
  /** A raindrop landing. Plays once. */
  readonly rainSplash: Clip;
  /** A rising, cooling ember for fire barrels and burning wrecks. */
  readonly emberDrift: Clip;
  /** A glowing spore for the blight biome. */
  readonly sporeDrift: Clip;
  /** A tumbling leaf for the evergreen and yard biomes. */
  readonly leafFall: Clip;
  /** Flesh, bone, rot, rib and scrap chunks thrown by a death. */
  readonly gibs: readonly PixelSprite[];
  /** Left, right and a faded left. */
  readonly bloodFootprints: readonly PixelSprite[];
  /** Burnt ground, small to large. */
  readonly scorchDecals: readonly PixelSprite[];
  readonly glassShards: readonly PixelSprite[];
  readonly bulletHoles: readonly PixelSprite[];
  /** A ring swelling under a pickup. */
  readonly pickupRing: Clip;
}

export interface FxArt {
  readonly ambient: AmbientFxArt;
  /** Muzzle flash per weapon, drawn at the barrel tip, one clip per direction. */
  readonly muzzle: Record<WeaponId, DirClips>;
  readonly tracer: DirClips;
  readonly bulletImpact: Clip;
  readonly bloodBurst: Clip;
  /** Permanent ground stains. */
  readonly bloodDecals: readonly PixelSprite[];
  readonly acidBurst: Clip;
  readonly acidDecals: readonly PixelSprite[];
  readonly smokePuff: Clip;
  readonly shellCasing: PixelSprite;
  readonly shotgunShell: PixelSprite;
}

/** The van from the side, for the drive between the bunker and a town (fx/van-side.ts). */
export interface VanSideArt {
  /** Nose right, wheels left off: they turn on their own. */
  readonly body: PixelSprite;
  /** Two frames of a turning wheel. */
  readonly wheel: readonly [PixelSprite, PixelSprite];
  /** Top-left of each wheel, in body pixels. */
  readonly wheelAt: readonly { readonly x: number; readonly y: number }[];
  /** The headlamp's front edge and the exhaust's tip, in body pixels. */
  readonly lamp: { readonly x: number; readonly y: number };
  readonly exhaust: { readonly x: number; readonly y: number };
  /** Dead town against the night, tiling end to end. */
  readonly skyline: PixelSprite;
}

export interface UiArt {
  readonly crosshair: PixelSprite;
  /** The crosshair over a zombie's head. */
  readonly crosshairHead: PixelSprite;
  readonly weaponIcons: Record<WeaponId, PixelSprite>;
  readonly pickupIcons: Record<PickupType, PixelSprite>;
  /** The money icon: a pile of silver coins. Towns hold no coin, so it is not a pickup. */
  readonly silverIcon: PixelSprite;
  readonly heart: PixelSprite;
  /** The HUD's count of bottles to throw. */
  readonly bottle: PixelSprite;
  /** The HUD's count of fireworks, and of flares. */
  readonly fireworks: PixelSprite;
  readonly flare: PixelSprite;
  /** A wrapped sweet, for the candy carried: the HUD counts it and the backpack ring offers it. */
  readonly candy: PixelSprite;
  /** Every candy's own picture, 16x16, for the candy bag screen (fx/candies.ts). */
  readonly candies: Readonly<Record<CandyId, PixelSprite>>;
  /** The town map folded in three, as the backpack ring offers it. */
  readonly townMap: PixelSprite;
  readonly skull: PixelSprite;
  /** A walker's head, for the HUD's kill count: the number plainly counts zombies. */
  readonly zombieHead: PixelSprite;
  /** The six emote icons, 16x16 (shared/emotes.ts). */
  readonly emotes: Record<EmoteId, PixelSprite>;
  /** Title lockup for the menu and game over screens. */
  readonly logo: PixelSprite;
  /** The difficulty page's card picture for each difficulty (difficulty-card.ts). */
  readonly difficulty: Record<DifficultyId, PixelSprite>;
  /** The Play page's card picture for Solo and Multiplayer (mode-cards.ts). */
  readonly mode: Record<'solo' | 'multi', PixelSprite>;
  /** The Play page's card picture for Campaign and Arcade (style-cards.ts). */
  readonly style: Record<GameStyle, PixelSprite>;
  /** The Levels page's hand-drawn scene for each level, index 0 being level 1 (level-cards.ts). */
  readonly levelScenes: readonly PixelSprite[];
  /** The home station screens' scene picture for each station (station-cards.ts). */
  readonly stations: Record<'locker' | 'forge' | 'jukebox' | 'bench', PixelSprite>;
  readonly vanSide: VanSideArt;
}

export interface ArtBook {
  /** One per skin, SURVIVOR_SKIN_COUNT long. */
  readonly survivors: readonly SurvivorArt[];
  readonly zombies: Record<ZombieType, ZombieArt>;
  readonly environment: EnvironmentArt;
  /** Floating ground pickups with a bob, looped. */
  readonly pickups: Record<PickupType, Clip>;
  /** Searchable furniture and vehicles, shut and searched, each drawn in place of its prop. */
  readonly containers: Record<ContainerLook, ContainerArt>;
  /** Shut and searched art for each of a car's coats, in paintJobs order. */
  readonly paintedContainers: Partial<Record<PropKind, readonly ContainerArt[]>>;
  readonly merchants: Record<MerchantId, MerchantArt>;
  readonly fx: FxArt;
  readonly ui: UiArt;
}

// Turns poses into the clips for one person and one weapon.

import type { WeaponId } from '../../../shared/protocol.ts';
import type { Clip, DirClips, PixelSprite, SurvivorWeaponArt } from '../types.ts';
import { makeClip } from '../kit.ts';
import type { DrawnDir, Point } from '../kit.ts';
import { ANCHOR_X, ANCHOR_Y, mirrorFrames } from './cell.ts';
import { deadClip } from './fallen.ts';
import { LEG_SETS } from './legs.ts';
import { BODY, drawPose } from './rig.ts';
import type { Person, Pose } from './rig.ts';
import { AXIS, GUNS } from './weapons.ts';

const WALK_BOB = [1, 1, 0, 1, 1, 0];
const HEAD_LAG = [-1, 0, 0, -1, 0, 0];
/** Seen from the front or back, the body rocks over the planted foot. */
const SWAY = [0, -1, 0, 0, 1, 0];

/** Rates chosen so a fire clip ends before the next shot of that gun. */
const FIRE_FPS: Record<WeaponId, number> = { pistol: 14, carbine: 18, shotgun: 6 };
/** The row a dropped magazine comes to rest on, once it is a ground decal (magLanding). */
const LANDED_Y = 33;
/** The magazine grid's width, for where it lands in a mirrored facing. */
const MAG_W = 2;

/** Each facing in dirFromAngle order: the drawn facing it copies, and whether it is that one mirrored. */
const FACING_SOURCE: readonly (readonly [DrawnDir, boolean])[] = [
  [0, false], [1, false], [2, false], [1, true], [0, true], [7, true], [6, false], [7, false],
];

function walkPoses(dir: DrawnDir): Pose[] {
  const set = LEG_SETS[dir];
  return set.cycle.map((near, i) => ({
    near,
    far: set.cycle[(i + 3) % 6],
    bodyX: dir === 2 || dir === 6 ? SWAY[i] : 0,
    bodyY: WALK_BOB[i],
    headY: HEAD_LAG[i],
  }));
}

function kicked(dir: DrawnDir, pixels: number): Pose {
  const [ax, ay] = AXIS[dir];
  return { gunX: -ax * pixels, gunY: -ay * pixels };
}

function firePoses(weapon: WeaponId, dir: DrawnDir): Pose[] {
  const [first, second] = GUNS[weapon].kick;
  const [ax, ay] = AXIS[dir];
  const peak: Pose = { ...kicked(dir, second), bodyX: -ax, bodyY: -ay };
  const poses: Record<WeaponId, () => Pose[]> = {
    carbine: () => [kicked(dir, first), peak],
    pistol: () => [{ ...kicked(dir, first), gunY: -1 }, { ...peak, gunY: -2 }, kicked(dir, 1)],
    // The shotgun climbs at the peak with the head going back with the body; the muzzle is still high while it racks.
    shotgun: () => [kicked(dir, first), { ...peak, gunY: -2 }, { ...kicked(dir, 1), gunY: -1, rack: 3 }],
  };
  return poses[weapon]();
}

/** The gun comes in against the chest so the free hand can work on it. */
function tucked(weapon: WeaponId, dir: DrawnDir): { pose: Pose; port: Point; belt: Point } {
  const [ax, ay] = AXIS[dir];
  const gunX = -ax * 2;
  const gunY = -ay * 2 + 1;
  const view = GUNS[weapon].views[dir];
  return {
    pose: { gunX, gunY },
    port: [view.at[0] + view.port[0] + gunX, view.at[1] + view.port[1] + gunY],
    belt: BODY[dir].belt,
  };
}

function magazinePoses(weapon: WeaponId, dir: DrawnDir): Pose[] {
  const { pose, port, belt } = tucked(weapon, dir);
  const pulled: Point = [port[0], port[1] + 3];
  const fallen: Point = [port[0], Math.min(port[1] + 6, 30)];
  const swap: Pose[] = [
    { ...pose, hand: port },
    { ...pose, hand: pulled, magOut: true, carrying: 'mag' },
    { ...pose, hand: belt, magOut: true, dropped: fallen },
    { ...pose, hand: belt, magOut: true, carrying: 'mag' },
    { ...pose, hand: pulled, magOut: true, carrying: 'mag' },
  ];
  const seated: Pose = { ...pose, hand: port, gunY: (pose.gunY ?? 0) - 1 };
  // The pistol's magazine is small enough to fetch in one movement.
  const quick = weapon === 'pistol';
  return quick ? [...swap.slice(0, 3), swap[4], seated] : [...swap, seated];
}

function shotgunPoses(dir: DrawnDir): Pose[] {
  const { pose, port, belt } = tucked('shotgun', dir);
  const load: Pose = { ...pose, hand: port, carrying: 'shell' };
  const fetch: Pose = { ...pose, hand: belt, carrying: 'shell' };
  const shove: Pose = { ...pose, hand: port, gunY: (pose.gunY ?? 0) + 1 };
  return [fetch, load, shove, fetch, load, { rack: 3 }];
}

function samePoint(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * The pose halfway between two reload poses: the hand at the midpoint, the rest from the
 * earlier pose. A spare picked up at the belt is already in hand; a magazine let go starts
 * falling from where the hand was; one already falling has landed, and is a ground decal now.
 */
function between(from: Pose, to: Pose, belt: Point): Pose {
  const a = from.hand as Point;
  const b = to.hand as Point;
  const hand: Point = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
  const lettingGo = to.dropped !== undefined && from.dropped === undefined && from.carrying !== undefined;
  if (lettingGo) return { ...from, hand, carrying: undefined, dropped: [a[0] - 1, a[1] + 1] };
  const carrying = samePoint(a, belt) ? to.carrying : from.carrying;
  return { ...from, hand, carrying, dropped: undefined };
}

/** A reload with a pose added wherever the hand would otherwise jump, so it travels. */
function reloadPoses(weapon: WeaponId, dir: DrawnDir): Pose[] {
  const keys = weapon === 'shotgun' ? shotgunPoses(dir) : magazinePoses(weapon, dir);
  const { belt } = BODY[dir];
  return keys.flatMap((pose, i) => {
    const next = keys[i + 1];
    const travels = next?.hand !== undefined && pose.hand !== undefined && !samePoint(pose.hand, next.hand);
    return travels ? [pose, between(pose, next, belt)] : [pose];
  });
}

/** Where and when a reload's dropped magazine reaches the ground. */
export interface MagLanding {
  /** Reload progress, 0..1, at the first frame that no longer draws the falling magazine. */
  readonly at: number;
  /** The magazine's top-left pixel from the figure's feet. */
  readonly dx: number;
  readonly dy: number;
}

const landings = new Map<string, MagLanding | null>();

function landingOf(weapon: WeaponId, dir: number): MagLanding | null {
  const [source, mirrored] = FACING_SOURCE[dir];
  const poses = reloadPoses(weapon, source);
  const last = poses.findLastIndex((pose) => pose.dropped !== undefined);
  const fell = poses[last]?.dropped;
  if (!fell) return null;
  const dx = fell[0] - ANCHOR_X;
  return { at: (last + 1) / poses.length, dx: mirrored ? -dx - MAG_W : dx, dy: LANDED_Y - ANCHOR_Y };
}

/**
 * The reload's magazine landing for a facing in dirFromAngle order, or null for a gun that
 * drops none (the shotgun). The pose stops drawing it in the air there; the renderer stamps
 * it into the ground, so it stays where it fell instead of following the figure.
 */
export function magLanding(weapon: WeaponId, dir: number): MagLanding | null {
  const key = `${weapon}/${dir}`;
  const known = landings.get(key);
  if (known !== undefined) return known;
  const found = landingOf(weapon, dir);
  landings.set(key, found);
  return found;
}

/**
 * A fire or reload pose carried on a walk pose: the walk's legs, the two body offsets
 * added together. A landed magazine is never in a pose (magLanding), so nothing is dragged.
 */
function onTheMove(walk: Pose, act: Pose): Pose {
  return {
    ...act,
    near: walk.near,
    far: walk.far,
    bodyX: (walk.bodyX ?? 0) + (act.bodyX ?? 0),
    bodyY: (walk.bodyY ?? 0) + (act.bodyY ?? 0),
    headY: (walk.headY ?? 0) + (act.headY ?? 0),
  };
}

function clip(person: Person, weapon: WeaponId, dir: DrawnDir, poses: readonly Pose[], fps: number, loop: boolean): Clip {
  return makeClip(poses.map((pose) => drawPose(person, weapon, dir, pose)), fps, loop);
}

/** Like the kit's dirClips, with the fast mirror. */
function facings(build: (dir: DrawnDir) => Clip): DirClips {
  const mirrored = (from: Clip): Clip => ({ ...from, frames: mirrorFrames(from.frames) });
  const [e, se, s, n, ne] = ([0, 1, 2, 6, 7] as const).map(build);
  return [e, se, s, mirrored(se), mirrored(e), mirrored(ne), n, ne];
}

/** Just the standing clips, for callers that need a look at each facing and not the whole kit. */
export function idleClips(person: Person, weapon: WeaponId): DirClips {
  return facings((dir) => clip(person, weapon, dir, [{}], 2, true));
}

export type MovingClip = 'fire' | 'reload';

type MovingFrames = (clip: MovingClip, dir: number, frame: number, step: number) => PixelSprite;

/** What weaponClips adds to each record it builds, drawn only when asked for. */
interface Motion {
  readonly moving: MovingFrames;
  readonly dead: () => Clip;
}

/**
 * Keyed on the weapon record, so each costume's record, which is built from its own
 * Person, keeps its own frames. Kept beside the record rather than on it, so the record's
 * keys stay exactly its four clips.
 */
const motions = new WeakMap<SurvivorWeaponArt, Motion>();

/**
 * Frame `frame` of set[clip][dir] worn over frame `step` of set.walk[dir]: the walk's legs and
 * bob with the gun work on top, for a survivor who shoots or reloads on the move. Each frame
 * is drawn the first time it is asked for and then kept. A record weaponClips did not build
 * gets its standing frame.
 */
export function movingFrame(set: SurvivorWeaponArt, clip: MovingClip, dir: number, frame: number, step: number): PixelSprite {
  const motion = motions.get(set);
  return motion ? motion.moving(clip, dir, frame, step) : set[clip][dir].frames[frame];
}

/**
 * The death collapse with this record's gun dropped by the body, drawn on first use. A record
 * weaponClips did not build gets `fallback`.
 */
export function deathWith(set: SurvivorWeaponArt, fallback: Clip): Clip {
  return motions.get(set)?.dead() ?? fallback;
}

/** Nothing is drawn until a frame is asked for; each one is then kept, so the cache holds only frames that were shown. */
function movingFrames(person: Person, weapon: WeaponId): MovingFrames {
  const acts: Record<MovingClip, (dir: DrawnDir) => Pose[]> = {
    fire: (dir) => firePoses(weapon, dir),
    reload: (dir) => reloadPoses(weapon, dir),
  };
  const poses = new Map<string, readonly Pose[]>();
  const posesOf = (key: string, build: () => Pose[]): readonly Pose[] => {
    const found = poses.get(key) ?? build();
    poses.set(key, found);
    return found;
  };
  const drawn = new Map<string, PixelSprite>();
  return function frameAt(kind: MovingClip, dir: number, frame: number, step: number): PixelSprite {
    const key = `${kind}/${dir}/${frame}/${step}`;
    const found = drawn.get(key);
    if (found) return found;
    const [source, mirrored] = FACING_SOURCE[dir];
    let sprite: PixelSprite;
    if (mirrored) sprite = mirrorFrames([frameAt(kind, source, frame, step)])[0];
    else {
      const walks = posesOf(`walk/${source}`, () => walkPoses(source));
      const act = posesOf(`${kind}/${source}`, () => acts[kind](source));
      const pose = onTheMove(walks[step % walks.length], act[Math.min(frame, act.length - 1)]);
      sprite = drawPose(person, weapon, source, pose);
    }
    drawn.set(key, sprite);
    return sprite;
  };
}

export function weaponClips(person: Person, weapon: WeaponId): SurvivorWeaponArt {
  const clips = {
    idle: facings((dir) => clip(person, weapon, dir, [{}, { bodyY: 1 }], 2, true)),
    walk: facings((dir) => clip(person, weapon, dir, walkPoses(dir), 10, true)),
    fire: facings((dir) => clip(person, weapon, dir, firePoses(weapon, dir), FIRE_FPS[weapon], false)),
    reload: facings((dir) => clip(person, weapon, dir, reloadPoses(weapon, dir), 6, false)),
  };
  let dead: Clip | null = null;
  motions.set(clips, { moving: movingFrames(person, weapon), dead: () => (dead ??= deadClip(person, weapon)) });
  return clips;
}

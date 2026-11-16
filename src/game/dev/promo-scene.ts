import type { WeaponId, ZombieType } from '../../../shared/protocol.ts';
import type { GameSimulation } from '../../../shared/simulation.ts';
import { spawnZombie } from '../../../shared/waves.ts';
import { isLocalHost } from '../analytics/analytics-config.ts';

const PROMO_VALUES = new Set(['scene', 'promo', 'screenshot']);

export function promoSceneOn(search: string, dev: boolean, hostname: string): boolean {
  const isLocalDev = dev && isLocalHost(hostname);
  if (!isLocalDev) return false;
  const param = new URLSearchParams(search).get('dev');
  return param !== null && PROMO_VALUES.has(param);
}

interface SquadMemberDef {
  readonly id: string;
  readonly name: string;
  readonly skin: number;
  readonly weapon: WeaponId;
  readonly dx: number;
  readonly dy: number;
  readonly angle: number;
}

const SQUAD_COMPANIONS: readonly SquadMemberDef[] = [
  { id: 'bandus', name: 'Bear', skin: 1, weapon: 'carbine', dx: 24, dy: -14, angle: 0 },
  { id: 'satori', name: 'Kat', skin: 2, weapon: 'shotgun', dx: 20, dy: 16, angle: 0.1 },
  { id: 'rex', name: 'Rex', skin: 3, weapon: 'pistol', dx: -24, dy: -16, angle: -0.1 },
  { id: 'sol', name: 'Rich', skin: 4, weapon: 'pistol', dx: -20, dy: 18, angle: 0.1 },
];

const PROMO_ZOMBIES: readonly { readonly type: ZombieType; readonly dx: number; readonly dy: number }[] = [
  // Fast runners on the street edges and sidewalks
  { type: 'runner', dx: 110, dy: -36 },
  { type: 'runner', dx: 120, dy: 34 },
  { type: 'runner', dx: 135, dy: -22 },
  { type: 'runner', dx: 145, dy: 24 },
  { type: 'runner', dx: 160, dy: -38 },
  // Frontline walkers pressing down the road
  { type: 'walker', dx: 125, dy: 6 },
  { type: 'walker', dx: 135, dy: -8 },
  { type: 'walker', dx: 150, dy: 14 },
  { type: 'walker', dx: 155, dy: -16 },
  { type: 'walker', dx: 168, dy: 2 },
  { type: 'walker', dx: 175, dy: -28 },
  { type: 'walker', dx: 185, dy: 22 },
  { type: 'walker', dx: 195, dy: -12 },
  { type: 'walker', dx: 205, dy: 8 },
  { type: 'walker', dx: 215, dy: -24 },
  // Bulging bloaters lumbering into the fray
  { type: 'bloater', dx: 180, dy: -18 },
  { type: 'bloater', dx: 210, dy: 16 },
  { type: 'bloater', dx: 235, dy: -6 },
  // Towering brutes in the pack
  { type: 'brute', dx: 225, dy: -20 },
  { type: 'brute', dx: 245, dy: 12 },
  // Screamer alerting in the rear
  { type: 'screamer', dx: 260, dy: 0 },
  // Trailing walkers and runners swarming in
  { type: 'walker', dx: 240, dy: -34 },
  { type: 'walker', dx: 250, dy: 28 },
  { type: 'runner', dx: 230, dy: 36 },
];

function findPoliceAndGunShopStreet(sim: GameSimulation): { x: number; y: number } {
  const s = sim.state;
  const police = s.map.buildings.find((b) => b.kind === 'police');
  const gunShop = s.map.buildings.find((b) => b.kind === 'gun_shop');
  if (police && gunShop) {
    const policeCenter = police.x + 112;
    const gunCenter = gunShop.x + 72;
    const minX = Math.min(policeCenter, gunCenter);
    const maxX = Math.max(policeCenter, gunCenter);
    const streetX = Math.round(minX + (maxX - minX) * 0.15);
    const streetY = Math.max(police.y + 144, gunShop.y + 112) + 65;
    return { x: streetX, y: streetY };
  }
  if (police) {
    return { x: police.x + 112, y: police.y + 144 + 65 };
  }
  if (gunShop) {
    return { x: gunShop.x + 72, y: gunShop.y + 112 + 65 };
  }
  return { x: s.map.spawn.x, y: s.map.spawn.y };
}

export function setupPromoScene(sim: GameSimulation): void {
  const s = sim.state;
  const leader = s.players[0];
  const hasLeader = leader !== undefined;
  if (!hasLeader) return;

  const spot = findPoliceAndGunShopStreet(sim);
  leader.skin = 0;
  leader.name = 'Night';
  leader.weapon = 'carbine';
  leader.owned = ['carbine', 'pistol'];
  leader.ammo = 30;
  leader.guns.carbine = { ammo: 30 };
  leader.guns.pistol = { ammo: 12 };
  leader.reserve = 180;
  leader.health = leader.maxHealth = 100;
  leader.x = spot.x;
  leader.y = spot.y;
  leader.angle = 0;

  for (const member of SQUAD_COMPANIONS) {
    sim.addPlayer(member.id, member.name, null, member.skin);
    const player = s.players.find((p) => p.id === member.id);
    if (player) {
      player.weapon = member.weapon;
      player.owned = [member.weapon];
      player.ammo = 30;
      player.guns[member.weapon] = { ammo: 30 };
      player.reserve = 180;
      player.health = player.maxHealth = 100;
      player.x = leader.x + member.dx;
      player.y = leader.y + member.dy;
      player.angle = member.angle;
    }
  }

  for (const z of PROMO_ZOMBIES) {
    spawnZombie(s, z.type, leader.x + z.dx, leader.y + z.dy);
    const spawned = s.zombies[s.zombies.length - 1];
    if (spawned) {
      spawned.mode = 'hunt';
      spawned.horde = true;
      spawned.interestLeft = 9999;
      spawned.angle = Math.PI;
    }
  }
}

export function updatePromoSceneSquad(sim: GameSimulation): void {
  const s = sim.state;
  const leader = s.players[0];
  const hasLeader = leader !== undefined;
  if (!hasLeader) return;

  leader.health = leader.maxHealth;
  leader.ammo = 30;
  if (leader.guns.carbine) leader.guns.carbine.ammo = 30;

  const livingZombies = s.zombies.filter((z) => z.health > 0);

  for (const member of SQUAD_COMPANIONS) {
    const companion = s.players.find((p) => p.id === member.id);
    if (!companion) continue;

    companion.health = companion.maxHealth;
    companion.ammo = 30;
    if (companion.guns[companion.weapon]) companion.guns[companion.weapon]!.ammo = 30;

    let nearest = livingZombies[0] ?? null;
    let minDist = Infinity;
    for (const z of livingZombies) {
      const dist = Math.hypot(z.x - companion.x, z.y - companion.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = z;
      }
    }

    if (nearest) {
      const targetAngle = Math.atan2(nearest.y - companion.y, nearest.x - companion.x);
      companion.angle = targetAngle;
      companion.aim = { x: nearest.x, y: nearest.y };
      const inFiringRange = minDist < 200;
      companion.shoot = inFiringRange;
      companion.shootQueued = inFiringRange;
    } else {
      companion.angle = member.angle;
      companion.aim = null;
      companion.shoot = false;
      companion.shootQueued = false;
    }
  }

  const lowZombieCount = livingZombies.length < 10;
  if (lowZombieCount) {
    const pick = PROMO_ZOMBIES[Math.floor(Math.random() * PROMO_ZOMBIES.length)];
    spawnZombie(s, pick.type, leader.x + 230 + Math.random() * 60, leader.y - 35 + Math.random() * 70);
    const respawned = s.zombies[s.zombies.length - 1];
    if (respawned) {
      respawned.mode = 'hunt';
      respawned.horde = true;
      respawned.interestLeft = 9999;
      respawned.angle = Math.PI;
    }
  }
}

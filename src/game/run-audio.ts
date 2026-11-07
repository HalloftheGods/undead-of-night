import type { AudioEngine } from '../audio/audio-engine.ts';
import type { SceneView } from '../engine/scene.ts';
import type { ClientWorld } from './client-world.ts';
import type { Heartbeat } from './heartbeat.ts';
import { healthFraction } from './run-hud.ts';

/** Full intensity by this many hostiles; scales the music, not the danger. */
const INTENSE_HOSTILES = 24;

/**
 * One frame of the sound of a run: where the ears are, and how bad it is. Returns the heartbeat's
 * swell, for the red at the screen's edge to beat with the heart.
 */
export function tickRunAudio(audio: AudioEngine, world: ClientWorld, scene: SceneView, dt: number, heart: Heartbeat): number {
  const health = healthFraction(world.localPlayer);
  audio.setListener(scene.focusX, scene.focusY);
  audio.setHealth(health);
  const threat = scene.phase === 'wave' ? Math.min(1, scene.hostiles / INTENSE_HOSTILES) : 0;
  audio.setIntensity(Math.min(1, threat * 0.75 + (1 - health) * 0.25));
  const isHeartbeat = heart.tick(dt, health);
  if (isHeartbeat) audio.heartbeat(health);
  audio.tick(dt, scene.zombies);
  audio.stepPlayers(scene.players, world.localId, world.worldMap, dt);
  audio.stompZombies(scene.zombies);
  return heart.pulse;
}

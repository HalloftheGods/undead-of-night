import type { GameStyle } from '../../shared/game-style.ts';
import type { TransportKind } from '../network/transport.ts';

/**
 * The Play page's steps: the game style (Campaign or Arcade), how you play (mode, server, callsign), the difficulty, then who you are
 * (the survivor, where Start lives). The component only shows the step it is told; every move is decided here.
 */
export type PlayStep = 'style' | 'mode' | 'difficulty' | 'who';
export type PlayMode = 'solo' | 'multi';

export interface PlayFlow {
  readonly step: PlayStep;
  readonly mode: PlayMode;
  /** Whether the Style step is part of this walk. An invite link (the room decides) and a level picked on the Levels page (Arcade) settle the style already. */
  readonly styled: boolean;
}

const WITH_STYLE: readonly PlayStep[] = ['style', 'mode', 'difficulty', 'who'];
const WITHOUT_STYLE: readonly PlayStep[] = ['mode', 'difficulty', 'who'];
const HEADINGS: Record<PlayStep, string> = { style: 'Choose Style', mode: 'Choose Mode', difficulty: 'Choose Difficulty', who: 'Choose Survivor' };
const STEP_LABELS: Record<PlayStep, string> = { style: 'Style', mode: 'Mode', difficulty: 'Difficulty', who: 'Survivor' };

/** One stop on the setup's stepper: behind the player (done), where they are (current), or still ahead (next). */
export interface StepperStop {
  readonly step: PlayStep;
  readonly label: string;
  readonly number: number;
  readonly state: 'done' | 'current' | 'next';
}

/** A plain visit to Play: the style is the first thing to pick. */
export const PLAY_START: PlayFlow = { step: 'style', mode: 'solo', styled: true };

/** An invite link lands on the co-op setup step; the callsign is on that step, so nothing else is skipped. */
export const PLAY_JOIN: PlayFlow = { step: 'mode', mode: 'multi', styled: false };

/** A level picked on the Levels page: Arcade already, so the walk starts at how you play. */
export const PLAY_LEVEL: PlayFlow = { step: 'mode', mode: 'solo', styled: false };

export const STYLE_LABELS: Readonly<Record<GameStyle, string>> = { campaign: 'Campaign', arcade: 'Arcade' };

/** Said on the setup page when Campaign could not start. */
export const HOME_UNREADABLE = 'The game could not open your saved home.';

/** Where the walk starts: an invite wins over a level, and a visit with neither starts on Style. */
export function startFlow(join: boolean, level: number | null): PlayFlow {
  const shouldPickStyle = picksStyle(join, level);
  if (shouldPickStyle) return PLAY_START;
  return join ? PLAY_JOIN : PLAY_LEVEL;
}

/** The steps Next walks, in order. */
export function playSteps(flow: PlayFlow): readonly PlayStep[] {
  return flow.styled ? WITH_STYLE : WITHOUT_STYLE;
}

/** Starting from the Levels page means Arcade, so the run's style is the player's choice only when no level was picked. */
export function setupStyle(level: number | null, chosen: GameStyle): GameStyle {
  return level === null ? chosen : 'arcade';
}

/** The style the setup page may name: none on an invite link, since the room decides and only says so once the socket is open. */
export function claimedStyle(join: boolean, runStyle: GameStyle): GameStyle | null {
  return join ? null : runStyle;
}

/** The style is the player's to pick unless an invite (the room decides) or a level (Arcade) has already settled it. */
export function picksStyle(join: boolean, level: number | null): boolean {
  return !join && level === null;
}

/** A solo setup has no server to fail, so what an earlier co-op try left behind stays off it; only Campaign's unread save is worth saying there. */
export function setupFailure(mode: PlayMode, runStyle: GameStyle, error: string | null): string | null {
  const unreadSave = runStyle === 'campaign' && error === HOME_UNREADABLE;
  return mode === 'multi' || unreadSave ? error : null;
}

/** An invite hides the style only while the room decides it: a player who turns to Solo plays their remembered one, and is told. */
export function showsStyleLabel(join: boolean, mode: PlayMode): boolean {
  return !join || mode === 'solo';
}

/** Continue is Arcade's, and only solo: co-op restarts stay at level 1, and a Campaign run has no level to go back to. */
export function continuesAfterDeath(mode: TransportKind, runStyle: GameStyle | null): boolean {
  return mode === 'solo' && runStyle === 'arcade';
}

export function chooseMode(flow: PlayFlow, mode: PlayMode): PlayFlow {
  return { ...flow, mode };
}

/** Enter, or the Next button: one step on, and the last step stays put (starting is the button's job). */
export function advance(flow: PlayFlow): PlayFlow {
  const steps = playSteps(flow);
  const next = steps[steps.indexOf(flow.step) + 1];
  return next ? { ...flow, step: next } : flow;
}

/** Back or Esc: one step back, and the first step returns null, meaning leave Play for the title. */
export function retreat(flow: PlayFlow): PlayFlow | null {
  const steps = playSteps(flow);
  const earlier = steps[steps.indexOf(flow.step) - 1];
  return earlier ? { ...flow, step: earlier } : null;
}

export function showsServer(flow: PlayFlow): boolean {
  return flow.mode === 'multi' && flow.step === 'mode';
}

/** The Start button belongs to the survivor step, the last one. */
export function startsRun(flow: PlayFlow): boolean {
  return flow.step === 'who';
}

export function playHeading(flow: PlayFlow): string {
  return HEADINGS[flow.step];
}

/** The stepper over the setup: every step this walk has, numbered from 1, marked against where the player stands. */
export function playStepper(flow: PlayFlow): readonly StepperStop[] {
  const steps = playSteps(flow);
  const at = steps.indexOf(flow.step);
  return steps.map((step, index) => ({
    step,
    label: STEP_LABELS[step],
    number: index + 1,
    state: stopState(index, at),
  }));
}

/** Where one stop stands against the step the player is on. */
function stopState(index: number, at: number): StepperStop['state'] {
  const isBehind = index < at;
  const isHere = index === at;
  if (isBehind) return 'done';
  if (isHere) return 'current';
  return 'next';
}

/** A done step picked on the stepper: back to it, the mode kept. A step ahead, or one this walk skips, leaves the flow as it is. */
export function returnTo(flow: PlayFlow, step: PlayStep): PlayFlow {
  const steps = playSteps(flow);
  const target = steps.indexOf(step);
  return target >= 0 && target < steps.indexOf(flow.step) ? { ...flow, step } : flow;
}

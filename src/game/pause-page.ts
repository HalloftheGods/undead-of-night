import type { PageModel } from '../engine/page-ui.ts';

/** What the pause card shows, read from the run and the saved settings each time it is drawn. */
export interface PauseFacts {
  /** "Paused" alone, or "Menu" in co-op, where the run does not stop. */
  readonly heading: string;
  /** The strip along the card's top: "The bunker", or the town's number and name. */
  readonly where: string;
  readonly coopNote: string | null;
  readonly roomCode: string | null;
  readonly canHost: boolean;
  readonly warning: string | null;
  readonly error: string | null;
  readonly volume: number;
  readonly volumeReadout: string;
  readonly brightness: number;
  readonly brightnessReadout: string;
  readonly hasRadio: boolean;
}

/** The pause card as a page-kit model: the volume and brightness sliders, the notes, and the links out. */
export function pausePageModel(facts: PauseFacts): PageModel {
  const notes = [
    ...(facts.coopNote ? [{ kind: 'text' as const, text: facts.coopNote, tone: 'dim' as const }] : []),
    ...(facts.roomCode ? [{ kind: 'text' as const, text: `Room code ${facts.roomCode}. Leaving ends the game for everyone in it.`, tone: 'accent' as const }] : []),
    ...(facts.warning ? [{ kind: 'text' as const, text: facts.warning, tone: 'error' as const }] : []),
    ...(facts.error ? [{ kind: 'text' as const, text: facts.error, tone: 'error' as const }] : []),
  ];
  const links = [
    { kind: 'link' as const, id: 'controls', label: 'Controls' },
    { kind: 'link' as const, id: 'books', label: 'News Stand' },
    ...(facts.hasRadio ? [{ kind: 'link' as const, id: 'radio', label: 'Radio' }] : []),
    { kind: 'link' as const, id: 'menu', label: 'Main menu' },
  ];
  const hosting = facts.canHost && !facts.roomCode ? [{ kind: 'link' as const, id: 'host', label: 'Switch to multiplayer' }] : [];
  return {
    heading: facts.heading,
    panels: [
      {
        heading: facts.where,
        items: [
          ...notes,
          { kind: 'slider', id: 'volume', label: 'Volume', value: facts.volume, readout: facts.volumeReadout },
          { kind: 'slider', id: 'brightness', label: 'Brightness', value: facts.brightness, readout: facts.brightnessReadout },
          ...hosting,
          ...links,
        ],
      },
    ],
    buttons: [{ id: 'resume', label: 'Resume', enabled: true, primary: true }],
  };
}

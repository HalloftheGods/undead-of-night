import { describe, expect, it } from 'vitest';
import { copyBuildingDraft } from '../src/game/dev/bench-store.ts';
import { changeSummary, friendlyName, nextStep, prevStep, stepCounter, weightWord } from '../src/game/dev/building-wizard.ts';

describe('building wizard', () => {
  it('steps forward and back without running off either end', () => {
    expect(nextStep('pick')).toBe('rooms');
    expect(nextStep('done')).toBe('done');
    expect(prevStep('pick')).toBe('pick');
    expect(prevStep('loot')).toBe('rooms');
    expect(stepCounter('loot')).toBe('Step 3 of 4: Loot');
  });

  it('turns code ids and weights into plain words', () => {
    expect(friendlyName('water_bottle')).toBe('Water bottle');
    expect(friendlyName('pistolAmmo')).toBe('Pistol ammo');
    expect(weightWord(0.5)).toBe('Rare');
    expect(weightWord(1)).toBe('Sometimes');
    expect(weightWord(5)).toBe('Lots');
  });

  it('says nothing changed for a fresh draft, and names each change after edits', () => {
    const draft = copyBuildingDraft('pharmacy');
    expect(changeSummary('pharmacy', draft)).toEqual([]);
    const [first] = Object.keys(draft.pool);
    delete draft.pool[first];
    draft.odds = draft.odds === 1 ? 0.5 : 1;
    const lines = changeSummary('pharmacy', draft);
    expect(lines).toContain(`Removed ${friendlyName(first)}.`);
    expect(lines.some((l) => l.startsWith('Finding something:'))).toBe(true);
  });
});

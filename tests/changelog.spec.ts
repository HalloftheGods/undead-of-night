import { describe, expect, it } from 'vitest';
import { openOf, pagesLabel, turnWithin } from '../src/game/book-turn.ts';
import {
  CHANGE_NOTES,
  changeIssues,
  changeLeaves,
  ISSUES_PER_SLIDE,
  issueLabel,
  issueLeaves,
  issuePage,
  issueToCardDef,
  issueVersion,
  noteDate,
  PAPER_TITLE,
  STORIES_PER_LEAF,
} from '../src/game/changelog.ts';

describe('Noise in the Night daily paper', () => {
  it('formats issue versions as YY.M.D', () => {
    expect(PAPER_TITLE).toBe('Noise in the Night');
    expect(issueVersion('2026-11-07')).toBe('26.11.7');
    expect(issueVersion('2026-11-10')).toBe('26.11.10');
  });

  it('groups notes into daily issues newest first with chronological issue numbers from 1', () => {
    const issues = changeIssues();
    expect(issues.length).toBe(6);
    // Newest issue is 2026-11-12 with chronological number 6
    expect(issues[0].date).toBe('2026-11-12');
    expect(issues[0].version).toBe('26.11.12');
    expect(issues[0].issueNumber).toBe(6);
    expect(issueLabel(issues[0])).toBe('Issue #6 (v26.11.12)');

    // Earliest issue is 2026-11-07 with chronological number 1
    const earliest = issues[issues.length - 1];
    expect(earliest.date).toBe('2026-11-07');
    expect(earliest.version).toBe('26.11.7');
    expect(earliest.issueNumber).toBe(1);
    expect(issueLabel(earliest)).toBe('Issue #1 (v26.11.7)');

    // All original notes are preserved across the issues
    const allNotes = issues.flatMap((issue) => [issue.lead, ...issue.stories]);
    expect(allNotes).toEqual(CHANGE_NOTES);
  });

  it('converts an issue into portrait card metadata with 5 issues per slide standard', () => {
    expect(ISSUES_PER_SLIDE).toBe(5);
    const issues = changeIssues();
    const newestCard = issueToCardDef(issues[0]);
    expect(newestCard.id).toBe('26.11.12');
    expect(newestCard.number).toBe('06');
    expect(newestCard.tag).toBe('v26.11.12');
    expect(newestCard.title).toBe(issues[0].lead.title);
    expect(newestCard.subtitle).toBe(noteDate(issues[0].date));
    expect(newestCard.description).toBe(issues[0].lead.deck);
    expect(newestCard.pagesCount).toContain('Stories');

    const earliestCard = issueToCardDef(issues[issues.length - 1]);
    expect(earliestCard.id).toBe('26.11.7');
    expect(earliestCard.number).toBe('01');
    expect(earliestCard.tag).toBe('v26.11.7');
  });

  it('generates single issue leaves with front page and story leaves', () => {
    const issues = changeIssues();
    const issue = issues[0];
    const leaves = issueLeaves(issue);
    expect(leaves[0].kind).toBe('front');
    if (leaves[0].kind === 'front') {
      expect(leaves[0].issue.version).toBe(issue.version);
    }
    const expectedLeaves = 1 + Math.ceil(issue.stories.length / STORIES_PER_LEAF);
    expect(leaves).toHaveLength(expectedLeaves);

    const insideStories = leaves.flatMap((leaf) => (leaf.kind === 'stories' ? leaf.notes : []));
    expect(insideStories).toEqual(issue.stories);
  });

  it('opens with a Back Issues index, then issues with front pages and story leaves', () => {
    const leaves = changeLeaves();
    expect(leaves[0].kind).toBe('index');
    expect(leaves[1].kind).toBe('front');
    if (leaves[1].kind === 'front') {
      expect(leaves[1].issue.version).toBe('26.11.12');
    }

    const collectedNotes = leaves.flatMap((leaf) => {
      if (leaf.kind === 'front') return [leaf.issue.lead];
      if (leaf.kind === 'stories') return leaf.notes;
      return [];
    });
    expect(collectedNotes).toEqual(CHANGE_NOTES);
  });

  it('keeps every note complete and its id unique', () => {
    const ids = new Set(CHANGE_NOTES.map((note) => note.id));
    expect(ids.size).toBe(CHANGE_NOTES.length);
    for (const note of CHANGE_NOTES) {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.points.length).toBeGreaterThan(0);
      expect(note.points.length).toBeLessThanOrEqual(4);
    }
  });

  it('adding a note for a new day creates a new front page at page 2', () => {
    const fresh = {
      id: 'fresh-bunker-day',
      date: '2026-11-13',
      kind: 'new' as const,
      title: 'Bunker Expansion',
      deck: 'A new floor uncovered.',
      points: ['Stairs lead down.'],
    };
    const notes = [fresh, ...CHANGE_NOTES];
    const issues = changeIssues(notes);
    expect(issues[0].version).toBe('26.11.13');
    expect(issues[0].lead.id).toBe('fresh-bunker-day');

    const leaves = changeLeaves(notes);
    expect(leaves[1].kind).toBe('front');
    if (leaves[1].kind === 'front') {
      expect(leaves[1].issue.version).toBe('26.11.13');
    }
    expect(issuePage('26.11.13', notes)).toBe(2);
    expect(issuePage('26.11.12', notes)).toBeGreaterThan(2);
  });

  it('reports driving, roadkill, garage rollouts, smooth turns and test drive on 12 Nov', () => {
    const ids = CHANGE_NOTES.filter((note) => note.date === '2026-11-12').map((note) => note.id);
    expect(ids).toEqual(expect.arrayContaining(['behind-the-wheel', 'roadkill-and-horns', 'garage-rollout', 'smooth-turns', 'test-drive-mode']));
    const wheel = CHANGE_NOTES.find((note) => note.id === 'behind-the-wheel');
    expect(wheel?.points.join(' ')).toContain("driver's seat");
  });

  it('reports the bag, the loot window, doors, material chips and the redrawn art on 11 Nov', () => {
    const ids = CHANGE_NOTES.filter((note) => note.date === '2026-11-11').map((note) => note.id);
    expect(ids).toEqual(expect.arrayContaining(['grid-bag', 'loot-window', 'doors-boards', 'material-chips', 'redrawn-icons']));
    const bag = CHANGE_NOTES.find((note) => note.id === 'grid-bag');
    expect(bag?.points.join(' ')).toContain('Satchel 5 by 4, Duffel 6 by 5, ALICE 8 by 6');
  });

  it('dates read the way the rest of the game writes them', () => {
    expect(noteDate('2026-11-07')).toBe('7 Nov 2026');
  });
});

describe('turning a book', () => {
  const leaves = ['a', 'b', 'c', 'd', 'e'];
  it('shows pairs on a spread, one on a tall screen, and a lone last page', () => {
    expect(openOf(leaves, 1, 'spread')).toEqual(['a', 'b']);
    expect(openOf(leaves, 4, 'spread')).toEqual(['e']);
    expect(openOf(leaves, 3, 'single')).toEqual(['d']);
    expect(pagesLabel(5, 4, 'spread')).toBe('Page 5 of 5');
    expect(pagesLabel(5, 2, 'spread')).toBe('Pages 3-4 of 5');
  });

  it('stops at the covers', () => {
    expect(turnWithin(5, 4, 1, 'spread')).toBe(4);
    expect(turnWithin(5, 2, 1, 'spread')).toBe(4);
    expect(turnWithin(5, 0, -1, 'single')).toBe(0);
  });
});

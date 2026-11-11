# Features: News Stand Daily Newspaper

## Overview

"Noise in the Night" is the town's daily newspaper, replacing the generic changelog book. It serves as both the in-game changelog and an in-universe newsprint chronicle of updates shipped to the game.

## Architecture

1. **Daily Distribution**:
   - Each ship day is mapped to an issue version formatted as `YY.M.D` (`2026-11-07` becomes `Issue 26.11.7`).
   - Grouping is handled automatically in [`changelog.ts`](file:///home/xopher/www/x/Xophz-COMPASS/apps/zombie-survival/src/game/changelog.ts) via `changeIssues()`.
   - Issues are numbered chronologically starting from 1 for the earliest day (e.g. 7 Nov 2026 is Issue #01, 10 Nov 2026 is Issue #04), while displayed newest-first on the rack.
   - The newest entry written for that day is featured as the front page lead headline.
   - Subsequent notes for that day run as inside stories across following leaves.

2. **Two-Tier Browsing Structure**:
   - **Issues Rack (`PaperIssuesLayout.vue`)**:
     - Dedicated portrait card view matching the News Stand visual format.
     - Displays 5 issue cards per slide (`ISSUES_PER_SLIDE = 5`).
     - Pagination navigation ("Prev Issues" / "Next Issues" and slide indicator) activates when total issues exceed 5.
     - Hovering an issue card updates the featured summary panel below with lead story deck, release date, and story count.
   - **Single Issue Reader (`PaperSingleIssue.vue`)**:
     - Selecting an issue card opens the printed broadsheet for that specific issue.
     - Page 1 is the issue front page (`ChangeFront.vue`) with broadsheet masthead, dateline, lead story, and inside story teasers.
     - Pages 2+ contain the inside stories (`ChangeStory.vue`) two per page.
     - Flipping controls allow turning pages within that issue.
     - Back button closes the issue and returns to the Issues Rack.

3. **News Stand Placement**:
   - Featured in slot #01 on the News Stand (Books overlay), ahead of How to Play, Candy Magazine, Town Guide, and Records.
   - Distinctive broadsheet pixel cover art (`paper-card.ts`) with woodblock masthead, halftone photo, columns of newsprint, blood splatter, and dog-eared corner.

4. **Entry Points**:
   - News Stand: accessible from Title Menu ("News Stand") or in-game Pause Menu.
   - Title screen version link: clicking the version string in the footer opens the newspaper directly.

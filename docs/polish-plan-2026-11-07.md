# Undead of Night: Polish Push, 2026-11-07

Position: the game is feature-rich and fully code-generated (sprites in `src/art`, SFX as WebAudio recipes in `src/audio`), so polish means audio delivery, new visual variety, title-screen flow, verified playfeel, and launch assets. The biggest measurable risk is 131 MB of MP3 in `public/music` (about 50 tracks, zero OGG), which the launch plan already flags ("Load music lazily and re-encode it").

## Ground rules (every worker)
- Repo: `~/www/x/Xophz-COMPASS/apps/zombie-survival`. One shared checkout. Touch ONLY the files in your lane.
- Do not run `git checkout`, `commit`, `push`, `merge` or `stash`. The Game Master commits and verifies at the end.
- Do not delete existing files (MP3s stay until the Commander approves removal).
- Code must pass `pnpm exec vue-tsc --noEmit`. Workers without a shell must list the exact commands to run.
- Report: files changed, what is verified, what is not.

## Lanes
| Agent | Model | Lane | Files owned |
|---|---|---|---|
| ENGINEER-2 (Chemist) | sonnet-5-5 / high | OGG music pipeline: ffmpeg re-encode, loader with MP3 fallback, lazy load, SW precache | `public/music/*.ogg`, `src/audio/{playlists,music,soundtrack}.ts`, `tools/vite-pwa.ts`, related tests |
| ENGINEER | opus-5-5 / high | SFX gap pass and mix: missing sounds, ambience beds, layering | `src/audio/sfx-*.ts`, `event-sounds.ts`, `footsteps.ts`, `tests/audio-sfx.spec.ts` |
| RESERVE ENGINEER | sonnet-5-5 / high | New in-game pixel visuals (code-defined sprites, props, FX) | `src/art/**`, new art specs |
| GLOWSMITH | sonnet-5-5 / medium | Title page: Campaign and Arcade as separate buttons, menu polish | `src/components/*` title/play-setup files, `pixel-ui.css` |
| ART DIRECTOR | sonnet-5-5 / medium | Launch art: 6 screenshots, key art, itch cover 630x500, Steam capsules | `docs/assets/launch/**` |
| PLAYTESTER | sonnet-5-5 / medium | Play the live build, levels 1 to 3, ranked bug and feel list | `docs/playtest-2026-11-07.md` |
| PRODUCER | opus-5-5 / medium | Polish backlog with definition of done | `docs/polish-backlog.md` |
| LAUNCH MARKETER | sonnet-5-5 / medium | 30-45s trailer shot list, 4-6 GIF capture plan | `docs/marketing/trailer-and-gifs.md` |
| RESERVE GROWTH | sonnet-5-5 / medium | itch.io, Newgrounds and Reddit page copy | `docs/marketing/store-copy.md` |
| OPPORTUNITY | sonnet-5-5 / high | Web portal requirements (size caps, revenue share) and fit | `docs/marketing/portals.md` |
| CHIEF OF STAFF | sonnet-5-5 / medium | Discord plus in-game Feedback link spec, release notes | `docs/community.md` |
| RESERVE OPS | sonnet-5-5 / medium | How-to-play, README and credits copy audit | `docs/copy-audit.md` |

## Game Master's own lane
Flaky 20s timeouts in `candy.spec.ts` and `kit-loot.spec.ts`; final typecheck, vitest, lint and build; commit and push; monorepo pin bump.

## Riskiest assumption
OGG Vorbis plays on every target browser. Safari support is recent. Kill-test: the loader must feature-detect with `canPlayType` and fall back to MP3, then check the web build in a Safari-class browser.

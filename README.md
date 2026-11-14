# Undead of Night: Take One

A Hall of the Gods, Inc. game. A top-down pixel art zombie survival game across ten levels at night. Ammo and health are scarce, so you search buildings and furniture for them, and every gunshot tells nearby zombies where you are. Survive each town's hordes and get to the van.

**Play solo in your browser:** https://undeadofnight.forthexp.com/

Every level is its own kind of town: oak and pine suburbs, scrapland, a flooded marsh, blighted fungus fields, a pine forest, a fenced cordon, snowbound tundra, a hive and a burning ashland. Each has its own plants, ground, park, landmark and footsteps. The full rules are in [docs/README.md](docs/README.md). The plan for getting players, Steam and consoles is in [docs/launch-plan.md](docs/launch-plan.md).

Multiplayer needs the game server, which GitHub Pages cannot host. Run it yourself to play together; see [docs/README.md](docs/README.md).

## Run it

```bash
pnpm install
pnpm dev            # the game on a Vite dev server
pnpm dev:server     # the co-op game server
pnpm test           # the test suite
pnpm run build      # type check and production build into dist/
```

## Repo, versions and deploys

This repo is a submodule of the Xophz-COMPASS monorepo (`apps/zombie-survival`). Commit and push here, then bump the pointer in the monorepo.

Every push to `main` runs the org's autobump through [Auto Version](.github/workflows/auto-version.yml): it calculates a minute-precision CalVer (`YY.M.D-MINUTES`), writes it to `package.json`, commits that as `chore: auto-bump version … [skip ci]` and tags `v<version>`. When Auto Version succeeds, [Deploy to GitHub Pages](.github/workflows/pages.yml) builds the bumped tip of `main` and publishes it. Do not edit the version by hand. A commit message holding `[skip ci]` is neither bumped nor deployed; run the Pages workflow by hand for those.

Music by ExoticService. Licensed under the True Omni-Source License (TOSL) 1.0; see [LICENSE](LICENSE).

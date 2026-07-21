# Centralize camera Follow and View

## What changed

- Replaced the three-way camera mode with two independent runtime settings:
  `Follow` (`Spacecraft` or the active `Target`) and `View` (`Locked` or
  `Free roam`).
- Centralized camera target resolution so every frame derives the camera target
  from the current followed subject plus a relative free-roam offset.
- Added separate C and L shortcuts, adjacent Follow and View controls in the
  shared in-game Controls popover, and notices that report both values.
- Migrated scenario directives, tutorial checkpoints, debug snapshots, crash
  recovery, and the DevTools protocol to the new state model.
- Removed the duplicate mobile Nav camera selector; mobile and desktop now use
  the same Controls popover.

## Why

The previous `centered` / `target` / `unlocked` mode combined two decisions:
what the camera follows and whether the player can pan away from it. That made
free roaming lose its follow subject and made camera state inconsistent across
runtime, scenarios, snapshots, UI, and DevTools. Independent axes allow target
follow to remain live while panning and make each control predictable.

## Ownership boundaries

- `src/runtime/runtimeActions.ts` resolves the live follow subject, applies the
  relative pan offset, and owns Follow/View transitions.
- `src/scenario/scenarioDirectiveTypes.ts`, `src/scenario/scenarioDirectives.ts`,
  and `src/scenario/scenarioSession.ts` define forced camera state and persisted
  checkpoint compatibility.
- `src/ui/components/InGameControlsMenuSurface.tsx` and
  `src/ui/createInGameControlsMenu.ts` own the shared camera controls.
- `src/devtools/devtoolsBridge.ts` and `extension/space-web-game-devtools/` own
  protocol version 2 and the matching extension controls.
- `src/debugScenarioSnapshot.ts` owns snapshot version 3 and defaults older
  snapshots to Follow Spacecraft / View Locked.

## Important decisions

- Free-roam pan is stored relative to the followed subject. Changing Follow
  therefore preserves both View and pan offset, including when the automatic
  assist target changes later.
- Switching to Locked immediately centers on the current followed subject but
  does not mutate the saved relative offset. Entering Free roam derives the
  current dock-aware framing offset so the visible world does not jump.
- Legacy camera fields remain read-only migration inputs for saved checkpoints
  and scenario state. They are not exposed through current runtime or UI APIs.
- Camera controls are scenario-locked together because existing onboarding
  gates treat camera interaction as one capability. Enabling that lock makes
  Locked view authoritative and blocks pan, crash-inspection unlock, and focal
  free-roam zoom adjustments.
- Legacy `centered` directives restore Spacecraft follow as well as Locked view;
  legacy `target` and `unlocked` mappings retain their prior meanings.

## Validation

- `npm run build`
- `npm test` (578 tests)
- `npm run test:gui` (79 Playwright tests), including desktop/mobile Follow
  and View controls, keyboard notices, drag-to-free-roam behavior, framing,
  and accessibility.
- Visually inspected the generated mobile and desktop Controls screenshots;
  both settings are adjacent, readable, and show their selected values.
- PR review follow-up: focused runtime/directive tests (40), full Vitest suite
  (581), automation claim/workflow tests (19), production build, changed-file
  Biome checks, diff checks, and focused camera-drag Playwright coverage (4)
  all passed after adding lock enforcement and legacy follow migration.

## Follow-ups and known gaps

- None identified. Production deployment remains outside this PR workflow.

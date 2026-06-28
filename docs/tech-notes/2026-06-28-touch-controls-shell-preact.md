# Touch Controls Shell Preact Boundary

Issue: https://github.com/chmurson/space-web-game/issues/92
Branch: `codex/issue-92-touch-controls-shell-preact`

## What Changed

- Migrated the root touch-controls shell markup to a typed Preact-rendered surface.
- Moved the `.touch-controls` panel and the four dock host elements for `warp`, `trajectory`, `target`, and `burn` into `touchControlsShell.tsx`.
- Kept existing control internals, reveal controls, gesture routing, touch suppression, settings side placement, presenter/model/runtime adapters, and CSS hooks unchanged.
- Added browser coverage for the shell root, dock classes, and `data-touch-control-dock` hooks.

## Why It Changed

Issue #92 is the shared setup slice for later touch-control migrations. The shell and dock host elements are the stable local boundary that all existing and future touch controls attach to. Rendering that boundary through Preact gives later slices a clear pattern without adding a generic touch-control framework, app-wide UI store, or broad runtime ownership changes.

## Key Files And Boundaries

- `src/ui/touchControls/touchControlsShell.tsx` owns the static Preact shell markup and the typed dock refs.
- `src/ui/touchControls/createTouchControls.ts` still owns control assembly, reveal-control creation, touch gesture routing, touch suppression, visibility sync, side-placement settings, and the public `TouchControls` API.
- Existing per-control modules remain responsible for their internals: edge reveal, thrust, target selector, time warp, trajectory horizon, and tutorial hint.
- `tests/gui/touchControlsShell.spec.ts` covers the local shell contract through the Vite-served browser environment.

## Decisions

- Render the shell once and return typed host elements. The existing controllers are already imperative and do not need a reactive shell rerender.
- Keep the detached-host render pattern used by nearby touch-control Preact views, then let `createTouchControls.ts` append the root panel at the same point it did before.
- Defer all individual control internals to their own slices. This branch only establishes the shared shell and dock mount pattern.
- Do not introduce an app-wide Preact store or generalized touch-control framework. Later surfaces can reuse this local pattern if they need typed mount hosts.

## Validation

- `npx biome check --write src/ui/touchControls/createTouchControls.ts src/ui/touchControls/touchControlsShell.tsx tests/gui/touchControlsShell.spec.ts` passed.
- `npm run build` passed after installing this worktree's dependencies with `npm ci` and fixing the local shell root ref type.
- `npm test` passed: 47 Vitest files, 319 Vitest tests, and 16 automation-claim tests.
- `npm run test:gui` passed: 25 mobile Chromium Playwright checks, including `tests/gui/touchControlsShell.spec.ts`.
- Inspected the generated touch-control screenshot artifacts:
  - `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png`
- Visual inspection result: all four revealed mobile controls stayed docked to their expected edges, preserved the center playfield, and did not overlap the top HUD or Mission Brief pill.
- `coderabbit --base main --agent` completed with three findings. The valid finding was this validation placeholder, fixed here. Two findings targeted pre-existing per-control internals (`timeWarpFeedbackView.tsx` and `thrustControl.tsx`) that are outside issue #92's shell-only scope and appeared because local `main` is behind current `origin/main`.
- `npm run deploy:netlify` passed and deployed to staging: `https://fanciful-bunny-d77b4b.netlify.app` (unique deploy `https://6a411e0dbea77486a9929288--fanciful-bunny-d77b4b.netlify.app`).

## Follow-Ups

- Continue per-control Preact migrations in their dedicated issue slices; this note records the shared shell boundary they should attach to.

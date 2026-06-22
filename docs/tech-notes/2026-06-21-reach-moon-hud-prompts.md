# Reach the Moon HUD Prompts

Issue: https://github.com/chmurson/space-web-game/issues/18
Branch: `codex/issue-18-reach-moon-hud-prompts`
Shipit state: `.codex/shipit-workflows/codex/issue-18-reach-moon-hud-prompts.md`

## What Changed

- Added Reach the Moon mission prompt definitions for the mission brief, Moon arrival, lunar-orbit completion, Earth arrival, and mission completion.
- Wired existing Reach the Moon phase transitions to activate those prompt ids.
- Added a compact top HUD fuel pill for finite-fuel scenarios.
- Added a durable bottom HUD notice when finite fuel reaches zero.
- Added responsive top-HUD density handling: fuel and speed stay separate pills inside a layout-only cluster, stack only on very narrow screens, and target text collapses before numeric telemetry can ellipsis.

## Why

Reach the Moon already had finite fuel and objective tracking, but players had no visible fuel status or mission-state messaging. The HUD and prompt additions make the mission understandable without changing the simulation model.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns Reach the Moon prompt definitions and phase prompt activation.
- `src/ui/overlayUI/createOverlayUi.ts` owns the fuel pill and fuel-depleted notice elements.
- `src/presentation/hudPresentation.ts` owns per-frame fuel HUD synchronization from runtime state.
- `src/style.css` and `src/ui/overlayUI/overlayUIStyles.css` own compact fuel HUD and notice styling.
- `tests/scenario/specific-scenarios/reachMoonScenario.test.ts` covers the prompt flow.

## Decisions

- Reused scenario prompts instead of adding a separate mission-message system.
- Used `spacecraft.fuelCapacity > 0` as the existing finite-fuel opt-in for HUD visibility.
- Kept depleted-fuel notice derived from current runtime state so reset and scenario changes clear it automatically.
- Displayed remaining fuel as a percent because `spacecraft.fuel` is already normalized.
- Kept tiny positive fuel from displaying as depleted: any positive fraction that rounds below 1% displays as `1%` and uses the low-fuel state.
- Kept fuel and speed as separate telemetry pills instead of merging states. The `telemetry-critical-cluster` wrapper only controls layout and has no HUD state.
- Made target text the first top-HUD content to collapse on mobile because the target remains visible through the icon/status and playfield/offscreen indicators.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/runtimeScenario.test.ts tests/scenario/scenarioPrompts.test.ts`
- `npx biome check src/presentation/hudPresentation.ts src/scenario/specific-scenarios/reachMoonScenario.ts src/ui/overlayUI/createOverlayUi.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts`
- `npm test`
- `npm run build`
- `npm run deploy:netlify`
- `git diff --check`
- `coderabbit --base main --agent`
- Browser playtest with system Chrome through CDP:
  - Desktop and mobile initial mission prompt screenshots.
  - Desktop and mobile dismissed prompt screenshots.
  - Desktop and mobile depleted-fuel debug-snapshot screenshots.
  - Desktop and mobile tiny-positive-fuel debug-snapshot screenshots.
  - Crowded mobile top-HUD screenshots at 390px, 360px, and 320px with multi-day elapsed time, high speed, finite fuel, and max Reach the Moon time warp.
  - Verified fuel pill text/states, prompt/replay state, depleted notice visibility, and no HUD/notice overlap in checked viewports.
- Build completed with the existing Vite chunk-size warning.
- CodeRabbit completed with 0 findings after two temporary rate-limit responses.
- Staging deployed to https://space-web-game-woven-moth.netlify.app with latest unique deploy https://6a38c352cee129eade6136ff--space-web-game-woven-moth.netlify.app.
- `npx biome check src/style.css src/ui/overlayUI/overlayUIStyles.css` still reports baseline formatter differences and two pre-existing `!important` lint warnings from `main`; this branch did not introduce them.

## Follow-Ups

- Score summary and high-score routing remain owned by #19 and #20.

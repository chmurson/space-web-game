# Telemetry and FPS Preact Shell

## What Changed

- Moved the top telemetry strip shell out of `innerHTML` in `src/ui/overlayUI/createOverlayUi.ts` and into the typed Preact component `src/ui/components/HudTelemetrySurface.tsx`.
- Added an isolated Preact FPS indicator surface for the FPS text and SVG graph.
- Kept `hudPresentation.ts` as the high-frequency telemetry owner: time, thrust/crash, fuel, speed, target, clock icon, target sphere, and target status still update through stable DOM refs.
- Changed the FPS presentation path to render only the isolated FPS surface on the existing throttled cadence instead of rebuilding text/SVG nodes manually.

## Why It Changed

Issue #79 is part of the Preact DOM UI migration. The telemetry strip and FPS meter were still owned by string markup or ad hoc DOM creation, but their values are performance-sensitive enough that migrating them to broad reactive HUD state would add unnecessary work.

## Key Files And Boundaries

- `src/ui/components/HudTelemetrySurface.tsx` owns static telemetry markup, data-stat hooks, telemetry icon SVGs, the FPS root, and FPS graph markup.
- `src/ui/overlayUI/createOverlayUi.ts` owns shell creation, Preact host placement, and the `OverlayUiRefs` adapter returned to app composition.
- `src/presentation/hudPresentation.ts` owns runtime telemetry values, visibility toggles, animation classes, target/fuel state, and the existing FPS update throttle.
- Deferred surfaces remain owned by their issues or existing modules: bottom HUD notices (#78), scenario prompts (#76), debug panel internals, body labels, offscreen indicators, spacecraft callout, and heading target visuals.

## Decisions

- No global Preact HUD store was added.
- Telemetry renders once and exposes refs so per-frame values remain targeted DOM writes.
- FPS renders through a small isolated Preact surface only when the existing FPS throttle asks for a refresh.
- Preact host wrappers use `display: contents` so top bar flex layout and app-level FPS positioning keep their existing CSS behavior.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/hudPresentation.test.ts` passed with 5 focused HUD presentation tests.
- `npm run build` passed, including config validation, TypeScript, and release Vite build. Vite still reports the existing chunk-size warning.
- `npm run test:gui` passed with 17 Playwright GUI screenshot/adapter tests.
- GUI screenshot inspection confirmed the migrated top telemetry strip stayed compact and clear across the covered mobile HUD, time-warp, and target-selector states.
- Manual Playwright FPS smoke confirmed the Preact-rendered FPS meter became visible, reported a good status, and stayed in the expected top-right HUD position.
- CodeRabbit review findings were handled and the rerun completed with zero findings.
- `npm run deploy:netlify` passed and deployed the non-main branch to staging.

## Follow-Ups

- None currently. Continue separate issue ownership for bottom HUD notices, scenario prompts, debug internals, and world-space overlays.

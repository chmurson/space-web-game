# Hide Early Tutorial Orbit Point Markers

## What Changed

Ap/Pe orbit point marker dots and labels are hidden while the tutorial scenario is in the `escape-earth` phase, which is the tutorial phase before `reach-moon`.

The markers render again when the tutorial reaches `reach-moon` and remain available for later tutorial phases. Non-tutorial scenarios keep the existing orbit point display behavior.

## Why

Early tutorial coaching should keep the playable surface focused on the current lesson. Apoapsis and periapsis concepts are useful later, but they add visual noise before the player reaches the Moon objective.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns the visual marker gate and combines the tutorial phase with the existing orbit point display settings.
- `tests/presentation/trajectoryPresentation.test.ts` covers marker visibility before `reach-moon`, at `reach-moon`, and outside tutorial mode.

## Decisions

- The change is presentation-only. Trajectory prediction points, event marker data, and orbit prediction refresh behavior are unchanged.
- The existing `OrbitPointDisplaySettings.markersVisible` path is reused so marker dots and labels hide together through the established renderer behavior.
- The tutorial `escape-earth` phase is treated as the pre-`reach-moon` phase. The override is not applied to `reach-moon`, `orbit-moon`, `return-earth`, `orbit-earth`, or `complete`.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/trajectoryPresentation.test.ts`
- `npx biome check src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryPresentation.test.ts docs/tech-notes/2026-07-06-hide-tutorial-orbit-points.md`
- `npm run build`
- `npm run test`
- `npm run test:gui`
- `git diff --check`

Inspected screenshots:

- `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`
- `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`

`coderabbit --base main --agent` connected and entered analysis, then produced no findings or progress for several minutes. The local run was stopped and recorded as stalled.

## Follow-Ups

None currently known.

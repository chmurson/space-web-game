# Tutorial Trail Debug Replay Regression

## What Changed

- Added a Playwright GUI regression that writes a fixed tutorial debug checkpoint into localStorage, boots `?scenario=debug-snapshot`, and lets the real tutorial scene advance into the Reach the Moon transfer phase.
- The test uses the existing devtools bridge to ensure Moon is selected, zooms until the scenario viewport clamp reaches `1000`, advances time, and asserts nonzero trail slices in the debug panel.
- The test also checks the WebGL canvas has nonblank pixels and captures a screenshot artifact for visual review.

## Why It Changed

Issue #60 is a follow-up to the manual debug replay used for the tutorial trail fix in #57. The manual path proved useful, but it was easy to regress because no deterministic browser test exercised the restored debug snapshot, Moon target selection, transfer trail rendering, and visible WebGL output together.

## Key Files

- `tests/gui/tutorialTrailDebugReplay.spec.ts`: owns the replay checkpoint fixture and browser regression.
- `src/debugScenarioSnapshot.ts`: existing snapshot load format used by the test.
- `src/devtools/devtoolsBridge.ts`: existing browser bridge used to drive target selection, zoom, and time warp without adding product-only test APIs.

## Decisions

- Used existing scenario primitives to build the fixed checkpoint instead of requiring a pasted owner snapshot in the issue.
- Started the snapshot just past the tutorial escape threshold so the real scenario code performs the transition to `reach-moon`.
- Kept assertions on public runtime/debug surfaces: devtools snapshot, visible debug panel text, and canvas pixels.

## Validation

- `npx biome check tests/gui/tutorialTrailDebugReplay.spec.ts docs/tech-notes/2026-06-28-tutorial-trail-debug-replay-regression.md`: passed.
- `npm run test:gui -- tutorialTrailDebugReplay.spec.ts`: passed, 1 Playwright test.
- `npm run build`: passed; Vite reported the existing large chunk warning.
- `npm run test:gui`: passed, 20 Playwright GUI tests.
- Inspected GUI screenshot artifact: `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`. It matched the expected replay state with `reach-moon`, Moon selected, viewport `1000.00`, nonzero trail slices, inertial trail frame, and nonblank WebGL output.
- `git diff --check`: passed.
- `coderabbit --base main --agent`: first run found one valid issue about using the generic Earth-Moon sandbox as the fixture source; fixed by seeding from the registered tutorial scenario through the Vite-served browser context. Follow-up run completed with 0 findings.

## Follow-Ups

- None currently.

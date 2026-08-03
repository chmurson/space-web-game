# Earth Kepler orbit debug scenario

Source PR: [#330](https://github.com/chmurson/space-web-game/pull/330)

## What changed

- Added the `earth-kepler-orbit-debug` developer scenario.
- The scenario contains only stationary Earth and a spacecraft in a circular 400 km parking orbit.
- Registered it with an Earth-scale viewport limit and initial Earth-scale view.

## Why

The closed-orbit predictor in PR #330 applies only when the selected body is the sole massive body. Existing playable scenarios all retain Moon gravity, including the menu background where the Moon is only hidden visually. This scenario supplies a direct in-game validation case for the complete Kepler loop.

## Ownership and decisions

- `src/simulation/scenarios/earthMoon.ts` owns the Earth-only initial physical state alongside the existing Earth-Moon fixtures.
- `src/scenario/scenarioRegistry.ts` owns its URL-selectable scenario registration and viewport directive.
- The scenario remains developer-facing through the existing `devtools=1` gate for the Kepler prediction implementation; it does not change the normal player flow.

## Validation

- Focused Vitest passed 82 tests across scenario registration, Kepler prediction, runtime, and presentation.
- Full `npm test` passed 787 product tests, 16 task-claim tests, and 7 workflow tests.
- Focused Playwright passed desktop and mobile checks. Both assert the `closed-orbit` termination reason and capture the complete trajectory loop:
  - `tmp/playwright-results/keplerTrajectoryPlaytest-k-5a383-rediction-active-on-desktop-mobile-chromium/desktop-kepler-trajectory.png`
  - `tmp/playwright-results/keplerTrajectoryPlaytest-k-7e3e6-prediction-active-on-mobile-mobile-chromium/mobile-kepler-trajectory.png`
- `npm run build`, task-scoped Biome, and `git diff --check` passed. Vite emitted only its existing large-chunk advisory.
- Full `npm run test:gui` passed 104 browser tests.

## Follow-up

- Multi-body trajectories still use the numerical predictor. A future patched-conic or dominance-aware design would be needed to render closed segments in Earth-Moon space.

# Reach the Moon Fuel Model

## What Changed

- Added finite fuel consumption for spacecraft thrust and attitude turning.
- Kept fuel optional by using `spacecraft.fuelCapacity > 0` as the finite-fuel opt-in.
- Made Reach the Moon start with a finite `32_000 kg` capacity.
- Kept Earth-Moon sandbox, Tutorial, and Moon capture debug unlimited by default.
- Made remaining fuel affect spacecraft mass through the existing `dryMass + fuelMass * fuel` model.

## Why

Issue #16 needs the core mission resource pressure before objective tracking, HUD prompts, scoring, and highscores can build on it. The first pass keeps the existing spacecraft state shape and avoids a broader mission-resource framework.

## Key Files

- `src/simulation/physics/semiImplicitEuler.ts` owns fuel use, depletion clamping, thrust scaling, turning scaling, and fuel-mass acceleration effects.
- `src/runtime/simulationStep.ts` drops fuel-consuming controls when finite fuel is already depleted so no-op thrust does not stay active.
- `src/simulation/scenarios/earthMoon.ts` keeps the shared Earth-Moon world unlimited unless a caller opts into finite capacity.
- `src/scenario/scenarioRegistry.ts` opts `reach-moon` into finite fuel.
- `tests/simulation/physics/semiImplicitEuler.test.ts`, `tests/runtime/simulationStep.test.ts`, and `tests/scenario/runtimeScenario.test.ts` cover the new behavior.

## Decisions

- `fuel` remains the normalized remaining tank fraction.
- `fuelCapacity` is the finite capacity in kg; `0` means unlimited.
- `fuelUsed` records consumed finite fuel in kg and stays unchanged for unlimited scenarios.
- Main, reverse, strafe, and turn controls all consume fuel.
- If a frame only has partial fuel available, thrust and turning are scaled by the available fraction before fuel clamps to zero.
- HUD fuel pill and depleted-fuel notification remain follow-up work for #18.
- Objective tracking and scoring remain follow-up work for #17 and #19.

## Validation

- `npx vitest run tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/simulationStep.test.ts tests/scenario/runtimeScenario.test.ts`
- `npx vitest run tests/simulation/physics/semiImplicitEuler.test.ts tests/runtime/simulationStep.test.ts tests/scenario/runtimeScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `npm test`
- `npm run build`
- `npx biome lint src tests scripts`
  - Exited successfully with an unrelated existing `src/style.css` `!important` warning.
- `git diff --check`
- Browser smoke on the local dev server:
  - Reach the Moon started with `fuelCapacity: 32000`.
  - A short main-thrust burn increased `fuelUsed` and lowered remaining fuel.
  - Free Roam started with `fuelCapacity: 0` and did not spend fuel under thrust.
  - Mobile 390x844 menu and gameplay screenshots were visually checked for overlap.
- `coderabbit --base main --agent` was attempted, but stalled in the reviewing phase and was stopped after repeated heartbeat messages without findings output.
- `npm run deploy:netlify`
  - Shared staging: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy: https://6a3532409f7e9b2304f24fb8--fanciful-bunny-d77b4b.netlify.app

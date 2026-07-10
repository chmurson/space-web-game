# Smoother Time Warp Steps

## What Changed

- Replaced the shipped Time Warp ladder with the requested smoother sequence from `1s` through `15h`.
- Updated the runtime scenario setter so requests for a missing exact warp, such as the existing `300s` menu/background target, choose the fastest configured value at or below the requested cap instead of falling back to the minimum.
- Added regression coverage for the configured ladder, label formatting, scenario cap selection, active-control cap selection, and menu/runtime value mapping.

## Why

Issue #228 requested smoother Time Warp progression without changing scenario or gameplay caps. The new ladder intentionally removes some old sparse values, so cap logic has to stay value-based and tolerate missing exact requested values.

## Key Files

- `config/base.yml` owns the shipped Time Warp ladder.
- `src/runtime/runtimeActions.ts` owns scenario/runtime actions that request specific Time Warp values.
- Time Warp cap behavior remains in `src/scenario/scenarioDirectives.ts` and `src/runtime/simulationStep.ts`.

## Decisions

- Kept existing label formatting (`x1s`, `x2m`, `x4h`) rather than introducing a new label style.
- Left existing scenario caps such as `300s` unchanged; with the new ladder they resolve to the highest available configured value not above the cap.
- Avoided adding a shared test helper for the new ladder so the production source of truth stays in config and the test diff remains local.

## Validation

- `npm run validate:config` passed after installing lockfile dependencies with `npm ci`.
- `npx vitest run --config vite.config.ts tests/config/gameConfig.test.ts tests/ui/formatters.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/runtime/runtimeActions.test.ts tests/runtime/simulationStep.test.ts tests/runtime/timeWarpFeedbackPolicy.test.ts tests/scenario/scenarioDirectives.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` passed: 9 files, 91 tests.
- `npm run build` passed.
- `npx biome check` passed for touched TypeScript source and tests.
- `git diff --check` passed.
- `npm run test:gui` was not run because the change does not alter Time Warp control markup, CSS, responsive layout, or visible control structure.

## Follow-Ups

- None.

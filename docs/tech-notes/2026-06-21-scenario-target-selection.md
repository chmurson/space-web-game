# Scenario Target Selection

## What Changed

- Removed built-in scenario forced assist targets from Reach the Moon and tutorial phase directives.
- Kept scenario camera, prediction horizon, time-warp, hidden-body, and viewport directives intact.
- Left generic `forcedAssistTargetId` directive support in place for custom/debug scenarios.

## Why

Mission phases should not override normal target selection. The game already starts with automatic target selection when auto targeting is enabled, and user target selection switches the runtime to manual mode.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- `tests/scenario/specific-scenarios/reachMoonScenario.test.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `tests/scenario/scenarioDirectives.test.ts`

## Decisions

- Built-in scenarios should guide mission progression through scenario state, prompts, and camera/viewport limits rather than target locks.
- Generic forced-target directive support remains available because it is still part of the scenario directive API and useful for custom/debug flows.

## Validation

- `npm test`
- `npm run build`
- `npx biome lint src tests scripts`
- `git diff --check`

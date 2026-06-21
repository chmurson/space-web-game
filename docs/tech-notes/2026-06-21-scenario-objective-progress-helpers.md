# Scenario Objective Progress Helpers

## What Changed

- Added shared scenario helpers for target-distance checks and orbit-progress counting.
- Moved Reach the Moon objective distance and signed orbit progress onto the shared helpers.
- Moved tutorial orbit phase distance checks and absolute orbit progress onto the same helpers without moving tutorial prompt or checkpoint behavior.

## Why

Reach the Moon and the tutorial both needed target-distance and orbit-completion logic. Keeping separate copies made the next mission likely to duplicate the same angle, bound-orbit, and distance checks again.

## Key Files

- `src/scenario/scenarioObjectiveProgress.ts` owns reusable objective radius checks, target lookup, angle normalization, and orbit progress accumulation.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` keeps Reach the Moon phase flow and chooses signed orbit progress with an objective-radius guard.
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts` keeps tutorial prompts/checkpoints and chooses absolute orbit progress to preserve existing tutorial behavior.
- `src/scenario/specific-scenarios/tutorial/tutorialScenarioTypes.ts` reuses the shared orbit-progress state shape.

## Decisions

- The helper returns plain progress state instead of scenario transitions, so each scenario still owns its prompts, checkpoints, and phase changes.
- Signed progress is the default because it prevents backtracking from becoming false orbit completion.
- Absolute progress remains available for the tutorial because that was the existing tutorial behavior.
- The objective-radius reset during orbit progress is optional; Reach the Moon uses it, tutorial orbit phases keep their existing bound-only reset semantics.

## Validation

- `npm test`
- `npm run build`
- `npx biome lint src tests scripts`
- `git diff --check`

## Follow-Ups

- New mission scenarios should prefer `isWithinScenarioObjectiveRadius` and `advanceScenarioOrbitProgress` before adding local orbit/distance math.

# Reach the Moon Objective Tracking

## What Changed

- Added explicit Reach the Moon mission state.
- Advanced the mission through Moon approach, three lunar orbits, Earth return, one Earth orbit, and completion.
- Counted orbit progress from signed angular travel around the active objective body while inside the objective radius.
- Marked the scenario session complete only after the final Earth orbit objective.

## Why

Issue #17 needs the core win-condition state before HUD prompts, scoring, and highscores can build on it. The first pass keeps the behavior scoped to Reach the Moon instead of adding a general mission framework.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns Reach the Moon mission phases, objective-distance checks, bound-orbit progress, and scenario directives.
- `src/scenario/scenarioRegistry.ts` registers Reach the Moon as its own scenario definition.
- `tests/scenario/specific-scenarios/reachMoonScenario.test.ts` covers ordered mission progress, backtracking rejection, unbound orbit-progress reset, and initial approach behavior.
- `tests/scenario/runtimeScenario.test.ts` verifies Reach the Moon starts with explicit objective state.

## Decisions

- `reach-moon` starts with `{ phase: "reach-moon" }` in `scenarioSession.state`.
- Orbit phases store `orbitProgressRadians`, `orbitTurnsCompleted`, and `previousOrbitAngle`.
- Orbit progress only counts while the spacecraft is inside the objective radius and bound to the current objective body (`specificEnergy < 0`).
- Angular progress is signed so reversing direction subtracts progress instead of creating false completed loops.
- The lunar objective requires three Moon orbits; the return objective requires one Earth orbit.
- Visible mission prompts, fuel HUD, score summary, and high-score routing remain follow-up work for #18, #19, and #20.

## Validation

- `npx vitest run tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/runtimeScenario.test.ts`
- `npx vitest run tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/runtimeScenario.test.ts tests/runtime/runtimeStateTransitions.test.ts tests/debugScenarioSnapshot.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `npm run build`

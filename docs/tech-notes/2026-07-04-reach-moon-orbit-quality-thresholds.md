# Reach the Moon Orbit Quality Thresholds

## What Changed

- Tightened the full lunar orbit quality bonus threshold from `500 km` apoapsis to `100 km` apoapsis.
- Raised the safe periapsis floor from `10 km` to `25 km`, so risk penalties now begin below `25 km`.
- Updated scenario prompt and score/highscore tests for the new thresholds.

## Why

The previous curve made a wide range of low lunar orbits qualify for the maximum orbit-quality bonus. The new thresholds make the best score require a closer but still safe lunar orbit, while treating lower periapsis passes as risky sooner.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScore.ts` owns the scoring thresholds and unchanged linear bonus/penalty formula.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` consumes the same constants for prompt copy and bottom-pill notice classification.
- `tests/scenario/specific-scenarios/reachMoonScore.test.ts`, `tests/scenario/specific-scenarios/reachMoonScenario.test.ts`, `tests/scenario/specific-scenarios/reachMoonHighscores.test.ts`, and `tests/netlify/reachMoonHighscoresFunction.test.ts` cover the updated scoring contract.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
- `npx biome check src/scenario/specific-scenarios/reachMoonScore.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
- `npm run build`

# Reach Moon Polynomial Score

Date: 2026-07-01

## What changed

- Replaced the reach-moon score formula with two bounded polynomial components:
  - fuel-left score, capped at 200 points
  - elapsed-time score, capped at 50 points
- Changed the mission-complete score summary from penalty/bonus wording to additive component wording.
- Added the tuning workbook at `docs/score-models/reach-moon-polynomial-score-model.xlsx`.

## Why

The old formula started from a base score and subtracted elapsed-time penalties while adding a small fuel bonus. The new model makes fuel efficiency the primary score driver and time the secondary score driver, matching the latest score-tuning spreadsheet.

## Key files

- `src/scenario/specific-scenarios/reachMoonScore.ts` owns the runtime scoring formula and score summary text.
- `tests/scenario/specific-scenarios/reachMoonScore.test.ts` locks the fuel and elapsed-day curve outputs from the spreadsheet.
- `tests/scenario/specific-scenarios/reachMoonScenario.test.ts` verifies completed reach-moon runs carry the recomputed score into scenario state and prompts.
- `tests/scenario/specific-scenarios/reachMoonHighscores.test.ts` and `tests/netlify/reachMoonHighscoresFunction.test.ts` verify highscore records still recompute server-trusted scores.

## Decisions

- Kept the serialized `ReachMoonScoreSummary` field names for compatibility with existing highscore records and storage validation.
- Set `baseScorePoints` to `0` under the new additive model.
- Kept `fuelBonusPoints` and `timePenaltyPoints` as numeric component fields even though the display text now treats both as positive score contributions.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts tests/runtime/highLevelActions/registerHighLevelActions.test.ts`
- `npm run build`
- `npm test`
- `npm run deploy:netlify`

Staging deploy:

- `https://fanciful-bunny-d77b4b.netlify.app`
- `https://6a458da317a5e25671494750--fanciful-bunny-d77b4b.netlify.app`

## Follow-ups

- Consider renaming score payload fields in a later migration if persisted highscore compatibility stops mattering.

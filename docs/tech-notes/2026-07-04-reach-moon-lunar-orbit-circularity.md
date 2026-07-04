# Reach the Moon Lunar Orbit Circularity

## What Changed

- Added a Reach the Moon lunar orbit circularity bonus worth up to 25 points.
- Calculates eccentricity from completed Moon-relative apoapsis and periapsis radii.
- Keeps the best completed lunar orbit by one combined altitude, risk, and circularity score.
- Stores derived circularity points and eccentricity on new score summaries.
- Updates score summary, highscore rows, and bottom notices with compact circularity context.
- Keeps missing circularity fields compatible by treating them as no circularity bonus.

## Why

Issue #48 extends the existing lunar orbit quality slice from issue #21. A good Reach the Moon lunar orbit should be close, safe, and reasonably round, while still avoiding broader orbit-quality scope such as Earth scoring, maneuver detection, or long-term stability analysis.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScore.ts` owns the eccentricity formula, circularity curve, combined score, and score-summary formatting.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns completed-orbit metric selection, one-notice-per-improvement behavior, and mission prompt copy.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` continues to validate apoapsis/periapsis input and recompute scores server-side.
- `netlify/functions/reach-moon-highscores/post.ts` uses the widened shared orbit-quality maximum for plausibility checks.
- `src/ui/components/MainMenuSurface.tsx` displays orbit context through the shared formatter.

## Decisions

- The submitted highscore input remains apoapsis/periapsis only; raw eccentricity is derived locally and on the server from the same metric.
- Unsafe low-periapsis orbits get zero circularity points, while the existing low-periapsis risk penalty remains unchanged.
- Legacy score summaries can omit `lunarOrbitCircularityPoints` and `lunarOrbitEccentricity`; display code only adds circularity copy when those fields are present.
- High but near-circular lunar orbits can earn circularity points even when altitude points are low.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts`

## Follow-Ups

- None currently. Earth/general-body scoring, maneuver detection, return scoring, and stability analysis remain out of scope for this issue.

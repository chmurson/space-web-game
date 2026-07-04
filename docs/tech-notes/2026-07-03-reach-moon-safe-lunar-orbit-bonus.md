# Reach the Moon Safe Lunar Orbit Bonus

## What Changed

- Added a Reach the Moon lunar orbit quality score component worth up to 50 points.
- Tracked Moon-relative periapsis and apoapsis altitude for completed lunar orbits during the existing three-orbit Moon phase.
- Carried the best completed lunar orbit metric into completed-run and highscore submission payloads.
- Recomputed and validated the same metric in the Netlify highscore submission path.
- Added Moon-arrival prompt copy and a transient bottom notice for first or improved lunar orbit quality results.
- Updated score summaries and highscore rows to show orbit quality as a separate component with altitude context.

## Why

Issue #21 narrowed Reach the Moon scoring to one concrete optional bonus: a close, safe lunar orbit. The existing mission flow already requires three bound Moon orbits, so the implementation reuses that completion signal instead of adding a separate stability detector.

## Key Files

- `src/scenario/specific-scenarios/reachMoonScore.ts` owns scoring constants, orbit quality calculation, rounding, and display formatting.
- `src/scenario/specific-scenarios/reachMoonScenario.ts` owns runtime altitude tracking, best-orbit selection, prompt copy, and transient notice creation.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` owns highscore input validation/defaulting and server-side score recomputation.
- `netlify/functions/reach-moon-highscores/post.ts` owns the highscore plausibility ceiling and near-max audit threshold.
- `src/ui/components/MainMenuSurface.tsx` and `src/style.css` own highscore and completed-run display.

## Decisions

- Missing orbit-quality fields default to `null`/zero points so old completed-run state and legacy highscore records keep loading.
- Current-orbit altitude extrema reset after each completed lunar orbit or orbit-progress reset.
- Only improved best orbit results emit a transient notice; equal or worse completed orbits do not create a new notice.
- The bonus uses the existing bound lunar-orbit requirement as the stability signal, matching the issue non-goal to avoid long-term stability analysis.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
- `npm run format`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:gui`

## Follow-Ups

- None required for issue #21. Classic maneuver detection, return scoring, low-fuel scoring, and body-general safe-altitude scoring remain explicit non-goals.

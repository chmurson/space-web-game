# Tutorial Prograde Time-Warp Burn Heading

## What Changed

When tutorial onboarding enters `intro-timewarp-thrust`, it now sets the ship target heading to the prograde tangent of the ship's local orbit around the nearest body.

The tutorial phase order and prompt copy are unchanged.

## Why

The previous target heading pointed radially outward from the nearest body. That made the ship turn away from the body instead of aligning with the visible orbit direction before the high-warp burn prompt.

## Key Files

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts` owns onboarding progression and the automatic target heading for `intro-timewarp-thrust`.
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` covers the selected prograde heading and confirms onboarding still advances through the high-warp burn step.

## Decisions

- The prograde direction uses spacecraft velocity relative to the nearest body velocity, then removes the radial component so the heading is tangential at the current ship position.
- Degenerate radial or zero relative motion falls back to a perpendicular tangent rather than restoring a radial heading.
- No UI, HUD, prompt, or phase-order changes were needed.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts`
- `npx biome check src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `git diff --check`
- `npm run build`
- `npm run test`

The focused onboarding tests confirm the tutorial still reaches `intro-timewarp-thrust`, sets a prograde target heading, and advances through the high-warp burn step.

## Follow-Ups

None currently known.

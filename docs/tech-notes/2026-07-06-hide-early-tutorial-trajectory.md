# Hide Early Tutorial Trajectory

## What Changed

- Hid the trajectory/orbit presentation during the `intro-keep-thrusting`, `intro-thrusting-off`, and `intro-point-and-turn` onboarding coaches.
- Kept `intro-timewarp-thrust` unchanged: trajectory stays hidden before `hasStartedMainBurn` and returns after the high-warp burn starts.
- Extended focused onboarding hidden-UI tests for the three early coach steps and the preserved high-warp burn behavior.

## Why

Issue #192 reported that the tutorial trajectory became visible before the onboarding flow was ready to introduce it, which made the early coaching sequence noisier than intended.

## Key Files

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts` owns onboarding prompt and hidden-UI directives.
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` covers onboarding progression and hidden-UI policy.

## Decisions

- Kept the change in the existing hidden-UI policy instead of adding a new rendering flag or special-case presentation layer.
- Did not change tutorial copy.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` passed.
- `npx biome check src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts docs/tech-notes/2026-07-06-hide-early-tutorial-trajectory.md` passed.
- `npm run build` passed.
- `npm run test:gui` passed 37 Playwright tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png` and `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`; the tutorial coach and touch-control surfaces remained legible without obvious overlay collisions.

## Follow-Ups

- None.

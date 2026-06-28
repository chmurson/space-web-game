# Tutorial Speed Range Hints

## What Changed

- Added approximate speed guidance to the tutorial's Earth escape objective and trajectory coach prompt.
- Added approximate Moon orbit and Earth orbit speed ranges to the tutorial orbit intro prompts.
- Added a focused orbital-assist regression test showing spacecraft mass does not change target orbital-speed metrics.

## Why

The tutorial already told players what mission phase to complete, but it did not give practical speed targets at the points where transfer and capture planning matter. The new copy gives rough ranges while saying they are guidance, because useful speed still depends on transfer shape and orbit altitude.

## Key Files

- `src/scenario/specific-scenarios/tutorial/tutorialScenario.ts` owns the blocking tutorial phase prompts.
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts` owns the trajectory coach prompt shown during Earth escape onboarding.
- `tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts` and `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` cover the user-facing prompt copy.
- `tests/assist/orbitalAssist.test.ts` covers mass-independent orbital-speed metrics.

## Decisions

- Kept this as copy and tests only; no new UI layout, styling, prompt component, or tuning layer was needed.
- Used speed ranges as approximate guidance instead of requirements.
- Confirmed simulation semantics in code: orbital speed and specific energy are based on target body mass, distance, and relative velocity, while spacecraft mass is used for thrust acceleration and fuel effort.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/assist/orbitalAssist.test.ts`
- `npm test`
- `npm run build`
  - Passed with Vite's existing large-chunk warning.
- `npm run test:gui`
  - Passed all 25 Playwright GUI tests.
  - Inspected `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`.
- One-off mobile browser check of the updated `intro-trajectory` prompt:
  - Captured `tmp/manual-checks/intro-trajectory-speed-guidance-mobile.png`.
  - Confirmed the longer prompt text fits without overlapping HUD or touch controls.
- `npx biome lint src/scenario/specific-scenarios/tutorial/tutorialScenario.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/assist/orbitalAssist.test.ts`
- `git diff --check`
- `coderabbit --base main --agent`
  - Emitted one valid minor finding to replace the pending validation note; this section addresses it.
  - The session then stalled while still heartbeating and was stopped before a final CodeRabbit status.

## Follow-Ups

- None known.

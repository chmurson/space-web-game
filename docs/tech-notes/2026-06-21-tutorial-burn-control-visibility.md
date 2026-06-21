# Tutorial Burn Control Visibility

## What Changed

- Added a scenario directive for hiding the mobile Burn control independently from the thrust telemetry pill.
- Hid the Burn control during the tutorial's point-and-turn and time-warp guidance steps.
- Restored the Burn control for the `intro-timewarp-thrust` step, where the player is asked to burn at x30s.

## Why

The first burn lesson needs the Burn control visible, but the following pointing and warp lessons should keep the touch UI focused on the current task. Showing Burn again at the high-warp burn step matches the tutorial prompt that asks the player to open Burn and thrust.

## Key Files

- `src/scenario/scenarioDirectiveTypes.ts`
- `src/presentation/hudPresentation.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`
- `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`

## Decisions

- Kept the visibility rule in onboarding hidden-element policy so the touch-control component does not need tutorial step knowledge.
- Used a separate `thrustControl` directive instead of reusing `thrustPill`, because the telemetry pill and mobile Burn tab are different UI surfaces.
- Closing the Burn control also reports it as unrevealed, so onboarding progress cannot see a stale open control while the directive hides it.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/scenarioPrompts.test.ts tests/runtime/runtimeActions.test.ts tests/runtime/runtimeStateTransitions.test.ts tests/devtools/devtoolsBridge.test.ts`
- `npm test`
- `npx biome lint src tests scripts`
  - Reported existing `lint/complexity/noImportantStyles` warnings in `src/style.css`.
- `npm run build`
- Browser playtest at `http://127.0.0.1:5173/` with a 390x844 mobile-touch viewport:
  - Verified `intro-point-and-turn` hides the Burn control.
  - Verified `intro-timewarp` and `intro-keep-timewarp` keep Burn hidden while Warp is available.
  - Verified `intro-timewarp-thrust` exposes the Burn control again.
  - Captured `tmp/tutorial-timewarp-thrust-mobile-touch.png`.

## Follow-Ups

- None known.

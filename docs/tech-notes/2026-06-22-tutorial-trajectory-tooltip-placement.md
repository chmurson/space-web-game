# Tutorial Trajectory Tooltip Placement

## What Changed

- The tutorial `intro-trajectory` coach prompt now uses the existing floating/top prompt layout instead of anchoring over the playfield.
- Floating trajectory coach prompts draw a straight muted dashed SVG guide from the prompt toward the trajectory anchor.
- The guide refreshes when the trajectory anchor moves and after window resize, and hides when the prompt or anchor is unavailable.
- The guide is scoped to `intro-trajectory`; `intro-timewarp-thrust` keeps trajectory hidden until thrust is active at x30s.
- The target side panel stays hidden through the final onboarding prompts and returns after onboarding hands off to the escape-Earth objective.
- Existing prompt tests now expect the trajectory lesson to resolve as `floating`.

## Why

Issue #33 reported that the "This is your trajectory" callout covered the trajectory it was trying to explain. Moving the text near the top keeps the playfield readable while the neutral guide still connects the explanation to the projected path without competing with the cyan trajectory or ship icon.

## Key Files

- `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts` owns the tutorial prompt layout change.
- `src/ui/scenario-prompts/scenario-prompts.ts` owns guide refs and positioning.
- `src/ui/scenario-prompts/scenario-prompts.css` owns guide styling.
- `src/ui/overlayUI/createOverlayUi.ts` and `src/presentation/hudPresentation.ts` wire the active overlay guide elements.
- `tests/scenario/scenarioPrompts.test.ts` and `tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` cover the prompt layout expectation.

## Decisions

- Reused the existing coach prompt system instead of adding a new tutorial callout component.
- Reused the existing trajectory coach anchor that is already projected from trajectory presentation.
- Kept the guide in DOM/SVG rather than Three.js so it stays tied to the prompt layer and does not intercept gameplay input.
- Kept the guide as a straight line without an arrowhead so it does not read as another ship or trajectory element.
- Treating a burn as started during `intro-timewarp-thrust` now requires both main thrust and the x30s time warp gate.
- `targetControl` stays in the hidden UI set during `intro-trajectory` and `intro-complete`; the target pill is not hidden by this follow-up.

## Validation

- `npm run test -- tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `npm test`
- `npm run build` passed with the existing Vite large-chunk warning.
- `git diff --check`
- `npx biome check src/ui/scenario-prompts/scenario-prompts.ts src/ui/scenario-prompts/scenario-prompts.css src/ui/overlayUI/createOverlayUi.ts src/presentation/hudPresentation.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts tests/scenario/scenarioPrompts.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`
- `coderabbit --base main --agent` completed with zero findings.
- Browser QA against local Vite:
  - low-warp burn screenshot: `.codex/shipit-workflows/codex/issue-33-low-warp-burn-no-trajectory.png`
  - target side panel hidden screenshot: `.codex/shipit-workflows/codex/issue-33-trajectory-target-control-hidden.png`
  - desktop screenshot: `.codex/shipit-workflows/codex/issue-33-desktop-trajectory-prompt-straight.png`
  - mobile screenshot: `.codex/shipit-workflows/codex/issue-33-mobile-trajectory-prompt-straight.png`
- `npm run deploy:netlify`
  - staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - unique deploy URL: https://6a3945139fee9f150cbdfcd6--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- None known.

# Persistent Turn Planning Input

Branch: `codex/issue-200-turn-planning-input`
Issue: https://github.com/chmurson/space-web-game/issues/200

## What Changed

Ship turn planning now uses persistent desktop click confirmation and offers both mobile maneuver trigger models behind a persisted setting.

- Desktop: primary click starts a planned turn, mouse movement adjusts the preview, a second primary click confirms, and right click cancels.
- Mobile default: `Start turning by drag` is on, so a held touch starts a planned turn, dragging adjusts the preview, and release commits the turn.
- Mobile tap mode: turning the setting off makes a single tap start a planned turn, press-and-drag while planning adjusts the preview, release leaves the preview active, a second tap confirms, and a two-finger tap cancels.
- UI settings now includes `Spacecraft controls settings` -> `Maneuvers` with the `Start turning by drag` switch and `Starts by drag` / `Starts by tap` status text.
- The direct tutorial turn prompt now describes the default mobile press/drag/release model and the desktop click-confirm model.
- Pending turn planning now uses a vivid cyan in-world presentation, including an animated dashed target line, stronger turn-slice fill, and a target-point reticle so it reads action-required while staying in the main flight-system color family.
- Accepted/committed turn target lines are shorter than the planning preview and no longer keep the old full-distance target dot after confirmation, so active turning reads calmer.

## Why

Desktop still benefits from persistent planning because it separates preview adjustment from confirmation. Mobile keeps the old drag/release model as the default while the tap-confirm model remains available for testing through settings.

## Key Files

- `src/input/pointerCameraInput.ts`: owns desktop canvas pointer mapping for plan, preview, confirm, cancel, camera pan, and wheel zoom.
- `src/ui/touchControls/createTouchControls.ts`: owns mobile touch gesture routing across planning, camera pan, pinch zoom, and touch-control panels.
- `src/userSettingsStorage.ts`, `src/app/createAppComponents.ts`, `src/ui/createUiSettingsDialog.ts`, and `src/ui/components/UiSettingsDialogSurface.tsx`: own the persisted mobile maneuver trigger setting and settings dialog switch.
- `src/runtime/runtimeActions.ts`: remains the owner of storing, committing, and clearing target-heading plans.
- `src/runtime/frameLoop.ts`, `src/presentation/spacecraftPresentation.ts`, and `src/style.css`: own the pending-versus-committed turn target visual state and styling.
- `src/ui/components/InGameControlsMenuSurface.tsx` and `src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts`: own the updated player-facing gesture copy.
- `tests/input/pointerCameraInput.test.ts`, `tests/presentation/spacecraftPresentation.test.ts`, and `tests/gui/turnPlanningInput.spec.ts`: cover the new desktop and mobile gesture contracts plus the pending planning visual state.

## Decisions

- Kept the existing runtime target-heading plan model and changed only the input adapters.
- Mobile default mode matches the previous hold/drag/release lifecycle. Mobile tap-confirm mode preserves idle camera pan: a tap is recognized on release to enter planning; once planning is active, a clean tap confirms and a drag adjusts the preview.
- Two-finger touch cancels only while a turn plan is active. Outside planning, the existing pinch zoom path remains unchanged.
- The pending planning treatment reuses the existing heading target overlay instead of adding another DOM/WebGL marker. The state is a presentation class driven by `runtime.ui.targetHeadingPlan`.
- Committed turn lines reuse the existing heading-slice outer radius as their maximum screen length instead of adding a separate tuning constant, and the target dot remains planning-only.
- Broader tutorial wording polish remains with follow-up issue #201; this change only removes wrong hold/release instructions from active UI.

## Validation

- `npx biome check --write src/input/pointerCameraInput.ts src/ui/touchControls/createTouchControls.ts src/ui/components/InGameControlsMenuSurface.tsx src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts tests/input/pointerCameraInput.test.ts tests/gui/turnPlanningInput.spec.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/gui/mobileHudScreenshot.spec.ts tests/runtime/runtimeActions.test.ts`
- `npx vitest run --config vite.config.ts tests/input/pointerCameraInput.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts tests/runtime/runtimeActions.test.ts`: 53 tests passed.
- `npm test`: 502 Vitest tests and 16 automation-claim tests passed.
- `npm run build`: config validation, TypeScript, and Vite release build passed. Vite reported the existing large chunk warning.
- `npm run test:gui`: 39 mobile Chromium tests passed.
- PR #205 visual follow-up validation:
  - `npx biome check src/presentation/spacecraftPresentation.ts src/runtime/frameLoop.ts src/style.css tests/presentation/spacecraftPresentation.test.ts tests/gui/turnPlanningInput.spec.ts`: passed with existing `src/style.css` `!important` warnings outside this change.
  - `npx vitest run --config vite.config.ts tests/presentation/spacecraftPresentation.test.ts`: 4 tests passed.
  - `npm run build`: passed. Vite reported the existing large chunk warning.
  - `npx playwright test --config playwright.config.ts tests/gui/turnPlanningInput.spec.ts`: 2 tests passed.
  - `npm run test:gui`: 39 mobile Chromium tests passed.
- Screenshot inspection:
  - Active plan: `tmp/playwright-results/turnPlanningInput-mobile-t-6211d--and-confirms-on-second-tap-mobile-chromium/mobile-turn-plan-active.png`
  - Canceled plan: `tmp/playwright-results/turnPlanningInput-mobile-t-200ab-planning-without-committing-mobile-chromium/mobile-turn-plan-canceled.png`
  - PR #205 visual follow-up active plan: `tmp/playwright-results/turnPlanningInput-mobile-t-6211d--and-confirms-on-second-tap-mobile-chromium/mobile-turn-plan-active.png` showed the amber pending planning line, target reticle, and turn slice distinct from cyan committed-turn cues.
- PR #205 owner tuning follow-up validation:
  - `npx biome check --write src/presentation/spacecraftPresentation.ts src/style.css tests/presentation/spacecraftPresentation.test.ts tests/gui/turnPlanningInput.spec.ts docs/tech-notes/2026-07-08-persistent-turn-planning-input.md`: passed with existing `src/style.css` `!important` warnings outside this change.
  - `npx vitest run --config vite.config.ts tests/presentation/spacecraftPresentation.test.ts`: 4 tests passed.
  - `npm run build`: passed with the existing Vite large chunk warning.
  - `npx playwright test --config playwright.config.ts tests/gui/turnPlanningInput.spec.ts`: 2 tests passed.
  - `npm run test:gui`: 39 mobile Chromium tests passed.
  - `npm test`: 503 Vitest tests and 16 automation-claim tests passed.
  - `git diff --check`: passed.
- PR #205 owner tuning screenshot inspection:
  - Active plan: `tmp/playwright-results/turnPlanningInput-mobile-t-6211d--and-confirms-on-second-tap-mobile-chromium/mobile-turn-plan-active.png` showed the vivid cyan planning line, target reticle, and turn slice.
  - Accepted turn: `tmp/playwright-results/turnPlanningInput-mobile-t-6211d--and-confirms-on-second-tap-mobile-chromium/mobile-turn-committed.png` showed the calmer shortened accepted-turn cue.
- PR #205 mobile maneuver setting follow-up validation:
  - `npx biome check --write src/userSettingsStorage.ts src/app/createAppComponents.ts src/ui/createUiSettingsDialog.ts src/ui/components/UiSettingsDialogSurface.tsx src/ui/touchControls/createTouchControls.ts src/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow.ts tests/userSettingsStorage.test.ts tests/app/createAppConfigContext.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/gui/mobileHudScreenshot.spec.ts tests/gui/turnPlanningInput.spec.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts docs/tech-notes/2026-07-08-persistent-turn-planning-input.md`: passed.
  - `npx vitest run --config vite.config.ts tests/userSettingsStorage.test.ts tests/app/createAppConfigContext.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`: 40 tests passed.
  - `npx playwright test --config playwright.config.ts tests/gui/turnPlanningInput.spec.ts`: 3 tests passed.
  - `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "UI settings dialog"`: 2 tests passed.
  - `npm run test:gui`: 40 mobile Chromium tests passed.
  - `npm run build`: passed with the existing Vite large chunk warning.
  - `npm test`: 503 Vitest tests and 16 automation-claim tests passed.
  - `git diff --check`: passed.
- PR #205 mobile maneuver setting screenshot inspection:
  - Settings dialog: `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-spacecraft-controls-settings-dialog.png` showed the new `Maneuvers` subsection, default-on switch, and `Starts by drag` status fitting cleanly on mobile.
  - Default drag/release commit: `tmp/playwright-results/turnPlanningInput-mobile-d-991d6-r-starts-turning-on-release-mobile-chromium/mobile-turn-drag-committed.png` showed the shortened committed cue with no old full-distance target dot.
- `coderabbit --base main --agent` was attempted during the original review and retried for the PR #205 owner tuning and mobile maneuver setting follow-ups, but produced no findings or completion after connecting/setup or summarizing for several minutes; the runs were interrupted and recorded as review-tool timeouts.

## Follow-Ups

- Issue #201 owns the broader tutorial-copy pass after this control model is reviewed.

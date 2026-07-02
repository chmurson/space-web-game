# Scenario Orbit Point Display Overrides

Issue: https://github.com/chmurson/space-web-game/issues/140
Branch: `codex/issue-140-scenario-orbit-point-display`
Shipit state: `.codex/shipit-workflows/codex-issue-140-scenario-orbit-point-display.md`

## What Changed

- Added optional scenario-level orbit point display overrides.
- The main menu/background scenario now forces closest/farthest orbit point markers off with `markersVisible: false`.
- Trajectory presentation now receives effective orbit point display settings resolved from user preferences plus any active scenario override.
- Scenario load transitions now replace the active override, so scenarios without overrides return to user-controlled orbit point display behavior.

## Why

Player UI settings are the normal source of truth for Pe/Ap marker visibility and label contents, but some scenarios own their presentation. The main menu background should stay visually quiet regardless of the player's in-game marker preference.

## Key Files

- `src/userSettingsStorage.ts` owns the shared orbit point display settings type and the user-plus-scenario resolution helper.
- `src/debugScenarioSnapshot.ts` defines the optional runtime scenario override field.
- `src/runtime/createScenarioRuntimeController.ts`, `src/app/createInitialAppRuntimeState.ts`, and `src/runtime/runtimeStateTransitions.ts` carry active scenario overrides into runtime state.
- `src/app/createAppComponents.ts` resolves effective settings for trajectory presentation while keeping the settings dialog bound to user preferences.
- `src/scenario/specific-scenarios/menuBackgroundScenario.ts` opts the main menu/background scenario into hiding markers.

## Decisions

- Scenario settings are hard overrides while the scenario is active.
- Overrides are partial: fields omitted by the scenario fall back to the user's saved settings.
- No disabled settings UI was added in this pass. User preferences can still be changed, but scenario-overridden fields stay forced in presentation until the active scenario changes.
- Kept this as presentation state, not trajectory prediction state; marker generation still runs the same way.

## Validation

- `npx vitest run --config vite.config.ts tests/userSettingsStorage.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/runtime/runtimeStateTransitions.test.ts tests/presentation/trajectoryPresentation.test.ts` passed: 4 files, 31 tests.
- `npm test` passed: 57 Vitest files with 386 tests, plus 16 automation-claim node tests.
- `npm run build` passed, with the existing Vite chunk-size warning.
- `npm run test:gui` passed: 25 Playwright tests.
- `coderabbit --base main --agent` emitted one finding in `src/presentation/trajectoryPresentation.ts`, then kept heartbeating without completing and was stopped. The finding was skipped as out of scope for this issue because the local `main` branch is behind `origin/main`, causing prior merged marker-stabilization changes to appear in the review range.
- Visually inspected `tmp/playwright-results/mobileHudScreenshot-captur-92051-th-world-visuals-suppressed-mobile-chromium/mobile-main-menu.png`; the generated GUI main-menu screenshot keeps the expected HUD/menu layout, though that test intentionally hides world visuals.
- Manually checked `http://127.0.0.1:5178/?reachmoon=1` with user orbit markers and labels set on; both `.trajectory-event-label` elements resolved to `display: none` while the main-menu scenario was active.
- Visually inspected `tmp/manual-main-menu-scenario-orbit-override.png`; the main-menu background showed no Pe/Ap labels.

## Follow-Ups

- If a playable scenario later uses these overrides while exposing UI settings, add disabled or explanatory controls for forced fields.

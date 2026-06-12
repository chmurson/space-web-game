# Shipit State

Task: UI settings dialog
Branch: ui-settings-dialog
Current Mode: review
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [ ] PR opened/updated (not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Keep npm as the project package manager; do not reintroduce pnpm artifacts.
- Non-main branch deploys go to shared Netlify staging with `npm run deploy:netlify` before handoff when user-visible app code changes.
- Move the three touch-control side selectors out of the top menu into a separate UI settings dialog.
- Replace those three top-menu controls with one action that opens the dialog and closes the top-menu dropdown.
- Dialog should include a close button, dim the background, match existing in-game UI styling, and use a slightly transparent panel.

## Open Questions

- None currently. Use conservative existing UI wording and patterns.

## Validation

- [x] npm test
- [x] npm run build
- [x] npm run deploy:netlify

## Next Step

Await user review, commit/PR request, or follow-up changes.

## Brainstorm Handoff

Problem statement: the current top-menu dropdown contains three touch-control side settings directly in the menu. This makes the top menu heavier than intended.

Goals:

- Keep the top menu focused by replacing the inline control-side settings with a single settings action.
- Provide a dedicated UI settings dialog for Burn, Warp, and Trajectory side selectors.
- Make the dialog feel like part of the existing in-game overlay UI.
- Ensure the dialog can be closed explicitly and that opening it closes the top-menu dropdown.

Non-goals:

- Do not change the stored settings schema.
- Do not redesign all top-menu sections.
- Do not migrate package managers.

User-facing behavior:

- Player opens the top menu, chooses UI/control settings, and sees a modal dialog.
- Dialog backdrop dims the running game underneath.
- Dialog has a transparent in-game panel treatment and a close button.
- Existing left/right choices continue to update the same saved user settings.

Edge cases and failure states:

- Dialog should not remain open behind the main menu.
- Keyboard and pointer interactions should not leak through the modal in surprising ways.
- The dialog should work on both mobile and desktop viewport sizes.

## Design Handoff

Implementation scope:

- Remove the inline Burn/Warp/Trajectory side controls from `src/ui/createTopMenu.ts`.
- Add one top-menu action, labeled conservatively as UI settings, that closes the dropdown and opens a separate dialog.
- Create a dedicated dialog module that owns the settings panel markup, close behavior, and segmented controls.
- Keep touch-control state ownership in `src/app/createAppComponents.ts`; the dialog receives getters and setters just like the top menu currently does.
- Add CSS to `src/style.css` for a dimmed backdrop, transparent in-game panel, responsive layout, focus states, and mobile spacing.

Target files/modules:

- `src/ui/createTopMenu.ts`
- `src/ui/createDialog.ts`
- `src/ui/createUiSettingsDialog.ts`
- `src/app/createAppComponents.ts`
- `src/style.css`
- `.codex/shipit-workflows/ui-settings-dialog.md`

UI/data flow:

- Top-menu click on UI settings calls `onOpenUiSettings`.
- `createTopMenu` closes the dropdown after that action.
- `createUiSettingsDialog` renders three shared `createSegmentedControl` instances with normal button semantics.
- Dialog setters update local app component state, touch controls, and persisted user settings.
- Dialog sync reads the same current side values so external changes remain reflected.
- App mode initialization closes both the top menu and dialog when returning to the main menu.

Risks:

- Focus/escape behavior could conflict with the top-menu document keydown listener if both are open, so opening the dialog must close the menu first.
- Pointer events must be contained so clicking inside the dialog does not close unrelated UI unexpectedly.
- Existing segmented control CSS is currently partly scoped to top-menu buttons; dialog styles need explicit focus/hover coverage.

Test strategy:

- Run `npm test` for existing behavior.
- Run `npm run build` for TypeScript and production bundle validation.
- Use a local browser smoke test to confirm the top-menu item opens the dialog, close behavior works, and the panel is visible at desktop/mobile sizes.
- Deploy to staging with `npm run deploy:netlify` before handoff because this changes user-visible runtime UI.

Cleanup expectations:

- Remove unused top-menu touch-control props and imports.
- Keep CSS selectors named around UI settings rather than generic modal infrastructure unless reuse emerges later.
- Avoid broad top-menu redesign.

Completion criteria:

- Top menu no longer contains the three inline side selectors.
- A single top-menu action opens a settings dialog and closes the dropdown.
- The dialog has a close button, backdrop dimming, transparent panel styling, and the three working side selectors.
- Validation passes and staging URL is reported.

## Task Slices

- [x] Simplify `createTopMenu` and expose an `onOpenUiSettings` callback.
- [x] Add `createUiSettingsDialog` using shared segmented controls.
- [x] Wire dialog into `createAppComponents`, including close-on-main-menu behavior.
- [x] Add responsive dialog/backdrop styling.
- [x] Run cleanup, self-review, tests, build, browser smoke test, and staging deploy.

## Implementation Handoff

Changed files:

- `src/ui/createTopMenu.ts`
- `src/ui/createUiSettingsDialog.ts`
- `src/app/createAppComponents.ts`
- `src/style.css`
- `.codex/shipit-workflows/ui-settings-dialog.md`

Completed task slices:

- Simplified the top-menu Controls section to a single `UI settings` menu item.
- Added `createUiSettingsDialog` with three shared segmented controls for Burn, Warp, and Trajectory side settings.
- Refactored the dialog shell into reusable `createDialog`, `createDialogButton`, and `createDialogSettingRow` helpers after user review.
- Wired dialog state through `createAppComponents` so touch controls and persisted user settings still update through the existing setters.
- Added close-on-main-menu behavior.
- Added translucent modal/backdrop styling with mobile adjustments.

Behavior implemented:

- Opening `UI settings` from the top menu closes the dropdown and opens the dialog.
- The dialog can close via the Close button, backdrop click, or Escape.
- The dialog traps Tab focus while open.
- Side changes sync UI, active touch controls, and stored settings.
- Future dialogs can reuse the same backdrop, panel, title/header, close button, active-dialog tracking, focus containment, and setting-row styles.

Deviations from design:

- None.

Blockers:

- None.

Known gaps resolved during review:

- Browser smoke testing and final validation passed.

## Cleanup Notes

Cleanup performed:

- Removed stale `.menu-setting` and `.menu-setting-name` CSS left behind after moving the inline top-menu settings into the dialog.
- Added a dedicated dialog z-index token above the existing modal-menu layer.
- Formatted only the touched source files with Biome.

Cleanup intentionally skipped:

- No larger modal framework was added because there is still only one dialog use case.
- No broad top-menu redesign was attempted.

Stale artifacts/docs:

- No user-facing docs needed for this in-game UI change.

## Review Notes

Supplied findings:

- None.

Self-review findings:

- Fixed focus restoration when opening the dialog from the top menu. The top menu now focuses its visible menu button before opening the dialog, so closing the dialog does not attempt to restore focus to a hidden dropdown item.
- Pre-merge Shipit review found no additional code issues. `git diff --check` passed.

Self-review outcome:

- Requirements covered: top-menu inline side selectors removed, single `UI settings` item added, dropdown closes before dialog opens, dialog includes close button, backdrop dimming, transparent panel styling, and the same three side selectors.
- State flow remains scoped to `createAppComponents`, preserving existing touch-control and user-settings persistence behavior.
- The dialog shell is reusable, but settings-specific state and side-control composition stay local to `createUiSettingsDialog`.

Solution retrospect:

- The shared dialog primitive is the right boundary for this change. It keeps top-menu complexity down, makes future dialogs cheaper, and avoids moving application state ownership into generic UI markup.
- Test coverage is acceptable with existing unit tests plus build and browser smoke coverage; adding DOM unit tests would require a test-environment expansion not justified by this narrow change.
- No user-facing docs are needed because this is discoverable in the existing game menu.

Validation results:

- `npm test`: passed, 29 test files and 123 tests.
- `npm run build`: passed, including config validation and TypeScript. Vite emitted the existing non-failing chunk-size warning.
- Browser smoke test at `http://127.0.0.1:5173/`: passed after the reusable-dialog refactor. Verified the top menu opens `UI settings`, Burn side can be changed, and Close removes the dialog.
- Earlier browser smoke test also passed on desktop and 390x844 mobile viewport, including mobile panel bounds and backdrop dimming.
- `npm run deploy:netlify`: passed for shared staging site after the reusable-dialog refactor.

Staging deploy:

- Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a2c00169caa9e2dc31bcff8--fanciful-bunny-d77b4b.netlify.app

Residual risk:

- The app still has the existing Vite chunk-size warning, unrelated to this change.

Proposed follow-up issues:

- None.

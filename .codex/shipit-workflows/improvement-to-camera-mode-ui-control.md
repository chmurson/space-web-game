# Shipit State

Task: Improvement to camera mode UI control
Branch: improvement-to-camera-mode-ui-control
Current Mode: yeet
Status: active

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Use git-safe branch slug `improvement-to-camera-mode-ui-control` for the requested branch title "improvement to camera mode ui control".
- Follow AGENTS.md deployment rules: this is a non-`main` branch, so executable/user-visible changes should be deployed to the configured staging target before handoff.
- Follow AGENTS.md UI guidance for HUD/menu/overlay styling by preferring shared UI surface tokens in `src/style.css`.
- Likely relevant skills for later phases: `game-studio:game-ui-frontend` for the camera mode UI control and `game-studio:game-playtest` after UI/input changes.
- Replace the in-game controls menu camera segmented control with a prediction-horizon-style two-line row and a right-side on/off switch.
- Treat switch on as camera locked on spacecraft (`centered`) and switch off as free roam (`unlocked`).
- Continue in this workflow for the related UI settings popup polish: add the missing Target side control and remove the temporary Trajectory section label.
- Hidden trajectory controls should not participate in edge reveal stack layout; adjacent controls should collapse into the freed slot.
- Default UI settings should be Burn right, Warp right, Target left, and Trajectory hidden.

## Open Questions

- None for the initial implementation.

## Validation

- [x] npm run build
- [x] npm run test -- tests/userSettingsStorage.test.ts tests/app/createAppConfigContext.test.ts
- [x] Browser playtest screenshot check for controls menu and UI settings popup on mobile
- [x] npm run deploy:netlify

## Next Step

Merge branch into `main`, deploy production, and report final state.

## Brainstorm Handoff

Problem statement: The in-game controls menu camera mode control uses a large segmented Centered/Free roam layout that does not match the compact two-line Prediction horizon row.

Goals: Match the Prediction horizon item layout: primary text in the first row, secondary text below, and interactive control on the right. Use primary text "Camera locked", secondary text "On spacecraft" or similar, and a typical on/off toggle.

Non-goals: Do not redesign the full controls menu, change camera mechanics, or alter tutorial camera-lock behavior.

Accepted decisions: branch and Shipit workflow state are initialized; use the in-game controls menu surface; implement as a switch where on means centered/locked and off means unlocked/free roam.

Unresolved questions: none for initial implementation.

User-facing behavior: The controls menu shows a Camera locked row with "On spacecraft" when centered and "Free roam" when unlocked. A switch on the right toggles between these states and becomes disabled when the current scenario locks camera mode changes.

Edge cases and failure states: Scenario camera lock must disable the switch and preserve the locked state. Text must fit in the compact popover on desktop and mobile.

## Design Handoff

Implementation scope: Update `src/ui/createInGameControlsMenu.ts` and `src/ui/overlayUI/overlayUIStyles.css` only unless validation reveals test needs.

UI flow: Reuse the existing popover and prediction-horizon row structure. The camera row should use `menu-stepper`-style copy and right-side control alignment but with a button using `role="switch"` instead of +/- buttons.

State flow: Map `centered` to checked/on/locked on spacecraft. Map `unlocked` to unchecked/off/free roam. On click, dispatch `setCameraUnlocked` when currently centered, otherwise `setCameraCentered`.

Risks: Camera mode lock must still prevent changes. Button accessible name and `aria-checked` must stay synchronized. Popover width must not be forced wider by the switch.

Validation commands: `npm run build`; browser screenshot checks for desktop and mobile menu layout.

Cleanup expectations: Remove now-unused segmented camera control import and CSS selectors. Keep styling local to in-game controls and reuse existing row/panel colors.

Completion criteria: Camera row visually matches the Prediction horizon item layout, switch toggles correctly, disabled scenario state is visible and inaccessible, and build/browser checks pass.

## Task Slices

- [x] Replace camera segmented control markup with a row-style switch control.
- [x] Synchronize switch state, label text, disabled state, and ARIA attributes.
- [x] Update overlay CSS for the camera switch and remove unused segmented-control menu styles.
- [x] Run build and browser visual checks.
- [x] Add a Target side row to the UI settings popup.
- [x] Remove the temporary Trajectory section label from the UI settings popup.
- [x] Add Hidden as a third state for the trajectory touch control.
- [x] Remove hidden trajectory reveal controls from edge stack layout.
- [x] Set default UI settings to Burn right, Warp right, Target left, and Trajectory hidden.
- [x] Re-run build, browser visual checks, review, and deploy.

## Implementation Handoff

Changed files:

- `src/ui/createInGameControlsMenu.ts`
- `src/ui/createUiSettingsDialog.ts`
- `src/style.css`
- `src/ui/overlayUI/overlayUIStyles.css`
- `src/userSettingsStorage.ts`
- `src/app/createAppConfigContext.ts`
- `src/app/createAppComponents.ts`
- `src/ui/touchControls/createTouchControls.ts`
- `tests/userSettingsStorage.test.ts`
- `tests/app/createAppConfigContext.test.ts`
- `tests/app/createInitialAppRuntimeState.test.ts`
- `.codex/shipit-workflows/improvement-to-camera-mode-ui-control.md`

Completed task slices: all task slices completed.

Behavior implemented: The camera control in the in-game controls popover now uses a compact two-line row matching Prediction horizon. It shows primary text "Camera locked", secondary text "On spacecraft" when centered and "Free roam" when unlocked, and a right-side switch using `role="switch"`. The UI settings popup now includes `Target side` alongside Burn, Warp, and Trajectory side, and the temporary Trajectory section label was removed. Target side is persisted in user settings and moves the target reveal control between left and right. Trajectory side now has a third `Hidden` state that hides only the trajectory touch reveal control while keeping the Prediction horizon row available in the in-game controls menu. Hidden reveal controls are excluded from edge-stack layout so neighboring controls fill the freed slot. Default UI settings are Burn right, Warp right, Target left, and Trajectory hidden.

Deviations from design: none.

Blockers: none.

Known gaps: none.

## Cleanup Notes

Cleanup performed: Removed the unused segmented camera control import and removed the in-game-controls-menu segmented-control CSS overrides that no longer apply. Kept the camera switch styling local to the menu and used shared glass-control tokens for the neutral switch state. Removed the now-unused hard-coded target reveal edge after Target side became configurable.

Cleanup intentionally skipped: No shared switch abstraction was added because this menu has one local switch and the existing reusable control is a segmented selector, not a switch.

Stale artifacts/docs: Shipit state updated inline; no other docs needed.

## Review Notes

Supplied findings: none.

CodeRabbit findings: Three valid findings across earlier review runs. First, the workflow validation list needed to include the AGENTS.md-required staging deploy before handoff. Fixed by adding `npm run deploy:netlify` to validation. Second, the switch neutral border/background should use shared glass-control tokens. Fixed in `src/ui/overlayUI/overlayUIStyles.css`. Third, the workflow state had pending Hidden-state validation items after implementation; fixed by updating this state file after validation and deploy. The Target-side run completed with zero findings. The edge-stack fix run completed with zero findings. The default-settings run completed with zero findings. A final merge-preflight CodeRabbit rerun on the same code hit the external CodeRabbit rate limit; no code changes were made after the previous zero-finding CodeRabbit run.

Self-review findings: No correctness issues found in the changed diff. The switch dispatches the same existing camera mode actions as before and respects `cameraModeChangesLocked` by disabling the button.

Ponytail review: Removed one redundant `.in-game-controls-menu-camera` width selector and the now-unused hard-coded target reveal edge. No other over-engineering findings.

Solution retrospect: A generic switch component is not justified for a single menu-local control. The implementation stays simpler by using a local button with ARIA switch semantics and local CSS.

Requirement coverage: Matches the Prediction horizon row structure, uses primary/secondary text, places the interactive element on the right, and uses a typical on/off toggle. UI settings now has a Target side control, no added Trajectory section label, and a Hidden state for the trajectory touch control. Hidden trajectory touch controls no longer leave a blank edge-stack slot. Default UI settings now match the requested Burn/Warp/Target/Trajectory defaults.

Residual risk: The dev browser logged one generic 404 resource error, likely unrelated to this change; the app and controls menu rendered and interacted correctly.

Validation results:

- `npm run build` passed.
- Desktop browser check passed: row layout, labels, and toggle interaction verified.
- Focused settings/config tests passed.
- Mobile browser check passed: controls menu row layout, text fit, switch spacing, UI settings Target side row, no added Trajectory section label, and Target side placement update verified at 390x844.
- Mobile browser check passed: `touchTrajectorySide=hidden` hides the trajectory touch reveal tab, the UI settings Trajectory row shows Left/Right/Hidden, selecting Left restores the reveal tab, and the controls menu still shows Prediction horizon.
- Mobile browser check passed: with `touchTrajectorySide=hidden`, the hidden trajectory reveal no longer consumes an edge-stack offset; remaining controls use contiguous offsets.
- Mobile browser check passed after clearing local storage: defaults are Burn right, Warp right, Target left, Trajectory hidden, and Prediction horizon still appears in the controls menu.
- Final CodeRabbit run produced one valid workflow-state finding, fixed in this file.
- Final edge-stack CodeRabbit run completed with zero findings.
- Final default-settings CodeRabbit run completed with zero findings.
- Merge-preflight `coderabbit --base main --agent` hit CodeRabbit rate limit after the last zero-finding CodeRabbit run and no subsequent code changes.
- `npm run deploy:netlify` passed. Staging URL: https://fanciful-bunny-d77b4b.netlify.app. Unique deploy URL: https://6a3192cb98bb75509ff55779--fanciful-bunny-d77b4b.netlify.app.

## Yeet Notes

- Feature commit: `acf40ee` (`feat(ui): refine controls settings`)
- PR: not used; user requested direct review and merge.

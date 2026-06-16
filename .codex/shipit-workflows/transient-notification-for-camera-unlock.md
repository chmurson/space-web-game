# Shipit State

Task: Transient notification for camera unlock
Branch: transient-notification-for-camera-unlock
Current Mode: yeet
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
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Start the task branch from `origin/main` in this worktree.
- Pause after design until the user explicitly approves implementation.
- The notification should appear only when the mobile swipe gesture actually changes the camera mode from centered to unlocked.
- The notification should live near the current scenario coach prompt location, visually related to the coach prompt but clearly transient and non-persistent.
- The notification should not behave like the scenario replay pill and should not require user dismissal.
- The notification should auto-dismiss only; do not add a close button, tap-to-dismiss, or swipe-to-dismiss interaction.
- Reuse existing HUD/prompt glass styling tokens where practical.
- Treat HUD notices as two notice variants for now: durable notices and transient notices. Keep coach prompts separate from this notice taxonomy.
- Durable and transient notices should share the bottom-center notice rail shown by the durable scenario replay/info pill.
- In the shared notice rail, transient notices should stack above durable notices; durable notices stay at the bottom of the list.
- Transient notices should use the same text style as durable notices.
- Durable and transient notices should use a subtle theme-color glow instead of a mostly invisible dark drop shadow.

## Open Questions

- None for initial implementation. Copy and duration can be adjusted during review if the first pass feels too heavy or too subtle.

## Validation

- [x] `npm run build`
- [x] `npm test`
- [x] Browser playtest at desktop and mobile viewport, with mobile/touch emulation focused on camera unlock notification placement.
- [x] `npm run deploy:netlify` before handoff if implementation changes shipped app behavior.

## Brainstorm Handoff

Problem statement: On mobile, users can unlock the camera through a long swipe gesture while in centered camera mode, but the successful transition needs a lightweight confirmation.

Goal: Show a transient HUD notice when the swipe gesture unlocks camera control. It should share the broader HUD notice visual language with durable notices, while coach prompts stay separate because they carry instructional scenario behavior.

Non-goals:

- Do not change desktop pointer camera unlock behavior unless implementation later finds a strong reason.
- Do not redesign the scenario coach prompt system.
- Do not add a persistent camera status panel.
- Do not add new scenario/session state for this one-off UI confirmation.

Expected user-facing behavior:

- While on a touch device in centered camera mode, a deliberate long swipe crosses the existing unlock threshold.
- If camera mode changes to unlocked, a compact notification appears near the top-center coach prompt area.
- The notification automatically disappears after a short duration.
- Repeated camera pan movement after unlock does not keep retriggering the notification.
- If camera mode changes are locked, no notification appears because the unlock does not occur.

Edge cases:

- Existing scenario coach prompts may be visible. The transient notice should not be folded into the coach prompt system, and it should avoid obscuring important prompt text more than briefly.
- Reduced-motion users should not get essential information only through animation.
- The notification should not intercept gameplay touches.

## Design Handoff

Implementation scope:

- Add a small transient HUD notice UI element to the overlay layer.
- Add a tiny presenter/helper to show, refresh, and hide the notification.
- Trigger it from the existing touch camera unlock branch after `onCameraModeSelected('unlocked')` returns true.
- Style it as a HUD notice alongside durable notice styling. Coach prompts may remain visual inspiration for placement density, but should not become part of the notice abstraction.

Likely target files:

- `src/ui/overlayUI/createOverlayUi.ts`: create and expose a `cameraUnlockNotification` element, or create a similar overlay-owned DOM element.
- `src/ui/overlayUI/overlayUIStyles.css`: add shared durable/transient HUD notice styling near overlay-owned HUD surfaces.
- `src/app/createAppComponents.ts`: wire the notification presenter into `createTouchControls`.
- `src/ui/touchControls/createTouchControls.ts`: add an optional callback such as `onCameraUnlockedBySwipe?: () => void`, called only in the existing successful unlock branch.
- Optional new file under `src/ui/` if the show/hide logic is clearer as a small presenter rather than inline app code.

UI design:

- Suggested copy: title `Camera unlocked`, body `Drag anywhere to pan.`
- Position: bottom-center in the same notice rail as durable HUD notices, with safe-area padding on small screens.
- Visual relationship: same dark translucent glass, blue/cyan edge language, compact radius, and blur as durable HUD notices.
- Transient distinction: smaller width, no arrow, no close button, no action row, slightly softer/accented border, and enter/exit opacity/translate transition.
- Interaction: `pointer-events: none`, `aria-live="polite"`, `role="status"`, no focus changes, no manual dismissal control.
- Timing: show for roughly 2400 ms. Re-showing should reset the timer.
- Motion: fade/slide is acceptable; respect `prefers-reduced-motion` by disabling transform-heavy transition.

Data/API flow:

- Touch gesture code detects threshold while centered and unlocked changes are allowed.
- `options.onCameraModeSelected('unlocked')` remains the source of truth for whether unlock succeeded.
- On success, call the optional notification callback before/after the initial pan handoff.
- Presenter sets visible state via data attribute/class and clears a timeout on repeat calls.

Risks:

- If the notification shares the exact coach prompt position, it may overlap an active tutorial coach prompt. The first pass should use the same neighborhood but can offset slightly lower or use a higher/lower stacking rule after screenshot review.
- A callback added to touch controls should remain optional and narrow to avoid forcing non-mobile callers to know about this UI.
- Timer cleanup should avoid stale callbacks after app teardown if this app later adds teardown behavior; current surrounding code appears long-lived.

Test strategy:

- Add a focused unit test only if there is an existing test seam for touch gesture behavior or presenter timing; do not widen module APIs solely for tests.
- Otherwise rely on `npm run build` and browser playtest with mobile touch emulation, checking the successful unlock path, locked/no-notification path if practical, and notification disappearance.

Cleanup expectations:

- Keep the notification implementation small; avoid introducing a general toast framework unless existing patterns make that cheaper.
- Keep local colors minimal and reuse shared UI surface variables.
- Remove stale timers/listeners only if the implementation creates them.

Completion criteria:

- A mobile swipe unlock displays one transient HUD notice in the shared bottom-center notice rail.
- Notification does not block touch input and disappears automatically.
- Build passes and browser screenshots confirm placement on mobile and no obvious desktop regression.
- Staging deploy is completed before handoff after implementation.

## Task Slices

1. Add overlay DOM/ref and transient notification presenter.
2. Add styling for the camera unlock notification using transient HUD notice visual language.
3. Wire the touch unlock success path to the presenter through a narrow optional callback.
4. Validate with build and browser playtest, then deploy staging after code changes.

## Implementation Handoff

Changed files:

- `src/ui/overlayUI/createOverlayUi.ts`: added overlay-owned transient camera unlock notice refs and marked the existing scenario replay pill as a durable HUD notice.
- `src/ui/overlayUI/overlayUIStyles.css`: added shared `hud-notice`, `hud-notice-durable`, and `hud-notice-transient` styling, including reduced-motion handling.
- `src/ui/touchControls/createTouchControls.ts`: added optional `onCameraUnlockedBySwipe` callback and calls it only after `onCameraModeSelected('unlocked')` succeeds.
- `src/app/createAppComponents.ts`: added a small camera unlock notice presenter with 2400 ms auto-dismiss and wired it into touch controls.

Completed task slices:

1. Added overlay DOM/ref and transient notification presenter.
2. Added styling for durable/transient HUD notice variants.
3. Wired the touch unlock success path to the presenter through a narrow optional callback.
4. Ran build and browser checks; staging deploy remains pending as a required pre-handoff step for this non-main branch.

Behavior implemented:

- A deliberate mobile swipe unlock changes camera mode from centered to unlocked and shows `Camera unlocked` / `Drag anywhere to pan.`
- The notice is shown as a compact bottom-center notice rail pill, is `pointer-events: none`, uses `role="status"` / `aria-live="polite"`, and auto-dismisses after 2400 ms.
- Durable notice styling is now represented by an added class on the existing scenario replay pill, while coach prompts remain separate.

Deviations from design:

- None.

Blockers:

- The in-app Browser and Chrome DevTools MCP surfaces were unavailable/blocked, so browser playtest used a temporary headless Chrome instance over Chrome DevTools Protocol.

Known gaps:

- No unit test was added because the existing gesture path has no narrow test seam and the change was validated through build plus browser interaction.

## Cleanup Notes

Cleanup performed:

- Removed the temporary browser screenshot artifact after visual inspection.
- Kept the implementation intentionally narrow: no notification queue, no notification center, and no coach prompt refactor.
- Reused overlay-owned CSS and DOM patterns rather than introducing a broader UI service.

Cleanup intentionally skipped:

- No helper extraction beyond the small local presenter; there is only one transient notice use case.
- No test-only API widening for the touch gesture path.

Stale artifacts/docs:

- Shipit state updated with implementation and validation details.

## Review Notes

CodeRabbit:

- Final run: `coderabbit --base main --agent`.
- Findings: 0.
- Earlier workflow-state consistency findings were handled before the final review.

Self-review findings:

- Fixed stale Shipit wording that still described the notice as coach-styled after the durable/transient HUD notice taxonomy decision.
- Fixed pre-existing scenario-prompt-pill visual ownership drift by moving the global durable pill selector to `hud-notice-durable` and adding durable notice classes to the older standalone replay pill helper.
- Moved the transient camera unlock notice into the same bottom-center notice rail as durable notices after visual feedback.
- Tightened visible camera unlock copy to `Camera unlocked` so it matches durable notice scale; preserved `Camera unlocked. Drag anywhere to pan.` as the accessible status label.
- Set notice rail ordering so transient notices appear above durable notices.
- Matched transient notice typography to durable notice typography.
- Replaced the shared notice dark shadow with a restrained cyan glow and inset edge highlight.
- Removed broad `src/style.css` formatting churn so the final merge diff keeps only the durable notice selector changes in that file.
- No behavioral bug found in the touch unlock hook. It still fires only after `onCameraModeSelected('unlocked')` succeeds.

Ponytail review lens:

- Kept the solution narrow: no queue, notification center, app-wide toast manager, or coach prompt refactor.
- The optional touch callback is the smallest seam that keeps camera mode logic as the unlock source of truth.

Requirement coverage:

- Camera unlock by mobile swipe shows a transient HUD notice.
- Notice auto-dismisses only, with no close button or dismiss gesture.
- Durable/transient HUD notice taxonomy is represented while coach prompts remain separate.

Validation results:

- `npm run build`: passed.
- `npm test`: passed, 32 test files and 171 tests.
- `git diff --check`: passed.
- Browser playtest: passed using temporary headless Chrome over CDP because in-app Browser and Chrome DevTools MCP were unavailable/blocked. Verified centered-to-unlocked swipe, bottom notice rail placement, notice text, `pointer-events: none`, durable notice class, and auto-dismiss.
- `npm run deploy:netlify`: passed.

Deployment:

- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a316452a1411714e9c0b852--fanciful-bunny-d77b4b.netlify.app
- Deploy logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a316452a1411714e9c0b852

Residual risk:

- No unit test was added for the gesture path because there is no narrow existing seam; browser validation covers the user-visible behavior.
- The app still has an older standalone scenario prompt UI helper, but its replay pill now carries the durable notice class for consistency.

## Next Step

Push branch, open and merge PR, then record PR/merge status.

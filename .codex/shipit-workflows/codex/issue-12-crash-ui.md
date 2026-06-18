# Shipit State

Task: GitHub #12 - Improve crashed-state UI and pause feedback
Branch: codex/issue-12-crash-ui
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

- Picked GitHub issue #12 because #11 is done, #5 is already in progress, and #12 is a standalone crash-state UI bug/enhancement with clear acceptance criteria.
- Issue body was read on 2026-06-18; there are no issue comments.
- Apply the Ponytail lens: keep the first pass in existing DOM/HUD UI code and avoid simulation model changes unless inspection proves they are necessary.
- Follow repository UI guidance: reuse shared glass UI tokens in `src/style.css` for crash modal/result styling.
- Use `game-studio:game-ui-frontend` for UI implementation and `game-studio:game-playtest` after HUD/overlay changes.

## Open Questions

- None for initial implementation. Scope is clear enough from the issue body and acceptance criteria.
- Follow-up accepted: keep the game state visible after crash, hide HUD if needed, allow camera movement after crash, and initially center the crash camera on the spacecraft before unlocking it.
- Follow-up bug report: crash-menu `Restart from checkpoint` click did nothing, while the persistent scenario prompt checkpoint restart worked.
- Second follow-up bug report: crash-menu checkpoint click now appears to move the game/camera, but gameplay remains paused and menus stay visible.
- Third follow-up accepted: initial crash inspection framing should put the spacecraft in the upper part of the screen so the bottom crash menu does not cover it.
- GitHub issue #12 remains open because commit/PR/merge was not requested. Status comments posted: https://github.com/chmurson/space-web-game/issues/12#issuecomment-4744169068, https://github.com/chmurson/space-web-game/issues/12#issuecomment-4744325864, and https://github.com/chmurson/space-web-game/issues/12#issuecomment-4744651263

## Validation

- [x] git diff --check
- [x] npm test
- [x] npm run build
- [x] Browser playtest desktop and mobile crash-state checks
- [x] Browser component check for crash menu focus/actions
- [x] Browser regression check for crash-menu checkpoint click and shortcut callback
- [x] Actual-app regression check for post-checkpoint prompt/crash UI cleanup
- [x] Actual-app crash camera framing check against the visible crash panel
- [x] CodeRabbit review
- [x] npm run deploy:netlify

## Brainstorm Handoff

Problem: the crashed state still reads like normal gameplay with a small `Crashed` pill and a floating bottom action stack. Disabled or secondary controls can compete with the recovery flow, and real-time HUD icon motion can imply the simulation is still active.

Goals: show an obvious crash result surface with crash body name when available, make the primary recovery action obvious, reduce normal HUD/control competition, stop simulation-signaling HUD animation while crashed, and make modal keyboard/screen-reader behavior reasonable.

Non-goals: scoring, new save/load behavior, simulation model changes, or a broad HUD redesign.

Known issue comments: none.

## Design Handoff

Scope:

- `src/ui/createCrashMenu.ts`: convert the bottom crash action stack into a modal/result surface with title, short context, primary/secondary action hierarchy, focus restore/trap behavior, and sync from `crashedBodyName` plus checkpoint availability.
- `src/app/createAppComponents.ts`: include crash state in the existing interaction gate; sync crash body into the crash menu; toggle an app-level crashed class; close competing top/in-game menus while crashed.
- `src/presentation/hudPresentation.ts`: stop advancing the time icon hand while crashed.
- `src/style.css`: style the crash overlay with existing shared glass tokens; dim the scene; hide/de-emphasize normal HUD, top menu, touch controls, and bottom notices while crashed; keep responsive safe-area spacing.

Data/UI flow:

- The frame loop already computes crash visibility from `runtimeState.simulation.crashedBodyName`. Extend that sync to pass the body name to the crash menu and derive the title (`Crashed into <body>` or `Crashed`).
- Crash menu buttons continue dispatching existing high-level actions. No simulation model or save/load behavior changes.
- `getGameInteractionsEnabled()` becomes false while crashed so pointer, keyboard shortcut, and touch gameplay inputs cannot operate under the modal.

Risks:

- Modal focus can conflict with scenario loading transitions if it keeps focus after restart/exit; hide should restore focus only when the previous focus still exists.
- App-level CSS suppression must not leak into main menu mode or hide the crash modal itself.
- Disabled `Load Game` should not appear before primary recovery actions.

Completion criteria:

- Crash surface has a clear title, body name when available, short explanation, obvious primary action, and secondary recovery/exit actions.
- Normal HUD controls no longer visually compete while crashed.
- Time icon no longer rotates while crashed.
- Underlying gameplay controls are gated while crashed.
- Desktop and mobile checks show no overlap with edge controls/safe areas.

## Task Slices

- [x] Upgrade crash menu markup, sync contract, focus handling, and action order.
- [x] Wire crash body/interaction gating/app class from app components.
- [x] Pause time icon hand update while crashed.
- [x] Replace bottom-stack CSS with centered responsive crash modal styling and crashed-state suppression.
- [x] Run validation, browser playtest, review, and staging deploy.
- [x] Follow-up: keep scene visible and allow camera pan/zoom after crash.
- [x] Follow-up: center camera on spacecraft once at crash transition, then unlock it.
- [x] Follow-up: rerun validation and staging deploy.
- [x] Regression fix: wire crash-menu checkpoint restart through the same direct runtime restore path as the working persistent prompt.
- [x] Second regression fix: clear post-restore crashed/prompt UI state so gameplay resumes and crash menus disappear.
- [x] Third follow-up: frame the crash inspection camera so the spacecraft starts in the upper viewport instead of behind the bottom crash menu.

## Implementation Handoff

Changed files:

- `src/ui/createCrashMenu.ts`: replaced the bottom crash button stack with a modal/result surface, crash body title/description sync, primary action ordering, hidden unavailable load/checkpoint actions, focus restore/trap behavior, and `R`/`Escape` keyboard recovery paths.
- `src/app/createAppComponents.ts`: passed `crashedBodyName` into crash menu sync, made the existing gameplay input gate false while crashed, kept camera interaction enabled while crashed, toggled `app-crashed`, centered/unlocked the camera once on crash, and closed top/in-game/settings surfaces while crashed.
- `src/input/pointerCameraInput.ts`: split target-heading selection from camera pan/zoom gating so crashed players can inspect the scene without changing gameplay targeting.
- `src/runtime/highLevelActions/registerHighLevelActions.ts`: updated crash-menu load failure sync for the new crash menu contract.
- `src/runtime/runtimeActions.ts`: added `unlockCameraAtFollowTarget()` for crash inspection camera behavior and framed the follow target above the visible crash panel.
- `src/presentation/hudPresentation.ts`: paused the time icon hand when crashed while preserving the displayed elapsed/time-warp value.
- `src/style.css`: replaced the bottom fixed crash stack with a bottom responsive crash panel, preserved the visible scene, hid HUD/control chrome, and allowed pointer events through the overlay outside the panel.
- `tests/runtime/runtimeActions.test.ts`: added coverage for crash inspection camera unlock behavior, including upper-viewport framing even when normal camera mode changes are locked.
- `docs/tech-notes/2026-06-18-crash-state-ui.md`: recorded the crash-state UI/camera behavior, key ownership boundaries, and validation.

Regression fix:

- `src/app/createAppComponents.ts`: changed the crash-menu checkpoint callback to clear keyboard input, call `runtimeActions.restartFromCheckpoint()` directly, dismiss any active scenario prompt to replay state, close crash UI immediately, remove `app-crashed`, and refresh trajectory prediction on success. This matches the working persistent scenario prompt path and avoids wrapping a same-scenario checkpoint restore in the higher-level scenario transition loader.

Deviations: no simulation model changes; the implementation stays in existing DOM/HUD/runtime/camera wiring.

Known gaps: the automated browser could not deterministically produce a real physics crash in headless mode, so visual crash-state screenshots were checked by pausing the frame loop and forcing the DOM crash state. Crash menu and pointer camera gating were exercised through real exported modules, and crash inspection camera unlock is covered by unit test.

## Cleanup Notes

- Kept the fix scoped to existing files and reused shared glass panel/control styling variables.
- Removed formatter-only CSS churn after an initial formatter pass changed the whole stylesheet indentation.
- Added `display: none !important` only to the crashed-state suppression group because body/offscreen labels can be positioned with inline `display`.
- CodeRabbit pointed out redundant crash-menu action CSS; removed the unused `crash-menu-actions` class/rule instead of adding duplicate button styling.

## Review Notes

- CodeRabbit: initial attempt failed with a recoverable rate-limit error and reported a 17 minute 1 second wait. A later rerun completed with 2 minor findings.
- CodeRabbit finding in `src/style.css`: valid. Removed the redundant `crash-menu-actions` class/rule because the container already uses `main-menu-actions`.
- CodeRabbit finding in `src/render/scenarioAssets.ts`: skipped as out of scope for this crash UI/camera branch; file was not changed and the finding concerns scenario asset cache failure handling.
- CodeRabbit regression rerun after the checkpoint callback fix completed with 0 findings.
- CodeRabbit rerun after the second regression fix completed with 0 findings.
- CodeRabbit rerun after the adaptive crash camera framing follow-up completed with 0 findings.
- Final Shipit review rebased the branch onto `origin/main` at `bb6d44c` and resolved the `src/style.css` conflict by keeping both the upstream mission-entry button styling and the crash-menu hidden/primary-action rules.
- Cleanup during final review removed formatter-only stylesheet churn so the PR diff stays limited to the crash-state UI rules.
- Post-rebase CodeRabbit attempt hit a recoverable rate limit with a 5 minute 48 second wait; the retry completed with 0 findings.
- Self-review: checked crash menu action order, unavailable action hiding, focus behavior, keyboard shortcuts, gameplay/camera input gating split, crash camera unlock, HUD time icon pause, CSS specificity against inline display, visible scene layout, and scope against issue #12 acceptance criteria plus the user follow-up.
- Ponytail review: no new dependencies, no simulation changes, no broad HUD rewrite. The only extra specificity is the crashed-state `!important`, needed to beat existing inline display on labels.
- Regression self-review: the crash menu checkpoint button now uses the same direct runtime checkpoint restore path as the working persistent prompt, clears keyboard input, dismisses active prompt state, hides crash UI, and refreshes trajectory prediction only when the restore succeeds.
- Residual risk: real crash-state visual verification was not fully deterministic in headless Chrome; runtime wiring is covered by TypeScript/build, component behavior and pointer camera gating were browser-checked, crash inspection camera behavior is unit-tested, and final layout was screenshot-checked with a forced crash DOM state.

## Validation Results

- `git diff --check`: passed.
- `npm test`: 37 files passed, 228 tests passed.
- `npm run build`: passed; existing Rollup chunk-size warning remains.
- Browser component check: passed for Earth/no-checkpoint and Moon/checkpoint states, including title text, hidden load/checkpoint behavior, focus target, `Tab` wrap, `R`, and `Escape`.
- Browser regression check after user report: passed in disposable headless Chrome; with checkpoint state visible, clicking `Restart from checkpoint` and pressing `R` both invoked the checkpoint callback, `Escape` invoked exit, and focus stayed on the checkpoint action.
- Actual-app regression check after second user report: passed using a debug snapshot that booted into a checkpointed Earth crash with a replay prompt available. The script opened the replay prompt while crashed, clicked the real crash-menu checkpoint button, and verified `crashedBodyName` was null, `promptUi.activePromptId` was null, `.crash-menu.hidden` was true, `app-crashed` was absent, the scenario prompt display was `none`, and simulation elapsed time advanced from `12.0166` to `12.3749`.
- Browser crash layout checks: passed at 1366x768 desktop and 390x844 mobile; crash panel sits low, viewport center remains canvas, panel receives pointer events, overlay passes pointer events through outside the panel, top menu/touch controls/labels/debug/HUD hidden, canvas filter is none.
- Browser pointer camera gating check: passed; wheel zoom still fires while target-heading selection is disabled.
- Actual-app crash camera framing check: passed using a debug snapshot that booted into an Earth crash. In the short headless viewport, the adaptive crash target resolved to `ndcY=0.8977`, placing the spacecraft at `24px` from the top while the crash panel started at `41.375px`.
- CodeRabbit review: latest rerun completed with 0 findings.
- Netlify deploy: `npm run deploy:netlify` deployed branch `codex/issue-12-crash-ui` to `https://space-web-game-woven-moth.netlify.app`; latest unique deploy `https://6a342eb4f88d11850d2991d7--space-web-game-woven-moth.netlify.app`.
- GitHub issue status: #12 is still open; status comment posted at https://github.com/chmurson/space-web-game/issues/12#issuecomment-4744651263 because commit/PR/merge was not requested.

## Next Step

Stage, commit, push, open PR, merge to `main`, deploy production, close issue #12, and record final GitHub state.

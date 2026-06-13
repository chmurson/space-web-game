# Shipit State

Task: Checkpoint improvement tutorial scenario
Branch: checkpoint-improvement-tutorial-scenario
Current Mode: review
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

- Created branch `checkpoint-improvement-tutorial-scenario` from `improve-tutorial-logic`.
- Existing untracked files `pnpm-lock.yaml` and `pnpm-workspace.yaml` were present before this branch setup and were left untouched.
- Repository deploy guidance applies: non-`main` executable or user-visible changes should deploy to the shared staging site before handoff.
- Initial investigation is limited to where runtime/tutorial checkpoints are currently captured.
- Added the restart action to the existing scenario-info prompt popup rather than creating a new menu surface.
- The restart button is only visible when the popup is showing a replayed scenario info prompt.
- The button uses `runtimeActions.restartFromCheckpoint()` when a checkpoint exists and `runtimeActions.resetScenario()` when no checkpoint exists.
- Follow-up fix: replayed scenario-info prompts now show a generic restart button even when no checkpoint exists, instead of exposing prompt actions such as `Start` that only reset tooltip/tutorial prompt state.
- Follow-up 3 accepted: add a checkpoint when onboarding completes and tutorial free flight begins inside `escape-earth`; do not add per-orbit checkpoints.

## Open Questions

- None for the implemented scenario-info restart button.

## Validation

- [x] `npm test -- tests/runtime/runtimeActions.test.ts tests/scenario/scenarioPrompts.test.ts` passed: 2 files, 19 tests.
- [x] `npm test` passed: 29 files, 140 tests.
- [x] `npm run build` passed.
- [x] `git diff --check` passed.
- [x] Browser smoke check passed: `?scenario=tutorial` renders `Leave Earth Orbit`, the checkpoint button exists but is hidden/disabled before any checkpoint, clicking `Start` advances to `Open Burn Control`, and no console errors were reported.
- [x] `npm run deploy:netlify` passed.
- [x] Follow-up validation passed: `npm test -- tests/runtime/runtimeActions.test.ts tests/scenario/scenarioPrompts.test.ts`, `npm test`, `npm run build`, and `git diff --check`.
- [x] Follow-up browser smoke check passed for prompt render/no-replay state: natural tutorial intro still shows `Start`, restart action is hidden/disabled outside replay mode, and no console errors were reported. Browser click automation was limited by locator/coordinate click issues on this canvas-heavy page.
- [x] Follow-up `npm run deploy:netlify` passed.
- [x] Follow-up 2 validation passed: `npm test -- tests/runtime/runtimeActions.test.ts tests/scenario/scenarioPrompts.test.ts`, `npm test`, `npm run build`, `git diff --check`, and `npm run deploy:netlify`.
- [x] Follow-up 3 focused tutorial tests passed: `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts`.
- [x] Follow-up 3 `npm test` passed: 29 files, 141 tests.
- [x] Follow-up 3 `npm run build` passed.
- [x] Follow-up 3 `git diff --check` passed.
- [x] Follow-up 3 `npm run deploy:netlify` passed.

## Next Step

Commit the reviewed branch changes, merge into local `main`, deploy production from `main`, then record the merge handoff.

## Brainstorm Handoff

Current checkpoint capture model:

- Checkpoints are stored on the active scenario session at `runtime.scenario.session.checkpoint`.
- `src/scenario/scenarioSession.ts` defines `RuntimeScenarioCheckpoint` and `createRuntimeScenarioCheckpoint`, which clones the simulation world plus assist, heading, viewport, and prediction horizon state.
- Tutorial-specific checkpoint creation currently happens in `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`.
- The tutorial router uses `createDefaultRuntimeScenarioCheckpoint(runtime)` to snapshot the current runtime into a checkpoint.
- Checkpoints are captured when tutorial scene transitions return a transition with `checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime)`.
- Restoring from a checkpoint happens through `createRuntimeCheckpointRestoreTransition` in `src/runtime/scenarioRecovery.ts`, then `applyCheckpointRestoreTransition` applies the restore to runtime state.

Initial implementation direction candidates:

- Add or move checkpoint capture points around tutorial phase boundaries.
- Include additional tutorial/session state in captured checkpoints if restore currently loses the intended tutorial step.
- Improve crash/restart behavior so tutorial recovery lands at clearer, more useful moments.

## Design Handoff

Scope:

- Add a third action button to the existing scenario prompt popup.
- Expose the button through `OverlayUiRefs` and `ScenarioPromptUiRefs`.
- Have `createScenarioPromptUpdater` show the button only when the active prompt is the replay prompt.
- Wire the button to checkpoint restore when a checkpoint exists, otherwise wire it to whole-scenario reset.

Target files:

- `src/ui/overlayUI/createOverlayUi.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `src/presentation/hudPresentation.ts`
- `src/app/createAppComponents.ts`

Risks:

- The prompt updater uses identity-based early returns, so restart button mode must be part of the prompt identity.
- Restoring from checkpoint only restores simulation state; the click handler needs to close the replay prompt explicitly.
- There is no existing DOM unit-test environment for this component, so browser smoke coverage is needed.

## Task Slices

- [x] Add prompt markup/ref for a restart button.
- [x] Add visibility logic based on replayed scenario info and choose checkpoint vs whole-scenario restart mode.
- [x] Wire the click to existing checkpoint restore or scenario reset behavior.
- [x] Validate with tests, build, browser smoke, and staging deploy.

## Implementation Handoff

Changed files:

- `src/ui/overlayUI/createOverlayUi.ts`
- `src/ui/scenario-prompts/scenario-prompts.ts`
- `src/ui/scenario-prompts/scenario-prompts.css`
- `src/presentation/hudPresentation.ts`
- `src/app/createAppComponents.ts`

Behavior implemented:

- Scenario prompt markup now includes a restart button.
- The prompt updater hides and disables that button by default.
- The button appears only when the player has reopened scenario info from the scenario pill.
- With a checkpoint, the button is labeled `Restart from checkpoint`, restores from the checkpoint through the existing runtime action, dismisses the replay prompt back to the scenario pill, and refreshes trajectory prediction.
- Without a checkpoint, the button is labeled `Restart scenario`, hides the original prompt buttons, calls the existing scenario reset action, and refreshes trajectory prediction.

Known gaps:

- Browser smoke did not force a replay prompt/checkpoint state into the app because there is no exposed debug hook for doing that without mutating app internals. Existing runtime tests cover the reset/restore paths, and browser smoke verifies prompt rendering and non-replay hidden state.

## Cleanup Notes

- No new abstraction was added beyond the existing prompt refs/updater path.
- The restart action signal was added to prompt identity so DOM updates are not skipped when checkpoint availability changes.
- No unrelated refactors were made.

## Review Notes

- No supplied external findings were present.
- Self-review checked that the button is not shown during active coaching prompts and that the click handler reuses existing checkpoint restore and scenario reset behavior.
- Residual risk: low. The untested browser path is the button becoming visible in a real replay prompt, but the visibility condition is direct session state and the reset/restore paths already have coverage.
- Staging deploy:
  - Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a2d59be0b290360bd8bc9af--fanciful-bunny-d77b4b.netlify.app`
  - Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d59be0b290360bd8bc9af`

## Follow-Up Handoff

Reported issue:

- In the tutorial, the scenario pill could reopen the original intro prompt when there was no checkpoint.
- That popup showed `Start`, but pressing it only reset tutorial tooltip/onboarding state rather than restarting the world state, which made the UI look like a broken restart.

Implementation:

- Renamed the prompt action button concept from checkpoint-only to a generic restart button.
- Replayed scenario-info prompts now compute a restart action:
  - `checkpoint` when a checkpoint exists, labeled `Restart from checkpoint`.
  - `scenario` when no checkpoint exists, labeled `Restart scenario`.
- When the replay popup has no checkpoint, the original prompt buttons are hidden, so `Start` is not exposed from the scenario pill.
- `Restart scenario` calls the existing `runtimeActions.resetScenario()` path and refreshes trajectory prediction.
- `Restart from checkpoint` continues to call the existing checkpoint restore path, dismisses the replay popup, and refreshes trajectory prediction.

Latest staging deploy:

- Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a2d823260b313248d8f19b4--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d823260b313248d8f19b4`

## Follow-Up Handoff 2

Requested change:

- When the scenario-pill popup shows `Restart scenario`, also offer a non-destructive cancel/close action.

Implementation:

- Reused the existing secondary prompt button as `Cancel` in replay-popup `scenario` restart mode.
- `Cancel` dispatches the existing `dismiss_to_replay` prompt action, closing the popup back to the scenario pill.
- Checkpoint mode remains unchanged: it continues to show `Restart from checkpoint` alongside the original replay prompt actions.

Latest staging deploy:

- Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a2d836b996aba2d484a4438--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d836b996aba2d484a4438`

## Follow-Up Handoff 3

Requested change:

- Add the missing tutorial checkpoint after onboarding completes, when `intro-complete` leaves the onboarding gate and returns to free flight within `escape-earth`.
- Preserve existing major phase-boundary checkpoints and do not add per-orbit checkpoints.

Design:

- Locate the transition where onboarding `gateActive` becomes false and the active onboarding prompt is cleared.
- Attach `checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime)` to that transition.
- Add a focused regression test proving a checkpoint is captured at onboarding completion and the session remains in `escape-earth` free flight.

Task slices:

- [x] Update tutorial onboarding-complete transition to capture a checkpoint.
- [x] Add focused regression coverage.
- [x] Run focused tutorial tests, full tests, build, diff check, and staging deploy.

Implementation:

- `advance-onboarding-step` now attaches `createDefaultRuntimeScenarioCheckpoint(runtime)` when the acknowledged onboarding state has `gateActive: false`.
- Existing phase-boundary checkpoint behavior is unchanged.
- Added a regression test that completes `intro-complete`, verifies the tutorial remains in `escape-earth` free flight with onboarding inactive, verifies prompt UI returns to the scenario pill, and verifies the checkpoint captured the current world snapshot.

Review:

- No supplied external findings were present.
- Self-review checked that only the final onboarding acknowledgement gets the new checkpoint; intermediate onboarding steps still leave checkpoint unchanged.
- Residual risk: low. The checkpoint helper is the same helper already used for phase-boundary checkpoints.

Latest staging deploy:

- Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a2d84dbc96721bf20db71bd--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d84dbc96721bf20db71bd`

## Follow-Up Handoff 4

Requested change:

- Add an X/close button to the scenario-pill replay popup, similar to the UI settings popup close affordance.
- Rename the replayed prompt's `Start` action to `Restart`.

Implementation:

- Added a replay-only close button to the scenario prompt header in both overlay UI creation paths.
- The close button dispatches the existing `dismiss_to_replay` prompt action, closing the popup back to the scenario pill without changing scenario state.
- Replayed scenario-info prompts now display the original prompt action label `Start` as `Restart`.
- Existing restart behavior is preserved:
  - With a checkpoint, the popup shows `Restart` plus `Restart from checkpoint`.
  - Without a checkpoint, the popup shows `Restart scenario` plus `Cancel` and keeps the original prompt action hidden.

Validation:

- Passed: `npm test -- tests/runtime/runtimeActions.test.ts tests/scenario/scenarioPrompts.test.ts` (2 files, 19 tests).
- Passed: `npm test` (29 files, 141 tests).
- Passed: `npm run build`.
- Passed: `git diff --check`.
- Browser smoke check: tutorial prompt renders `Start` in the initial non-replay state, close/restart controls are hidden/disabled outside replay mode, prompt action data is populated, and no console errors were reported. Browser click automation still times out on this canvas-heavy page, so replay-state interaction was verified by code review and existing runtime paths rather than live click-through.
- Passed: `npm run deploy:netlify`.

Latest staging deploy:

- Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a2d8808c12b65997fc85d72--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d8808c12b65997fc85d72`

## Follow-Up Handoff 5

Requested change:

- Add tutorial checkpoints when the first Moon orbit and first Earth orbit are attempted.

Implementation:

- Added `orbitAttemptCheckpointCaptured` to tutorial orbit progress state.
- `advanceOrbitScene` now captures `createDefaultRuntimeScenarioCheckpoint(runtime)` the first time an orbit phase enters bound-orbit progress, then marks the orbit attempt checkpoint as captured.
- The flag prevents the checkpoint from being overwritten on later orbit-progress frames.
- Existing phase-boundary checkpoints remain unchanged.

Validation:

- Passed: `npm test -- tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress.test.ts` (2 files, 28 tests).
- Passed: `npm test` (29 files, 143 tests).
- Passed: `npm run build`.
- Passed: `git diff --check`.
- Passed: `npm run deploy:netlify`.

Latest staging deploy:

- Production URL for shared staging site: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a2d8c796569dae63222166b--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a2d8c796569dae63222166b`

## Final Shipit Review

Review result:

- No blocking findings.
- Replay prompt controls reuse existing prompt dispatch/runtime action paths.
- Tutorial checkpoints are captured at the agreed recovery moments: post-onboarding free flight, phase boundaries, first Moon orbit attempt, first Earth orbit attempt, and completion.
- The first-orbit-attempt checkpoint intentionally captures once per orbit phase; leaving and re-entering orbit does not overwrite it.

Validation:

- Passed: `npm test` (29 files, 143 tests).
- Passed: `npm run build`.
- Passed: `git diff --check`.

Merge status:

- Pending branch commit and local merge to `main`.

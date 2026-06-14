# Shipit State

Task: Free roam camera
Branch: free-roam-camera
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
- [x] PR opened/updated (waived: direct merge to `main` requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Created branch `free-roam-camera` from `checkpoint-improvement-tutorial-scenario`.
- Existing untracked files `pnpm-lock.yaml` and `pnpm-workspace.yaml` were removed after the user explicitly requested cleanup.
- Use `free-roam-camera` as the branch name; user-visible naming can prefer `Unlocked camera` if it better matches centered vs free-pan semantics.
- Default camera behavior remains centered on the spacecraft.
- Scenario camera behavior should be optional configuration, with centered/default and optional runtime locking.
- Tutorial should start centered and locked, then unlock camera changes after the initial onboarding tooltips finish.
- Repository deploy guidance applies: this feature was deployed to woven-moth staging before handoff and to production after merging into `main`.

## Open Questions

- None blocking. The UI label may use `Centered` / `Unlocked` rather than `Free roam` if it fits existing control style better.

## Validation

- [x] Focused tests passed: `npm test -- tests/runtime/runtimeActions.test.ts tests/runtime/runtimeStateTransitions.test.ts tests/runtime/scenarioRecovery.test.ts tests/scenario/scenarioDirectives.test.ts tests/scenario/runtimeScenario.test.ts tests/scenario/specific-scenarios/tutorial/tutorialScenario.test.ts tests/app/createInitialAppRuntimeState.test.ts`.
- [x] `npm test` passed: 29 files, 150 tests.
- [x] `npm run build` passed; Vite reported the existing large chunk warning.
- [x] `git diff --check` passed.
- [x] `npx biome check <touched files>` passed after scoped Biome formatting/import fixes.
- [x] Browser smoke passed: tutorial starts with `Centered` selected and disabled with `Locked`; onboarding first tooltip keeps camera locked; sandbox camera menu can switch to `Unlocked`; unlocked drag moves the spacecraft callout; centered long drag over 50% viewport switches to `Unlocked`; a later smoke loaded the game canvas with no console errors after focal zoom changes.
- [x] Follow-up threshold smoothing validation passed: `npm test`, `npm run build`, `git diff --check`, Biome check for the two touched input files, browser smoke loaded the game canvas with no console errors.
- [x] `npm run deploy:netlify:staging:woven-moth` passed.

## Next Step

Task complete. Merged into `main` and deployed production.

## Brainstorm Handoff

Problem:

- The game currently keeps the camera centered on the spacecraft.
- Add an optional unlocked camera mode where the player can pan the view with a single-finger swipe/drag.
- The player can switch modes from UI unless the active scenario locks camera changes.
- An intentional long single-finger swipe, greater than 50% of viewport width or height, should also switch from centered to unlocked camera.
- Scenarios may define starting camera style and whether camera style changes are locked.
- Tutorial starts centered and locked, then unlocks after the initial onboarding tooltips complete.

User-facing behavior:

- Default mode remains centered on the spacecraft.
- UI offers a clear centered/unlocked camera switch.
- In unlocked mode, single-finger drag pans the camera center.
- In centered mode, the current behavior is preserved until the player intentionally performs the long swipe unlock gesture and camera changes are not locked.
- When locked by scenario, player controls for camera style are disabled or hidden in a way that makes the current state clear.

Edge cases:

- Scenario transition/reset should restore scenario-defined camera defaults.
- Runtime scenario directives may need to lock or unlock the camera after scenario start.
- Input handling must avoid breaking existing thrust/time-warp touch controls.

## Design Handoff

Implementation scope:

- Add camera control state to runtime UI: `mode` (`centered` or `unlocked`) and `panOffset`.
- Add scenario directives for starting/default camera mode and whether camera mode changes are locked.
- Apply scenario defaults on full scenario load/reset and checkpoint restore; preserve player camera state during ordinary frame advancement unless directives force a change.
- Update camera target resolution:
  - centered mode follows the existing spacecraft/body-follow target plus directive offset.
  - unlocked mode uses the stored pan offset as the world-space camera center.
- Add runtime actions for setting/toggling camera mode and panning by world-space deltas.
- Add pointer input support:
  - single-pointer drag in unlocked mode pans the camera.
  - in centered mode, a drag whose absolute movement exceeds 50% of viewport width or height unlocks camera if not locked, then pans from the drag start target.
  - keep existing wheel zoom, resize, double-click, and double-tap heading selection behavior.
- Add a top-menu camera segmented control labeled `Centered` / `Unlocked`; disable it when scenario directives lock camera mode changes.
- Tutorial specifics:
  - start centered and locked during initial onboarding.
  - keep it locked while onboarding `gateActive` is true.
  - unlock after `intro-complete` acknowledgement by allowing directives to resolve unlocked changes.

Target files:

- `src/runtime/appRuntimeState.ts`
- `src/runtime/runtimeActions.ts`
- `src/runtime/runtimeStateTransitions.ts`
- `src/input/pointerCameraInput.ts`
- `src/input/uiUserActions.ts`
- `src/scenario/scenarioDirectiveTypes.ts`
- `src/scenario/scenarioDirectives.ts`
- `src/scenario/scenarioSession.ts`
- `src/scenario/runtimeScenario.ts`
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- `src/ui/createTopMenu.ts`
- `src/app/createInitialAppRuntimeState.ts`
- `src/app/createAppComponents.ts`
- focused tests under `tests/runtime` and `tests/scenario`

Risks:

- Touch controls sit above the canvas, so camera pan only needs canvas pointer handling; avoid claiming touches owned by touch-control panels.
- `pointermove` may fire for mouse hover; panning must require an active primary button/touch pointer.
- Checkpoint restore should not resurrect stale unlocked camera center from unrelated free-pan state.
- Debug snapshots may clone scenario session and checkpoints; camera checkpoint fields must remain backward compatible.

Validation strategy:

- Add unit tests for camera mode actions, lock behavior, default reset behavior, and tutorial directive lock/unlock.
- Run full test suite, build, diff check, browser smoke on desktop/mobile, and staging deploy.

Completion criteria:

- Users can switch between centered and unlocked camera from UI unless scenario-locked.
- Long single-finger/canvas swipe unlocks camera when allowed.
- Tutorial starts locked/centered and unlocks after initial onboarding.
- Existing heading selection, zoom, scenario reset, checkpoint restore, and tutorial tests continue passing.

## Task Slices

- [x] Add camera mode/runtime types, defaults, and transition reset/restore behavior.
- [x] Add scenario directive fields and tutorial lock/unlock resolution.
- [x] Add runtime actions and camera target update logic.
- [x] Add pointer drag/long-swipe camera pan behavior.
- [x] Add top-menu camera UI and wiring.
- [x] Add/adjust focused tests.
- [x] Run full validation.

## Implementation Handoff

Changed files:

- Runtime/camera state: `src/runtime/appRuntimeState.ts`, `src/runtime/runtimeActions.ts`, `src/runtime/runtimeStateTransitions.ts`, `src/runtime/scenarioRecovery.ts`, `src/runtime/createScenarioRuntimeController.ts`
- Scenario contracts/directives: `src/scenario/scenarioDirectiveTypes.ts`, `src/scenario/scenarioDirectives.ts`, `src/scenario/scenarioSession.ts`, `src/scenario/runtimeScenario.ts`, `src/debugScenarioSnapshot.ts`
- Tutorial behavior: `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`
- Input/UI: `src/input/pointerCameraInput.ts`, `src/input/uiUserActions.ts`, `src/ui/createTopMenu.ts`, `src/ui/segmentedControl.ts`, `src/style.css`, `src/app/createAppComponents.ts`, `src/app/createInitialAppRuntimeState.ts`
- Tests: focused runtime/scenario fixture and behavior tests.

Behavior implemented:

- Runtime now tracks camera mode (`centered` or `unlocked`) and an unlocked camera center.
- Scenario definitions can provide a starting camera mode; directives can force a camera mode and lock mode changes at runtime.
- Centered mode keeps the existing spacecraft/body-follow behavior; unlocked mode uses the stored pan center.
- Top menu exposes a `Centered` / `Unlocked` segmented camera control and disables it when scenario directives lock changes.
- Pointer drag pans unlocked camera; a drag beyond half the viewport switches from centered to unlocked when changes are not locked.
- The centered-to-unlocked long-swipe transition starts panning from the threshold crossing point rather than from the gesture start, avoiding a camera jump when the unlock threshold is met.
- Touch pinch zoom preserves the world point under the two-finger midpoint in unlocked camera mode; double-tap zoom uses the default center zoom.
- Target-heading line and ripple feedback are anchored to the selected world point so they remain aligned after camera pan/zoom.
- Tutorial phase one starts centered and locked, and unlocks after the onboarding gate completes.
- Checkpoint restore transitions can carry optional camera mode and pan center; locked scenario directives still override restored camera mode when appropriate.

Known gaps:

- None.

## Cleanup Notes

- Applied scoped Biome formatting/import fixes to the touched files only.
- Tightened directive camera-mode enforcement so a future force-unlocked scenario does not repeatedly overwrite an already-unlocked pan center during directive sync.
- Kept camera mode labels as `Centered` and `Unlocked`; `Free roam` remains a reasonable concept name, but `Unlocked` reads better next to `Centered` in the compact UI.
- No unrelated refactors were made.

## Review Notes

- No supplied external findings were present.
- Self-review checked scenario load/reset, checkpoint restore, tutorial lock/unlock, top-menu disabled state, and pointer pan interactions against the accepted requirements.
- Follow-up review checked both desktop pointer and mobile touch overlay unlock paths. The threshold crossing helper computes the first axis threshold crossed along the gesture vector, and panning starts from that crossing point instead of the original touch down point.
- Residual risk: low around exact mobile feel because browser automation cannot fully emulate all real-device touch streams here. The touch overlay now owns mobile pan, pinch, and double-tap zoom paths directly; unit tests and browser smoke cover state transitions, build integrity, and no-error startup.
- Solution retrospect: no rewrite warranted. The duplicated threshold helper exists in desktop and mobile input layers to keep the change scoped; extracting a shared helper can be deferred unless future gesture logic needs the same calculation.
- Proposed follow-ups: none required for this task.
- Staging deploy:
  - Production URL for woven-moth staging site: `https://space-web-game-woven-moth.netlify.app`
  - Unique deploy URL: `https://6a2ec224cf6acaf93aca819f--space-web-game-woven-moth.netlify.app`
  - Build logs: `https://app.netlify.com/projects/space-web-game-woven-moth/deploys/6a2ec224cf6acaf93aca819f`

## Merge Notes

- Feature commits:
  - `d93882d Add unlocked camera controls`
  - `9907cab Smooth camera unlock panning`
- Main merge commit: `1beda96 Merge branch 'free-roam-camera'`
- Main validation after merge:
  - `npm test` passed: 30 files, 152 tests.
  - `npm run build` passed; Vite reported the existing large chunk warning.
  - `git diff --check` passed.
- Production deploy:
  - Production URL: `https://space-web-game.netlify.app`
  - Unique deploy URL: `https://6a2ec44d56b5426f3ed975bb--space-web-game.netlify.app`
  - Build logs: `https://app.netlify.com/projects/space-web-game/deploys/6a2ec44d56b5426f3ed975bb`

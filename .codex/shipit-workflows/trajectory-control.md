# Shipit State

Task: Add trajectory prediction main control
Branch: trajectory-control
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
- [x] Merged to main

## Artifacts

- Brainstorm: not applicable
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Use a clean worktree at `/Users/chmurson/Dev/priv/worktrees/space-web-game/trajectory-control/space-web-game` because the primary checkout has unrelated uncommitted edits on `wrap-control-invert`.
- Follow `AGENTS.md`: verify executable changes with relevant tests/builds, deploy non-main user-visible changes to the shared staging site before handoff, and share the staging URL.
- Preserve existing branch/worktree changes and avoid reverting unrelated user work.

## Open Questions

- None.

## Validation

- [x] `npm test -- --run`
- [x] `npm run build`
- [x] `npm run deploy:netlify`
- [x] Final pre-merge validation
- [ ] Production deploy from `main`

## Next Step

Deploy production from `main`.

## Design Handoff

Existing behavior:

- The mobile time-warp control is currently a selector-style edge-reveal control created by `createConfiguredTimeWarpControl`.
- The trajectory prediction horizon is already controlled by `decreaseCoastHorizon` and `increaseCoastHorizon` actions from the top menu.
- Runtime action dispatch already refreshes trajectory prediction when those horizon actions are committed.
- Scenario directives can cap the max coast prediction horizon, and the top menu uses that runtime cap.

Implementation scope:

- Extract the selector model/presenter/view/gesture behavior into a generic step-selector control under `src/ui/touchControls/stepSelectorControl`.
- Keep the time-warp control as a configured adapter over the generic selector so current behavior and tests remain covered.
- Add a trajectory horizon preview policy that steps through clean readable horizon values and respects min/global max/runtime scenario max.
- Add a trajectory horizon edge-reveal control using the same selector style and committing the existing coast-horizon actions.
- Hide the trajectory horizon control when trajectory UI is hidden by scenario directives.
- Keep the existing top-menu trajectory stepper as-is.

Risks:

- Touch gesture routing currently assumes a single selector-style `left-zone`; adding a second selector requires routing active sessions by control id.
- Layout must still stack reveal tabs predictably when burn, warp, and trajectory controls share an edge.
- Time-warp behavior should not regress while the selector becomes reusable.

Validation strategy:

- Add focused tests for generic selector presentation/model behavior and trajectory horizon preview policy.
- Run `npm test -- --run` and `npm run build`.
- Because the change affects user-visible runtime behavior on a non-main branch, run `npm run deploy:netlify` before handoff.

## Task Slices

- [x] Extract reusable step-selector model, presenter, view, and control factory.
- [x] Rewire the time-warp selector through the generic control without changing its runtime actions.
- [x] Add trajectory horizon previews and a configured trajectory control.
- [x] Wire the new control into touch controls, HUD visibility, and app component action dispatch.
- [x] Add/update focused tests.

## Implementation Handoff

Changed files:

- Added generic step selector files under `src/ui/touchControls/stepSelectorControl/`.
- Kept time warp as an adapter in `src/ui/touchControls/selectorTimeWarpControl/createSelectorTimeWarpControl.ts`.
- Added trajectory horizon policy in `src/runtime/trajectoryHorizonControlPolicy.ts`.
- Added trajectory horizon adapter in `src/ui/touchControls/trajectoryHorizonControl/createTrajectoryHorizonControl.ts`.
- Wired the new control in `src/ui/touchControls/createTouchControls.ts`, `src/app/createAppComponents.ts`, and `src/presentation/hudPresentation.ts`.
- Updated selector tests and added `tests/runtime/trajectoryHorizonControlPolicy.test.ts`.

Behavior implemented:

- Time warp and trajectory horizon now share one selector model/presenter/view/control factory.
- Mobile touch controls include a left-edge `Traj` reveal tab.
- The trajectory selector displays current prediction horizon and adjacent horizon values.
- Committing a trajectory selector step dispatches the existing `decreaseCoastHorizon` or `increaseCoastHorizon` action, preserving centralized trajectory refresh.
- The trajectory selector hides when scenario directives hide trajectory UI.
- Trajectory horizon values now step through clean whole-day values after `16h` (`1d`, `2d`, `4d`, ...), avoiding fractional day labels such as `1.3d`.
- Trajectory horizon labels use a dedicated formatter so non-day caps remain readable as whole hours, such as `32h`.
- The top menu includes a `Trajectory side` setting matching the existing Burn/Warp side controls.

Deviations:

- None.

Known gaps:

- In-app Browser could only verify DOM/state for touch controls because its environment reports fine pointer, so existing CSS intentionally hides `.touch-controls` outside coarse-pointer devices.

## Cleanup Notes

- Removed old time-warp-specific selector view/CSS files after moving that implementation to generic step-selector files.
- Kept small compatibility wrappers for `selectorTimeWarpControlModel` and `selectorTimeWarpControlPresenter` so existing test/import names remain stable.
- Ran targeted Biome check/fix on changed files; no formatting/import issues remain.

## Review Notes

Supplied findings:

- None.

Self-review findings:

- Renamed stale `beginLeftZoneSession` helper to `beginTimeWarpSession` after the selector-session refactor.
- Rechecked the generic selector swipe direction against the pre-refactor time-warp selector and kept it unchanged; the control moves the displayed value stack with the finger, so dragging down selects the value shown above the current value.
- Reviewed the latest trajectory ladder and formatter update. No merge-blocking findings found.

Solution retrospect:

- The reusable control boundary is appropriate: gesture/model/view/presenter behavior is generic, while time warp and trajectory horizon own their action mapping and value formatting.
- No broader rewrite is justified.
- Test coverage covers the reused selector wrappers, the new trajectory horizon preview policy, runtime action ladder behavior, settings parsing, and the no-fractional-days formatter. Touch interaction integration is covered by build/type checks and Browser DOM verification.
- User-facing docs are not needed; this is an in-game control uplift.
- Shipit state contains enough context for continuation.

Validation results:

- Passed: `npm test -- --run` (26 files, 117 tests).
- Passed: `npm run build` (config validation, `tsc`, Vite release build). Vite emitted the existing large chunk warning.
- Passed: targeted `npx biome check ...` on changed files.
- Passed: scoped `npx biome check ...` on the 31 branch-touched source and test paths during final review.
- Passed: `git diff --check`.
- Non-blocking: full `npx biome check src tests scripts` reports existing repo-wide import-order/format diagnostics outside this branch's scope, so no broad formatting churn was applied.
- Browser verification: local app opened at `http://127.0.0.1:5178/`; Free Roam loaded; DOM confirmed `Warp`, `Traj`, and `Burn` reveal controls and trajectory selector labels `8.0h`, `4.0h`, `2.0h`, `1.0h`, `30m`. Browser environment reported fine pointer, so existing CSS kept touch controls visually hidden there.
- Staging deploy passed: `npm run deploy:netlify`.
- Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`.
- Unique deploy URL: `https://6a2ba17d0ce3e1f5fb1897ec--fanciful-bunny-d77b4b.netlify.app`.
- Follow-up deploy passed after adding the top-menu trajectory side setting: `npm run deploy:netlify`.
- Follow-up unique deploy URL: `https://6a2ba3c93c810a133c896b27--fanciful-bunny-d77b4b.netlify.app`.
- Follow-up deploy passed after changing trajectory values to avoid fractional-day labels: `npm run deploy:netlify`.
- Follow-up unique deploy URL: `https://6a2bac62680ce5da0e32d29b--fanciful-bunny-d77b4b.netlify.app`.

Follow-up change:

- Added persisted `touchTrajectoryControlSide` setting with default `left`.
- Added a `Trajectory side` segmented control to the top menu, matching Burn/Warp side settings.
- Added `touchTrajectorySide` URL override support for layout harnessing.
- Browser verification confirmed `Trajectory side` appears in the menu, selecting `right` via URL override marks the Right option checked, and the trajectory reveal control receives the right-edge class.
- Changed trajectory horizon stepping from pure half/double behavior to an explicit ladder that switches from hours to whole days at `24h`.
- Browser verification confirmed the top-menu horizon label advances from `16h` to `1d`, then `2d`, with no console errors.

Residual risk:

- No in-browser touch swipe commit was performed because the in-app Browser did not emulate coarse pointer/touch media. Runtime action dispatch, previews, and type checks cover the behavior path.

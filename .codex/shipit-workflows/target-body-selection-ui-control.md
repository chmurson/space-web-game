# Shipit State

Task: Target body selection UI control
Branch: target-body-selection-ui-control
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
- [x] PR opened/updated (not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Branch created from `further-improvement-to-continue-swipe-control` HEAD on 2026-06-12.
- No `.codex/shipit.config.md`, `.codex/delivery-flow.config.md`, or `.codex/workflow.config.md` is present; use the standard Shipit harness plus `AGENTS.md`.
- Workflow started in brainstorm because "target body selection UI control" named the feature area but not the expected behavior, placement, interaction model, or fallback states.
- Branch is non-`main`; executable/user-visible changes should be validated and deployed to the shared staging site before handoff.
- Existing runtime already supports manual assist target selection by `runtime.simulation.assistTargetIndex`; `cycleAssistTarget` increments that index.
- Release config currently enables `assistTarget.autoSelectNearestSurface`, so a manual selector must either be hidden/disabled while auto-select is active or explicitly switch targeting into manual mode.
- Existing touch controls use edge-reveal tabs and step-selector gestures for swipeable controls; a target selector can likely reuse that control language instead of inventing a new surface.
- User accepted moving to design on 2026-06-12.
- The target UI should clearly communicate the active target body because trajectory rendering and the current speed value are target-relative.
- The game should keep automatic target switching until the user explicitly overrides it.
- Manual override should stop automatic switching, while still leaving room for a recommendation affordance that lets the user accept the auto-recommended body again.
- The target status should be visible as a compact pill, and the open selection tool should show secondary body metrics such as distance, relative speed, gravity influence/share, and bound/free orbital energy state.
- User raised concern that combining the top target pill with the interactive selector may blur telemetry/status and controls; design should evaluate separated status/control alternatives before implementation.
- User prefers keeping passive telemetry focused on speed. Target body and auto/manual/locked state should move to a separate passive status surface rather than crowding the speed pill.
- Desktop behavior is out of scope for the immediate design pass; focus on the mobile interaction first and revisit desktop separately.
- Current focus is the passive target body pill, not the selector. Desired format: `<body sphere> • <body name> • <status>`.
- The body sphere should be a very small simplified circular/spherical body mark scaled to the surrounding font size, using the body's color.
- Avoid status words in the compact pill. Communicate target ownership with small graphical marks instead of labels like `Auto`, `Manual`, or `Locked`.
- Manual override needs a visual recommendation cue when the automatic recommendation differs from the manually selected body.
- Graphical target ownership marks are accepted in principle: auto-selected target gets an orbit/radar halo, player-selected target gets a pin mark, scenario/system-forced target gets a lock mark.
- Mobile selector UI is accepted as a dedicated edge-reveal `Target` control, matching the existing mobile control pattern.
- First selector version should keep body metrics intentionally simple and show distance only; relative speed, gravity influence/share, and energy/orbit stats are deferred.
- Follow-up selector mode control: the Target selector should always show one automatic-targeting row with a toggle when automatic targeting is available. Toggle on lets the automatic system control the target. Toggle off locks the current active body manually.

## Open Questions

- None blocking implementation. Mobile spacing and exact icon treatments can be tuned during browser verification.

## Validation

- [x] `npm test`
- [x] `npm run build`
- [x] `npx biome lint src tests scripts`
- [x] Browser verification for desktop and narrow mobile viewports
- [x] `npm run deploy:netlify` after meaningful executable/user-visible changes

## Next Step

Hand implementation back with validation and latest staging URL.

## Brainstorm Handoff

### Current Understanding

The feature branch should explore a UI control that lets the player choose a target body. The codebase already has target-body selection state via `assistTargetIndex`, and the current public action only cycles to the next target. The main product decision is whether this new control is a manual-targeting override in an auto-targeting game, or a control that is only meaningful when auto-targeting is disabled.

### Code Findings

- `src/assist/assistTarget.ts` selects either an automatic trajectory-centered target or a manual target by normalized body index.
- `src/runtime/runtimeActions.ts` exposes `cycleAssistTarget`, but no action to set a specific body/index.
- `src/input/keyboardShortcuts.ts` maps `T` to `cycleAssistTarget` only when auto-discovery is disabled.
- `config/base.yml` enables `assistTarget.autoSelectNearestSurface: true` for the main game config.
- `src/ui/touchControls/createTouchControls.ts` has reusable edge-reveal placement and step-selector interaction patterns for mobile controls.
- `src/ui/overlayUI/createOverlayUi.ts` creates refs for `statTarget`, but the current top telemetry strip does not render a visible target pill.
- `ideas/resolved/2026-04-10-auto-target-switching.md` documents why auto-targeting follows the predicted trajectory and avoids flicker.

### Goals

- Add a clear, usable control for choosing a target body.
- Preserve existing control patterns and game interaction conventions.
- Keep desktop and touch ergonomics in scope.

### Non-Goals

- Reworking unrelated movement, trajectory, or rendering systems.
- Deploying before executable/user-visible changes exist.

### User-Facing Behavior

Candidate design direction: add a target body selector that reuses the existing edge-reveal swipe selector pattern, displays body names in sequence, and commits by setting `assistTargetIndex` directly. If auto-select is active, the selector should either be unavailable with clear disabled behavior or its first use should intentionally switch targeting into manual mode. A compact target pill in the HUD could show the current body so players understand which body the trajectory-relative UI is using.

### Edge Cases And Failure States

- Empty target list.
- Current target becomes invalid.
- Scenario has `forcedAssistTargetId`; manual control should not fight the directive.
- Selection attempted during states where retargeting may not make sense.
- Dense lists or long body names on narrow screens.

## Design Handoff

### Product Behavior

Keep the existing speed telemetry passive and speed-focused. The speed display should remain the primary readout for target-relative speed, while target body identity and targeting mode move into a separate passive target status surface. The first target status surface should be a compact pill with `<body sphere> • <body name> • <graphical status mark>`.

Automatic mode remains the default when `assistTarget.autoSelectNearestSurface` is enabled. In automatic mode, the existing trajectory-centered auto switch continues to pick the active target; the UI updates when that target changes. When the user selects a body directly, the runtime switches to manual override mode and stops applying automatic target switches. While manual override is active, the game still computes the automatic recommendation in the background; if it differs from the manual body, the selector can show a small recommendation cue using the recommended body's mini sphere/name and orbit/radar mark. Accepting it should return the runtime to automatic targeting rather than silently switching manual targets.

If a scenario sets `forcedAssistTargetId`, that target wins. The UI should communicate a locked/forced state and should not allow manual rows to override it.

### UI Design

Use separated passive and interactive surfaces. The passive telemetry should not open the selector directly. For mobile, use a dedicated edge-reveal `Target` tab in the existing mobile control stack.

The opened panel should stay compact and can use drawer-like width only if mobile spacing requires it.

The picker should list selectable bodies as compact rows. Each row should include:

- body sphere and body name
- current/recommended/locked state using the same graphical marks as the passive pill
- distance or surface distance from the spacecraft

Rows should be real buttons. Selecting a body commits that body as the manual target and closes the panel. The panel should also include a compact auto/recommendation action when auto targeting is available and not forced.

Long names and dense metrics must wrap/truncate predictably on mobile. Do not add instructional copy; the visible text should be status and values, not usage explanation.

### Runtime/Data Flow

Add a runtime target selection mode, tentatively `assistTargetSelectionMode: 'auto' | 'manual'`, to `AppRuntimeSimulationSlice`.

Initialize it from config:

- `auto` when `config.assistTarget.autoSelectNearestSurface` is true
- `manual` when the config disables auto target selection

Update `createGameQueries` so the effective target source is:

- `forced` when `runtime.scenario.directives.forcedAssistTargetId` resolves to a body
- `auto` when config allows auto selection and `assistTargetSelectionMode === 'auto'`
- `manual` otherwise

Keep the existing auto target heuristic and hysteresis for automatic mode. In manual mode, return the manual body selected by `assistTargetIndex`, but also compute the auto decision as a recommendation for UI state.

Expose a query-level target UI snapshot, for example:

```ts
type AssistTargetUiState = {
  activeTarget: Body
  mode: 'auto' | 'manual' | 'forced'
  recommendedTarget: Body | null
}
```

The exact type name can follow local naming once implemented. The important contract is that HUD and selector code should not reimplement target-source resolution.

Add runtime actions/callbacks for:

- selecting a target index, which sets `assistTargetIndex` and `assistTargetSelectionMode = 'manual'`
- returning to automatic target selection, which sets `assistTargetSelectionMode = 'auto'` when config allows it

Existing `cycleAssistTarget` should continue to work for manual configs; if it is used while auto is available, it should be treated as a manual override.

### Target Files/Modules

- `src/runtime/appRuntimeState.ts`: add target selection mode type/state.
- `src/app/createInitialAppRuntimeState.ts`: initialize target selection mode from config.
- `src/runtime/gameQueries.ts`: resolve forced/auto/manual target state and expose UI state/recommendation.
- `src/runtime/runtimeActions.ts`: add manual target and return-to-auto actions.
- `src/app/createAppComponents.ts`: wire target UI callbacks and query state into presentation/UI.
- `src/ui/overlayUI/createOverlayUi.ts`: add passive target status refs if needed; keep speed telemetry focused on speed.
- `src/presentation/hudPresentation.ts`: update speed telemetry and separate target status each frame.
- `src/style.css` and/or `src/ui/overlayUI/overlayUIStyles.css`: target pill and picker responsive styling.
- Tests under `tests/runtime`, `tests/app`, and targeted `tests/ui` if the UI state formatting is factored into pure presenter helpers.

### Risks

- Adding another passive status element can crowd mobile layouts; browser verification must cover narrow widths.
- Target state can become inconsistent if forced targets, manual index wrapping, and recommendations are resolved separately; keep target resolution in `gameQueries`.
- The selector could become too data-heavy; keep the first version to distance only and defer relative speed, gravity, and energy/orbit stats.
- Old debug snapshots/checkpoints may not include the new target mode. Restore paths should use a safe fallback rather than assuming the field exists.

### Test Strategy

- Add `gameQueries` tests for auto default, manual override target, manual recommendation, config-disabled manual mode, and forced target precedence.
- Add `runtimeActions` tests for selecting a target index and returning to auto.
- Add/adjust `createInitialAppRuntimeState` tests for config-derived initial mode.
- Add pure presenter/formatter tests for target row distance labels if the UI formatting logic is extracted.
- Existing step-selector tests are not directly relevant if the first implementation uses a picker panel rather than a swipe selector.

### Validation Commands

- `npm run test`
- `npm run build`
- Browser verification with the in-app browser for desktop and mobile viewports.
- `npm run deploy:netlify` after implementation/review because this branch is non-`main` and the change will affect user-visible behavior.

### Cleanup Expectations

- Keep target-selection logic centralized in runtime queries/actions rather than scattering target decisions through the HUD.
- Keep the UI component compact and avoid expanding the generic step selector unless implementation proves it is the right shared abstraction.
- Remove or update any stale target refs if the new pill replaces previously unused `statTarget` plumbing.

## Task Slices

- [x] Runtime target source: add `assistTargetSelectionMode`, initialize it from config, and update target query resolution for forced/auto/manual/recommended states.
- [x] Runtime actions: add manual body selection and return-to-auto callbacks, with tests for state changes and index wrapping.
- [x] Passive telemetry/status: keep speed focused on target-relative speed and add a separate target body/mode status surface.
- [x] Mobile target control: add an edge-reveal `Target` tab, list body rows with distance-only secondary text, commit manual selections, and expose the auto recommendation action.
- [x] Responsive styling: tune mobile layouts so target text/metrics do not overlap existing menu, scenario, telemetry, or touch controls; desktop can remain deferred unless needed to avoid regressions.
- [x] Verification: run tests/build, verify desktop/mobile in browser, record results, and deploy staging after implementation is complete.

## Implementation Handoff

Implemented runtime-owned target source state and UI plumbing:

- `AppRuntimeSimulationSlice` now includes `assistTargetSelectionMode: 'auto' | 'manual'`, initialized from `assistTarget.autoSelectNearestSurface`.
- `createGameQueries` exposes `getAssistTargetUiState()` with forced/auto/manual source and manual-mode recommendation.
- `createRuntimeActions` exposes `selectAssistTargetIndex()` and `returnToAutomaticAssistTargetSelection()`, and treats `cycleAssistTarget` as a manual override.
- The HUD now renders a separate target pill with body sphere, body name, and graphical source mark.
- Touch controls now include a left-edge `Target` reveal control with distance-only body rows, a persistent automatic-targeting switch row, and a blue tab badge when manual selection differs from the automatic recommendation.
- Added shared target glyph CSS for body spheres and auto/manual/forced marks.

Completed task slices: runtime target source, runtime actions, passive telemetry/status, mobile target control, responsive styling. No planned product behavior was deferred beyond the already agreed metrics deferral.

## Cleanup Notes

- Kept target selection decisions centralized in `gameQueries` and state mutations in `runtimeActions`.
- Added `src/ui/targetBodyGlyphs.css` so the HUD and touch selector share sphere/status glyph styles without coupling overlay code to touch-control CSS.
- During review, changed `TargetControl.syncUi()` to avoid rebuilding selector rows on every animation frame; it now rerenders only when active/recommended target state or formatted row labels change.
- During the follow-up spacing pass, removed the recommended target mini-cluster from the passive pill and moved the visible recommendation cue to the `Target` edge tab.
- During the follow-up mode-control pass, replaced the conditional return-to-auto row with a persistent automatic-targeting switch row. The switch supports auto-current-body to manual-current-body and manual-recommended-body to automatic without changing the body.
- Formatting was applied only to touched files.

## Review Notes

External CodeRabbit findings supplied after review were assessed before applying any changes:

- `src/presentation/hudPresentation.ts`: stale/incorrect for the current tree. The target pill already uses `showTargetPill`, not `showSpeedPill`.
- `src/ui/createDialog.ts`: not applied for this scoped change. Dialogs are app-lifetime objects in current usage, not repeatedly created/destroyed. The suggested `AbortController` fix would abort on `close()`, which is not a destroy lifecycle and would break keyboard handling after a dialog is reopened.

Self-review covered the diff against the design handoff, forced/manual/auto precedence, scenario reset behavior, mobile spacing, hidden touch-control state, and per-frame UI sync. The only in-scope finding was the target selector rebuilding rows during frame sync; fixed with a render signature.

Residual risk: none known for the scoped change. Runtime actions and query behavior are covered by automated tests; the follow-up UI passes were verified in a mobile touch-emulated browser.

Validation results:

- `npm test`: 28 files passed, 129 tests passed.
- `npm run build`: passed; Vite emitted the existing chunk-size warning.
- `npx biome lint src tests scripts`: passed with no fixes.
- Browser verification: local app loaded, game view entered, target pill/status verified at 1280px, 390px, and 320px widths; browser console had no errors/warnings.
- Follow-up browser verification: mobile touch emulation at 390px verified that manual Moon selection leaves the top pill text as `Moon`, removes the old recommendation node, applies the manual target mark, and moves the `Earth recommended` cue to the `Target` tab. The only browser 404 was `/favicon.ico`.
- Automatic switch verification: mobile touch emulation at 390px verified automatic Earth -> manual Earth via switch off, manual Earth -> automatic Earth via switch on, manual Moon -> automatic Earth via switch on, and the switch row/panel fit without text overflow. The only browser 404 was `/favicon.ico`.
- `npm run deploy:netlify`: passed, including follow-up deploys.

Staging:

- Production URL for the shared staging site: https://fanciful-bunny-d77b4b.netlify.app
- Latest unique deploy URL: https://6a2e5617690632f5b2cddbe1--fanciful-bunny-d77b4b.netlify.app

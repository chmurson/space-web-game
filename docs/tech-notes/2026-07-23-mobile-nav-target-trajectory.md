# Mobile Nav Target and Trajectory

Issue: [#276](https://github.com/chmurson/space-web-game/issues/276)

Shipit state:
`.codex/shipit-workflows/agent/issue-276-nav-target-trajectory.md`

## What changed

- Mounted the existing mobile Target selector and Trajectory horizon selector
  in the Nav panel. Time Warp and Camera now form the wide left column while
  Trajectory stays visible in the narrow right column.
- Added an accessible current-target button below Trajectory. It reports the
  active body and target mode, exposes recommendation state, and toggles the
  unchanged Target selector as a popup over the left column.
- Removed the shipped Target and Trajectory edge wrappers and reveal tabs.
  Choosing a target or returning to automatic mode now leaves Nav open.
- Kept both controls independently scenario-driven. Hiding Trajectory or
  leaving/switching Nav cancels an active horizon gesture before it can commit.
- Removed Target-side and Trajectory-side choices from Settings and stopped
  applying those preferences at runtime. Their persisted/query/type fields are
  intentionally retained as inert compatibility data for issue #244.
- Updated tutorial copy and anchoring so mobile trajectory guidance opens Nav,
  focuses the real selector, and no longer points players to an edge tab.
- Added focused browser coverage and screenshots for automatic,
  recommended/manual, and forced Target states and normal, capped, and
  unavailable Trajectory states.
- A visual follow-up removed the redundant `Horizon` detail from the fixed
  70px Trajectory heading, made the vertically scrollable Nav panel explicitly
  contain horizontal overflow, and reordered the dock to Flight, Nav, Info,
  Ship, Settings.
- A later interaction follow-up made outside mouse or touch input dismiss only
  the Target popup. Nav remains open, and pointer input inside the popup still
  preserves it across target commits.
- A mobile settings follow-up removed the duplicate Trajectory prediction
  horizon from the coarse-pointer in-game Controls popover. Fine-pointer
  desktop keeps the existing Trajectory control and actions there.

## Why

Nav is the stable home for mobile navigation commands. Colocating Target and
Trajectory with Time Warp and camera mode removes transient edge affordances,
keeps the center playfield clear, and gives tutorial and accessibility flows a
single predictable surface without changing simulation policy.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns Nav layout, panel state,
  Target popup disclosure, independent Target/Trajectory visibility, stable
  mount hosts, recommendation emphasis, and tutorial focus.
- `src/ui/touchControls/createTouchControls.ts` mounts the existing controls in
  those hosts, routes target/recommendation state, and cancels Trajectory input
  when Nav ownership ends.
- Target selection policy, recommendation logic, body labels, formatter,
  Trajectory limits, previews, and commit actions remain in their existing
  models and runtime policies.
- Scenario presentation decides whether each control is available. Hiding one
  Nav section does not move, hide, or disable the other.
- Settings no longer present or consume side placement. Storage and query
  parsing retain the legacy fields only for the coordinated cleanup in #244.
- `src/ui/components/InGameControlsMenuSurface.tsx` reuses its existing
  fine-pointer navigation-control boundary for both Camera and Trajectory, so
  mobile has one Trajectory entry in Nav while desktop behavior stays intact.

## Decisions

- Reused the existing selector implementations and runtime actions; the dock
  only provides their stable home and does not duplicate control policy.
- Kept the current-target toggle in the right column while its popup overlays
  the wide left column. The button remains reachable for closing the popup and
  Trajectory remains usable in both Target disclosure states.
- Made the Nav body vertically scrollable on compact portrait screens while
  preserving gesture ownership for the embedded horizontal and vertical step
  selectors.
- Kept Nav and the Target popup open after Target commits so
  automatic/manual/forced transitions do not unexpectedly dismiss adjacent
  navigation controls.
- Cancelled Trajectory gestures on close, panel switch, Escape, interaction
  disable, blur, and scenario unavailability. A cancelled drag never commits a
  partially selected horizon.
- Removed only shipped Target/Trajectory edge UI in this issue. Shared legacy
  edge types, query parameters, and persisted fields remain for #244 to delete
  atomically.
- Reused the menu's existing Camera visibility boundary instead of adding a
  second input-mode query or another Trajectory visibility API.

## Validation performed

- Targeted Biome checks passed for all touched source and test files, and
  `git diff --check` passed.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remains.
- Before the final `main` merge, all 64 Vitest files / 627 product tests and
  all 16 automation-claim tests passed. After merging current `main`, the
  expanded product suite passed all 65 files / 649 tests.
- `npm run test:gui` completed one full 84/84 pass during the follow-up. After
  the final responsive-only Camera adjustment, the full rerun passed 83/84:
  every changed Nav/Target/Trajectory check passed, while the unchanged
  timing-sensitive Time Warp fling check sampled transient `x2m` where it
  expects `x1m`. That check also passed once in an isolated rerun during this
  task, confirming a timing variance rather than changed Time Warp behavior.
  Focused final coverage verifies right-column Trajectory placement,
  target-popup disclosure and accessible state, current-target updates,
  compact-width geometry, Target commits without panel dismissal, independent
  availability, dock/canvas input isolation, every required Trajectory
  cancellation boundary, Settings cleanup, tutorial routing, and unchanged
  desktop behavior.
- After merging current `main`, the final full GUI run again passed every
  changed check and finished 83/84. The only failure is current-main's
  precise-yaw assertion: `keyboardInput.ts` now intentionally emits `-0.25`,
  while its unchanged GUI assertion still expects `-1 / 49`. The failure
  reproduces in isolation, and this branch does not change either file.
- The horizontal-overflow and dock-order follow-up passed its focused 2/2
  Playwright checks. At 430px the open Nav panel's `scrollWidth` equals its
  `clientWidth`, and the test verifies vertical-only overflow plus the
  Flight/Nav/Info/Ship/Settings DOM order. The follow-up full GUI run passed
  every changed check and finished 82/84: the unchanged precise-yaw mismatch
  above remained, and the unchanged timing-sensitive Time Warp screenshot
  sampled `x4s` instead of `x4m`, including in an isolated rerun.
- The outside-dismiss follow-up passed focused mouse/touch and popup-persistence
  coverage 2/2. Its full GUI run passed every changed check and finished 84/85;
  the only failure was the unchanged current-main precise-yaw assertion above.
  Release build, 65 Vitest files / 649 tests, 16 claim tests, targeted Biome,
  and diff checks passed.
- The mobile menu follow-up passed targeted Biome and the release build.
  Focused in-game menu, desktop-adapter, and touch-zoom checks passed 3/3.
  The final full GUI run passed 84/85, including every changed and dependent
  test; only the unchanged precise-yaw assertion above failed. A live
  coarse-pointer browser check found one UI settings action and zero Camera,
  Trajectory, or prediction-horizon controls in the open in-game menu.
- Visually inspected the generated 320, 390, and 430 px Nav screenshots plus
  collapsed/open, recommended/manual, forced, capped, and unavailable states.
  The controls remain legible and non-overlapping. The redundant secondary
  `Horizon` heading is removed at all widths; at 320 px Recenter stacks below
  Follow, while at larger widths Camera keeps its compact single row:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-popup-closed.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-popup-open.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-manual-recommended.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-forced.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-trajectory-capped.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-trajectory-unavailable.png`
- Visually inspected the regenerated 390 px in-game Controls screenshot after
  the mobile menu follow-up. It contains the UI settings action without the
  duplicate Trajectory section:
  - `tmp/playwright-results/mobileHudScreenshot-keeps--0165f-f-the-in-game-controls-menu-mobile-chromium/mobile-in-game-controls-menu.png`

## Follow-ups and known gaps

- Issue [#244](https://github.com/chmurson/space-web-game/issues/244) owns final
  deletion of legacy side-placement types, query parsing, persisted fields,
  and now-unused shared edge-reveal infrastructure.
- Mission, Ship, Settings-panel implementation, and notification work remain
  outside issue #276.

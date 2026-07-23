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

## Validation performed

- Targeted Biome checks passed for all touched source and test files, and
  `git diff --check` passed.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remains.
- All 64 Vitest files / 627 product tests and all 16 automation-claim tests
  passed.
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
- Visually inspected the generated 320, 390, and 430 px Nav screenshots plus
  collapsed/open, recommended/manual, forced, capped, and unavailable states.
  The controls remain legible and non-overlapping. At 320 px the redundant
  secondary `Horizon` heading hides and Recenter stacks below Follow; at larger
  widths Camera keeps its compact single row:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-popup-closed.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-popup-open.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-manual-recommended.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-target-forced.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-trajectory-capped.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f40a9--availability-states-in-Nav-mobile-chromium/mobile-nav-trajectory-unavailable.png`

## Follow-ups and known gaps

- Issue [#244](https://github.com/chmurson/space-web-game/issues/244) owns final
  deletion of legacy side-placement types, query parsing, persisted fields,
  and now-unused shared edge-reveal infrastructure.
- Mission, Ship, Settings-panel implementation, and notification work remain
  outside issue #276.

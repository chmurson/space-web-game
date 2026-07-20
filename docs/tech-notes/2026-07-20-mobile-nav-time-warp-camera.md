# Mobile Nav with Time Warp and Camera Mode

Issue: [#239](https://github.com/chmurson/space-web-game/issues/239)

Shipit state: `.codex/shipit-workflows/agent/issue-239-mobile-nav.md`

## What changed

- Enabled Nav as the second working mobile command-dock panel and added direct
  Flight/Nav switching with one panel open at most.
- Promoted the selected horizontal Time Warp interaction to the sole mobile
  Time Warp control, mounted it first in Nav, and removed the original swipe
  control, comparison entry, prototype naming, and both Warp edge reveals.
- Added current-rate and concise policy-owned cap/block feedback next to Time
  Warp for global, scenario, active-control, thrust, turning, and min/max
  constraints.
- Moved the mobile camera-mode command into Nav while retaining the existing
  mode state, action mapping, lock behavior, disabled labels, and feedback.
  Fine-pointer desktop keeps camera mode in the controls menu.
- Removed the Warp-side row and runtime consumption while leaving its legacy
  persisted configuration field harmlessly ignored for issue #244.
- Updated tutorial focus and copy to open Nav and direct the player to drag
  Time Warp left, without referring to an edge tab.
- Kept Target and Trajectory on their existing edge reveals for issue #276.

## Why

The earlier comparison work established the horizontal selector as the chosen
mobile Time Warp interaction. Nav now gives that critical command a stable,
large touch target and colocates the transient camera command without changing
simulation policy, desktop behavior, or the remaining Target/Trajectory
migration boundary.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns Flight/Nav panel state,
  camera-mode presentation, Time Warp status presentation, availability,
  tutorial focus, and stable control mount points.
- `src/ui/touchControls/createTouchControls.ts` mounts the retained Time Warp
  selector in Nav, routes dock gestures, cancels outgoing owned input, and
  leaves Target/Trajectory reveal controls intact.
- `src/ui/touchControls/createTimeWarpControl.ts` configures the selected
  horizontal selector; the shared step-selector model still owns drag,
  constraint, settle, and momentum behavior.
- `src/runtime/timeWarpFeedbackPolicy.ts` remains the source of Time Warp
  constraints and reasons. The Nav view only maps those reasons to concise
  player-facing text.
- `src/ui/createInGameControlsMenu.ts` and its Preact surface keep camera mode
  visible only in the fine-pointer desktop version of the old controls menu.
- App composition and HUD presentation now expose scenario availability for
  Target and Trajectory only; Warp side is no longer consumed.

## Decisions

- Extended the dock only with concrete `flight | nav | null` state; no router,
  registry, panel variant, or URL feature flag was introduced.
- Reused the selected selector and all existing runtime actions, previews,
  formatters, and camera-mode mappings rather than duplicating policy or state
  in the panel.
- Kept Nav available when Time Warp is unavailable because camera mode remains
  useful. Time Warp hides and cancels its active gesture independently.
- Used shared glass surface tokens for the Nav panel and controls, with amber
  reserved for a capped/blocked status.
- Deleted the now-unreachable swipe-feedback implementation and tests instead
  of retaining a second dormant interaction.
- Preserved the legacy Warp-side config/query/storage shape for #244 and the
  shared edge-reveal implementation for #276.

## Validation performed

- Targeted Biome checks passed for all changed source and test files. The only
  reported warnings are three existing `!important` declarations in global
  CSS that this issue does not change.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build; the existing large-chunk advisory remained.
- `npm test` passed: 61 Vitest files / 571 tests, 16 automation-claim tests,
  and 3 automation-workflow tests. This includes every Time Warp status reason
  mapping and the updated tutorial copy.
- `npm run test:gui` passed all 76 Playwright checks. The suite covers
  Flight/Nav switching and cleanup, camera state and locks, Nav touch
  isolation, the retained Time Warp interaction and constraints, desktop
  isolation, and the remaining Target/Trajectory reveals.
- Visually inspected the generated 320, 390, and 430 px Nav screenshots plus
  normal, capped, blocked, and dragging Time Warp states. The panel fits
  without overlap, text remains legible, safe-area spacing is balanced, and
  the retained Target/Trajectory reveals remain clear of the collapsed dock:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-nav-open-safe-area-430.png`
  - `tmp/playwright-results/mobileCommandDock-captures-cd01d-d-Time-Warp-feedback-in-Nav-mobile-chromium/mobile-command-dock-nav-warp-normal-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-cd01d-d-Time-Warp-feedback-in-Nav-mobile-chromium/mobile-command-dock-nav-warp-capped-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-cd01d-d-Time-Warp-feedback-in-Nav-mobile-chromium/mobile-command-dock-nav-warp-blocked-390.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-863ae-le-Time-Warp-control-in-Nav-mobile-chromium/mobile-time-warp-control-dragging.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`

## Follow-ups and known gaps

- Issue [#276](https://github.com/chmurson/space-web-game/issues/276) owns the
  later Target and Trajectory dock migration and their reveal cleanup.
- Issue [#244](https://github.com/chmurson/space-web-game/issues/244) owns final
  deletion of legacy touch-side types, query parsing, and persisted fields.
- Mission, Ship, Settings, notification work, and shared edge-reveal deletion
  remain outside issue #239.

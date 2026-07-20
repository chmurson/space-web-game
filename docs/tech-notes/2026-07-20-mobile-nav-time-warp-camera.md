# Mobile Nav with Time Warp and Camera Mode

Issue: [#239](https://github.com/chmurson/space-web-game/issues/239)

Review follow-up: [PR #278](https://github.com/chmurson/space-web-game/pull/278)

Shipit state: `.codex/shipit-workflows/agent/issue-239-mobile-nav.md`

## What changed

- Enabled Nav as the second working mobile command-dock panel and added direct
  Flight/Nav switching with one panel open at most.
- Promoted the selected horizontal Time Warp interaction to the sole mobile
  Time Warp control, mounted it first in Nav, and removed the original swipe
  control, comparison entry, prototype naming, and both Warp edge reveals.
- Compactified the Time Warp selector from 72px to 54px and removed duplicate
  heading-rate and visible helper/status copy. Policy-owned cap/block feedback
  remains in a visually hidden live region for assistive technology.
- Moved the mobile camera-mode command into Nav while retaining the existing
  mode state, action mapping, lock behavior, and disabled labels. Camera
  buttons now use the dock's tap-safe pointer handler, so prevented synthetic
  clicks no longer make them inert on touch devices. Selected/disabled button
  states replace the duplicate secondary mode copy. Spacecraft and Target
  follow modes now center their tracked object within the viewport remaining
  above the dock and its open panel. Entering Free roam preserves that clipped
  viewport origin instead of jumping to the full-screen center, and swipe
  panning begins with the next move after the unlock threshold. Fine-pointer
  desktop and established Free roam camera behavior remain unchanged.
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
  camera-mode presentation and tap handling, accessibility-only Time Warp
  status presentation, availability, tutorial focus, stable control mount
  points, and reporting the dock's measured viewport obstruction.
- `src/ui/touchControls/createTouchControls.ts` mounts the retained Time Warp
  selector in Nav, routes dock gestures, starts camera panning after the touch
  move that unlocks Free roam, cancels outgoing owned input, and leaves
  Target/Trajectory reveal controls intact.
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
- App composition caches the measured dock obstruction; runtime camera actions
  apply it to follow modes and convert that projection to an equivalent
  world-space Free roam origin during mode transitions.
- `src/render/sceneUpdates.ts` shifts the follow-mode orthographic projection
  without changing zoom or simulation coordinates.

## Decisions

- Extended the dock only with concrete `flight | nav | null` state; no router,
  registry, panel variant, or URL feature flag was introduced.
- Reused the selected selector and all existing runtime actions, previews,
  formatters, and camera-mode mappings rather than duplicating policy or state
  in the panel.
- Used one `ResizeObserver` at the dock boundary so panel/safe-area changes are
  measured only when layout changes, rather than reading DOM geometry from the
  per-frame camera update.
- Converted the asymmetric follow-camera frustum to an equivalent symmetric
  Free roam target using the camera's normalized 3D screen-up direction. The
  inset still remains follow-only; no parallel Free roam viewport state was
  introduced.
- Consumed the touch move that crosses the unlock threshold and seeded the next
  pan from that position, preventing threshold overshoot from becoming an
  unintended transition delta.
- Kept Nav available when Time Warp is unavailable because camera mode remains
  useful. Time Warp hides and cancels its active gesture independently.
- Used shared glass surface tokens for the Nav panel and controls. The selector
  owns visible rate/constraint state; duplicate panel copy is intentionally
  omitted.
- Made `setOpenPanel()` render after no-op requests so availability and
  tutorial-focus state mutations are never stranded behind an already-open
  panel.
- Deleted the now-unreachable swipe-feedback implementation and tests instead
  of retaining a second dormant interaction.
- Preserved the legacy Warp-side config/query/storage shape for #244 and the
  shared edge-reveal implementation for #276.

## Validation performed

- Targeted Biome checks passed for the follow-up source, CSS, test, and design
  files. The repository does not install Stylelint locally, so its exact CLI
  could not run; all four reported `calc()` expressions now use the requested
  operator-at-line-start form with narrow Biome format suppressions.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build; the existing large-chunk advisory remained.
- `npm test` passed: 62 Vitest files / 575 tests, 16 automation-claim tests,
  and 3 automation-workflow tests. This includes projection math and follow-mode
  viewport-inset/free-roam transition coverage alongside every Time Warp status
  reason mapping and the updated tutorial copy.
- `npm run test:gui` passed all 79 Playwright checks. The suite now exercises
  real mobile touch taps across multiple camera options in addition to
  Flight/Nav switching and cleanup, camera state and locks, no-op panel state
  rendering, Nav touch isolation, the retained Time Warp interaction and
  constraints, desktop isolation, the remaining Target/Trajectory reveals, and
  locked-target recentering as the Nav panel opens. Focused gesture coverage
  confirms the unlock-threshold move is consumed and the next move begins pan.
- Visually inspected the generated 320, 390, and 430 px Nav screenshots plus
  normal, capped, blocked, and dragging Time Warp states. The compact panel
  fits without overlap, duplicate secondary/helper copy is absent, camera
  selection remains obvious, text stays legible, and safe-area spacing is
  balanced:
  - `tmp/playwright-results/mobileCommandDock-preserve-c2aad-Nav-when-entering-free-roam-mobile-chromium/mobile-command-dock-locked-target-centered-390.png`
  - `tmp/playwright-results/mobileCommandDock-preserve-c2aad-Nav-when-entering-free-roam-mobile-chromium/mobile-command-dock-free-roam-transition-390.png`
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

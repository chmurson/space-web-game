# Mobile Command Dock and Flight Panel

Issue: [#264](https://github.com/chmurson/space-web-game/issues/264)

Shipit state: `.codex/shipit-workflows/agent/issue-264-mobile-command-dock.md`

## What changed

- Added a coarse-pointer-only mobile command dock with Flight, Nav, Mission,
  Ship, and Settings.
- Kept Flight as the only enabled item. It toggles a non-modal example glass
  panel and supports Escape-to-close with focus restoration.
- Kept the other four items visibly disabled until their panels have real
  content and ownership.
- Shipped the reviewed compact dimensions, subtle selected state, and standard
  safe-area spacing as the only runtime treatment.
- Removed the temporary URL comparison selectors and their alternate
  spacious, strong-emphasis, roomy-spacing, and Flight-sheet states.
- Retained the component-local sheet layout rules and panel-treatment state as
  dormant support for a future enabled panel, potentially Nav.
- Added safe-area-aware HUD, menu, and edge-control clearance around the
  collapsed and open dock.

## Why

The comparison phase established the dock geometry and panel direction. The
final product decision makes the full five-item dock part of normal mobile
gameplay while avoiding empty interactive tabs: only Flight is enabled, and its
example content uses the selected glass panel. Removing the review selectors
prevents prototype combinations from becoming accidental public configuration.

Sheet remains a valid future panel treatment, but enabling it now would either
contradict the selected Flight glass treatment or require a placeholder Nav
panel. Keeping only its local styling/state hook preserves that option without
adding routing or unfinished interaction.

## Ownership boundaries

- `src/ui/touchControls/mobileCommandDock.tsx` owns the fixed item set, Flight
  panel state, accessibility, Escape handling, focus restoration, and active
  panel-treatment state.
- `src/ui/touchControls/mobileCommandDock.css` owns compact dock geometry,
  subtle selection, glass presentation, dormant sheet layout, safe areas,
  non-modal hit testing, and HUD collision offsets.
- `src/ui/touchControls/createTouchControls.ts` mounts the dock and excludes
  dock-owned touches from camera and heading-plan gesture startup.
- `tests/gui/mobileCommandDock.spec.ts` owns focused browser behavior,
  shipped-state layout checks, and screenshot artifacts.
- `docs/gui-screenshot-tests.md` documents the repeatable shipped-state GUI
  review flow.

## Decisions

- The dock remains visible only for coarse/no-hover input, preserving the
  fine-pointer desktop HUD.
- The full item set is always rendered. Disabled future items do not mount
  panels, route actions, or change feature ownership.
- Flight always renders the example glass panel. The sheet rules are dormant
  implementation support, not a user-selectable Flight variant.
- The panel has no backdrop, and only dock-owned surfaces capture pointers.
  Touches elsewhere continue to reach the game playfield.
- RCS, Burn, and other existing mobile controls remain on their edge-reveal
  surfaces; issue #238 owns later Flight-panel integration.
- The dock continues to reuse `addTapSafeButtonHandler` for touch activation
  and compatibility-click suppression.

## Validation

- Targeted Biome checks passed for the changed TypeScript component and GUI
  test.
- `npm run build` passed, including config validation, TypeScript compilation,
  and the release Vite build. The existing large-chunk advisory remained.
- `npm test` passed: 62 Vitest files / 552 tests, 16 automation-claim tests,
  and 3 automation-workflow tests.
- The focused command-dock Playwright suite passed all 6 checks. It verifies
  Flight toggle/Escape behavior, camera and heading-plan touch exclusion,
  five-item availability, HUD/menu clearance, portrait layout, safe areas, and
  desktop isolation.
- `npm run test:gui` passed all 69 Playwright checks on the final executable
  code, including the focused dock coverage and all existing mobile HUD,
  touch-control, zoom-suppression, and turn-planning regressions.
- Visually inspected the final generated artifacts; all five items fit at
  320px, the subtle Flight selection and glass panel are clear, and the 390px
  and 430px open states clear the safe area and edge-control stacks:
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-collapsed-320.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-glass-open-safe-area-390.png`
  - `tmp/playwright-results/mobileCommandDock-captures-f1837-trait-widths-and-safe-areas-mobile-chromium/mobile-command-dock-flight-glass-open-safe-area-430.png`
- A repository-wide Biome check is not currently a clean project gate: it
  reports existing unrelated import/format issues, plus operator placement in
  the dock CSS where Biome conflicts with the Stylelint form already requested
  and resolved on this PR. No unrelated files were rewritten.

## Follow-ups and known gaps

- Issue #238 owns mounting RCS yaw and Main Thrust into the Flight panel.
- A future Nav implementation may use the retained sheet treatment when it has
  real content and interaction ownership.
- Mission, Ship, and Settings remain disabled until their owning work enables
  complete panels.

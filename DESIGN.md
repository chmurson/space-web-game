---
version: alpha
name: Space Web Game
description: Current shipped visual guidance for the Three.js game surface, HUD, menus, prompts, overlays, and touch controls.
colors:
  primary: "#05070D"
  secondary: "#0F172A"
  tertiary: "#38BDF8"
  neutral: "#F4F7FB"
  surface-canvas: "#05070D"
  surface-control: "rgba(8, 13, 24, 0.56)"
  surface-panel: "rgba(8, 13, 24, 0.72)"
  surface-label: "rgba(8, 13, 24, 0.58)"
  text-primary: "#F4F7FB"
  text-panel: "#F0F9FF"
  text-muted: "rgba(226, 232, 240, 0.72)"
  text-subtle: "rgba(203, 213, 225, 0.68)"
  accent-cyan: "#38BDF8"
  accent-sky: "#7DD3FC"
  action-primary: "#0E7490"
  accent-amber: "#F59E0B"
  accent-danger: "#FB7185"
  accent-success: "#22C55E"
typography:
  display:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 52px
    fontWeight: 700
    lineHeight: 0.95
  heading:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 13px
    fontWeight: 650
    lineHeight: 1.2
  telemetry:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
  label-caps:
    fontFamily: "Segoe UI, Avenir Next, Helvetica Neue, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 10px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: 0.12em
  debug:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 14px
  panel: 16px
  touch-control: 15px
  full: 9999px
spacing:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  panel: 18px
  touch-target-min: 42px
  touch-edge-start: 96px
components:
  canvas:
    backgroundColor: "{colors.surface-canvas}"
    textColor: "{colors.neutral}"
    typography: "{typography.body}"
  glass-control:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text-panel}"
    typography: "{typography.control}"
    rounded: "{rounded.lg}"
    padding: "5px 8px"
  glass-panel:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-panel}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "10px"
  glass-label:
    backgroundColor: "{colors.surface-label}"
    textColor: "{colors.text-muted}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.xs}"
    padding: "2px 5px"
  telemetry-pill:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text-panel}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.full}"
    padding: "5px 8px"
  menu-action-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-panel}"
    typography: "{typography.control}"
    rounded: "{rounded.panel}"
    padding: "15px 18px"
  menu-action-secondary:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-panel}"
    typography: "{typography.control}"
    rounded: "{rounded.panel}"
    padding: "15px 18px"
  menu-action-disabled:
    opacity: 0.5
  menu-panel:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-panel}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "18px"
  scenario-coach-prompt:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-panel}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.xl}"
    padding: "11px 14px"
  touch-edge-tab:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.lg}"
    size: "34px 84px"
  touch-selector:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-subtle}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.touch-control}"
    width: 70px
  debug-panel:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.accent-sky}"
    typography: "{typography.debug}"
    rounded: "{rounded.sm}"
    padding: "8px"
  target-indicator:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "{colors.primary}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.full}"
    padding: "3px 6px"
  warning-indicator:
    backgroundColor: "{colors.accent-amber}"
    textColor: "{colors.primary}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.full}"
    padding: "3px 6px"
  danger-indicator:
    backgroundColor: "{colors.accent-danger}"
    textColor: "{colors.primary}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.full}"
    padding: "3px 6px"
  success-indicator:
    backgroundColor: "{colors.accent-success}"
    textColor: "{colors.primary}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.full}"
    padding: "3px 6px"
---

# Space Web Game Design

## Overview

Space Web Game is a playable space-simulation surface first and a menu system second. The visual design keeps the WebGL canvas dominant: deep black-blue space, bright orbital cues, compact telemetry, and dark translucent HUD controls that sit over the playfield without hiding it.

The current shipped UI is utilitarian and game-like, not a marketing site. It should feel precise, quiet, and readable while the player is steering, selecting targets, changing time warp, or reading scenario coaching. Use short action copy, direct labels, and explicit mission language.

## Colors

The palette is dark space plus sparse high-energy accents.

- **Primary (`#05070D`):** Canvas and page background. Keep it nearly black so bodies, trajectories, labels, and HUD glass remain legible.
- **Secondary (`#0F172A`):** Slate interior layers for rows, buttons, and inactive controls.
- **Tertiary (`#38BDF8`):** Cyan flight-system accent for target, trajectory, menu focus, and positive active states.
- **Neutral (`#F4F7FB`):** Main text on dark surfaces.
- **Amber (`#F59E0B`):** Thrust, prediction-step, constraint, warning, and tutorial focus accents.
- **Danger (`#FB7185`):** Crash, depleted fuel, and destructive confirmation states.
- **Success (`#22C55E`):** Touch tutorial hints and positive affordance highlights.

Prefer the shared glass variables in `src/style.css` for HUD, menu, overlay, drawer, dialog, touch-control, label, and popup surfaces:

- `--ui-glass-control-bg`, `--ui-glass-control-border`, `--ui-glass-control-blur`
- `--ui-glass-panel-bg`, `--ui-glass-panel-border`, `--ui-glass-panel-blur`, `--ui-glass-panel-shadow`
- `--ui-glass-label-bg`, `--ui-glass-row-bg`

Use local colors only when they communicate a component-specific state such as thrust, blocked time warp, danger, tutorial focus, or a mission prompt accent.

## Typography

Use the system sans-serif stack already defined on `html, body, #app`. Text should be compact and scannable over motion.

- **Display:** Main-menu and crash-menu headings use large, tight type, capped around `52px` and `38px` respectively in the current CSS.
- **Menu and dialog titles:** Use `18px` to `20px`, high contrast, and short phrases.
- **Body copy:** Use `14px` with 1.4 to 1.5 line height for scenario and menu descriptions.
- **Controls and HUD rows:** Use `12px` to `13px`; prefer tabular or compact numeric presentation for telemetry and debug values.
- **Caps labels:** Use small uppercase labels around `10px` to `11px` with positive letter spacing. Never use negative letter spacing.
- **Debug surfaces:** Use the monospace stack and keep dense JSON/state output selectable.

Copy should be direct: `Start`, `Restart`, `Exit`, `UI settings`, `Prediction horizon`, `Camera locked`. Prompts can be more instructive, but should still state one action at a time.

## Layout

The playable canvas owns the full viewport. DOM UI layers sit above it with fixed positioning, safe-area-aware offsets, and narrow max widths.

- Keep the top bar fixed to the top safe area. It contains the top menu and telemetry strip.
- Keep bottom notices and replay pills centered in `.bottom-pill-area`, above the bottom safe area and touch controls.
- Keep the in-game controls menu near the lower left by default, using the bottom and left safe-area variables in `src/ui/overlayUI/overlayUIStyles.css`.
- Mobile navigation uses the bottom command dock for Flight and Nav. Target and Trajectory retain edge-reveal tabs until their planned dock migration; all mobile controls must preserve the center playfield.
- The mobile command dock sits above the bottom safe area and reserves space for bottom HUD notices. Its open Flight or Nav panel stays non-modal, with pointer handling limited to dock-owned controls while the surrounding touch playfield remains interactive.
- Modal prompts can center on desktop and dock toward the bottom on mobile.
- Coach prompts can float near their anchor; when coaching playfield controls on mobile, dock near the bottom above controls.
- Do not let labels, buttons, or prompt text overlap telemetry, touch controls, or each other. Use max widths, ellipsis, wrapping, and safe-area padding before adding new layers.

Z-index ownership lives in `src/style.css`:

- `--z-in-game-elements` and `--z-in-game-floating-elements` for labels, callouts, and indicators.
- `--z-overlay-floating` and `--z-overlay-hud` for touch controls, top HUD, menus, and notices.
- `--z-overlay-debug` for debug-only surfaces.
- `--z-overlay-modal`, `--z-overlay-modal-menu`, and `--z-overlay-dialog` for prompts, menus, and dialogs.
- Tutorial focus layers use the dedicated `--z-tutorial-*` tokens.

## Elevation & Depth

Depth comes from translucent glass, blur, thin borders, and restrained glow. Avoid opaque cards that fight the space scene.

- Use `backdrop-filter` blur on glass controls and panels where supported.
- Use panel shadow tokens for popovers, dialogs, and docked controls.
- Use glow sparingly for active thrust, target recommendation, tutorial focus, and offscreen/trajectory cues.
- For debug surfaces, prioritize legibility and density over decorative depth.
- Respect `prefers-reduced-motion: reduce`; transitions and looping animations should disable or simplify.

## Shapes

The current shape language is compact glass UI with rounded controls:

- Pills use `rounded.full` for telemetry, notices, labels, and compact action chips.
- Small in-world labels and offscreen indicator labels use `4px`.
- Scenario modal prompts use `8px`; coach prompts and many popovers use `14px`.
- Menu and crash/dialog panels use `14px` to `16px`.
- Touch-control panels use `rounded.touch-control` (`15px`), which matches `--touch-control-radius` in `src/style.css`.
- Edge tabs are rounded only on the exposed side.

Keep shapes stable across hover, active, disabled, and focused states. Hover or focus should not resize the component.

## Components

**Menus and dialogs:** Build main menu, crash menu, top menu, in-game controls, and settings dialog from the existing Preact surfaces under `src/ui/components/` where possible. Use `MenuSurfacePrimitives.tsx` for menu panels, copy, action groups, and buttons.

**Buttons and controls:** Use real buttons with `type="button"`, visible `:focus-visible` outlines, clear labels, and `touch-action: manipulation` where appropriate. Primary menu actions use cyan glass gradients. Secondary main-menu actions use the neutral dark-glass treatment with full text contrast so they remain visibly available. Disabled menu actions dim the full control regardless of variant. Danger actions use rose/dark red treatment. Steppers and switches should keep stable dimensions.

**HUD and telemetry:** Keep telemetry compact, mostly non-interactive, and readable while the canvas moves. Use icons or short labels before long text. Use ellipsis or visually hidden target text on small screens rather than widening the top bar.

**Scenario prompts:** Modal prompts explain mission starts, restarts, and blocking states. Coach prompts are compact, anchored, and non-blocking except for explicit tutorial focus flows. Use emphasis spans for concepts, numbers, and constraints instead of adding new color systems.

**Touch controls:** Preserve edge-reveal behavior, safe-area offsets, large hit areas, and tutorial focus affordances. Touch-control panels should use shared glass panel values with local accent colors for thrust, time warp, target, and trajectory semantics.

**Mobile command dock:** Mobile touch gameplay uses the compact five-item dock with standard safe-area spacing and subtle selected-state emphasis. Flight and Nav are enabled; Mission, Ship, and Settings remain visible but disabled until their panels have real content. At most one panel is open, selecting the active item collapses it, and selecting the other switches directly. Flight keeps its non-modal, label-free floating layout with analog RCS yaw toward the left safe-area edge and Main Thrust toward the right. Nav uses one concrete glass panel: Time Warp is first and visually dominant, with a compact full-width horizontal selector where left is faster and right is slower. The selector itself communicates the current rate; duplicate heading values and visible helper/status copy are omitted, while policy feedback remains available to assistive technology. Camera controls follow Time Warp in Nav on mobile, while fine-pointer desktop keeps them in the shared in-game Controls popover: `Follow` chooses `Spacecraft` or `Target`, and the compact `Recenter` action clears the player's pan offset. Changing Follow also recenters. Neutral framing always centers the followed object within the current playable viewport above the dock and its open panel; drag and edge pan add a relative offset without introducing a player-visible lock mode. Closing, switching, interaction disable, blur, or control unavailability clears the outgoing owned gesture. Tutorial burn focus opens Flight; tutorial warp focus opens Nav. Warp no longer has edge-reveal tabs or a presented side preference. Target and Trajectory retain their edge-reveal surfaces until their planned migration.

**Target and offscreen indicators:** Keep labels small, wrapped on mobile, and attached to the playfield. Use cyan as the default navigational cue and avoid pointer-event capture.

**Debug surfaces:** Keep debug panel and FPS meter visually secondary, monospace, and behind production UI priority. Debug UI may be denser than player-facing UI.

**Screenshot verification:** Use `npm run test:gui` for HUD, menu, overlay, touch-control, or responsive UI changes when relevant. Inspect generated PNGs under `tmp/playwright-results/` because the repo intentionally does not commit screenshot baselines.

## Do's and Don'ts

Do:

- Read this file before UI, HUD, menu, dialog, overlay, touch-control, responsive-layout, visual-style, or copy-tone work.
- Reuse shared CSS variables before adding local dark glass values.
- Keep the WebGL canvas visible and dominant.
- Use safe-area-aware positioning on mobile.
- Keep controls large enough for touch and stable under state changes.
- Add or update GUI screenshot coverage when a new visual state becomes design-critical.
- Update this file in the same change when a UI decision intentionally changes.

Don't:

- Add marketing-page composition, oversized explanatory text, or decorative cards to the playable surface.
- Add a new color palette for a one-off state when cyan, amber, rose, green, or neutral glass already communicates it.
- Put controls where they block steering, thrust, target selection, or scenario prompts.
- Hide keyboard focus, remove accessible names, or make pointer-only controls.
- Add new z-index numbers directly when a root token covers the layer.
- Add a local design or lint CLI dependency until the design tooling is stable enough for this repo.

## Audit Note

Checked for issue #83:

- `src/style.css`: root z-index scale, shared glass variables, global font stack, menus, dialogs, telemetry, debug surfaces, in-world labels, offscreen indicators, reduced-motion rules.
- `src/ui/components/*Surface*.tsx` and `src/ui/components/MenuSurfacePrimitives.tsx`: Preact menu/dialog component contracts, copy, action variants, ARIA roles, segmented controls, switches, steppers.
- `src/ui/overlayUI/overlayUIStyles.css`: top HUD, bottom pill area, in-game controls menu, notices, responsive layout, safe-area variables.
- `src/ui/scenario-prompts/scenario-prompts.css`: modal prompts, coach prompts, focus prompt layers, action buttons, mobile prompt layout.
- `src/ui/touchControls/*.css` and `src/ui/touchControls/*/*.css`: edge reveal, thrust, time warp feedback, step selectors, target selectors, safe areas, touch sizing, tutorial focus, reduced-motion handling.
- `docs/gui-screenshot-tests.md` and `tests/gui/mobileHudScreenshot.spec.ts`: mobile GUI screenshot workflow and currently covered states.

Mismatch and follow-up:

- Several glass-like prompt and feedback surfaces still use local hard-coded base glass colors, borders, blur, or shadows where shared variables may be enough. This is non-trivial because changing it affects shipped screenshots, so it is tracked separately in [#86](https://github.com/chmurson/space-web-game/issues/86).

No executable behavior changed in this audit.

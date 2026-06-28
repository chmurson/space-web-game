# Preact UI Boundary Audit

Issue: https://github.com/chmurson/space-web-game/issues/81
Branch: `codex/issue-81-preact-boundary-audit`

## What Changed

- Audited remaining `document.createElement`, `innerHTML`, direct `querySelector`, and per-frame DOM mutation usage in UI and presentation code after the scheduled Preact migration slices landed.
- Documented the final Preact UI boundary so the DOM UI migration can be considered complete without forcing world-space, render-loop, or developer tooling into Preact.
- Found no still-actionable migration work that needs a new focused GitHub issue.

## Why

The Preact migration now covers the stable, text-heavy, user-facing UI surfaces. The remaining imperative DOM paths are either adapter glue for Preact-rendered roots, screen-space presentation coupled to the camera/render loop, short-lived effects, or debug/developer tooling. Migrating those paths into broad reactive UI state would add more ownership complexity than it removes.

## Audit Commands

- `rg -n "document\\.createElement|document\\.createElementNS|\\.innerHTML\\b|querySelector(All)?\\(" src`
- `rg -n "querySelector(All)?(<[^>]+>)?\\(" src`
- `rg -n "document\\.querySelector(All)?(<[^>]+>)?\\(" src`
- `rg -n "requestAnimationFrame|frame|tick|update.*Element|style\\.(transform|left|top|display|opacity|width|height)|textContent|classList\\.|appendChild|replaceChildren|prepend|removeChild" src/ui src/presentation src/scene src/rendering src/runtime`

## Preact-Owned Boundary

These surfaces are now the Preact-owned DOM UI boundary:

- Menu and dialog surfaces: main menu, crash menu, top menu, in-game controls menu, and UI settings dialog.
- Scenario surfaces: loading overlay, scenario prompt, replay pill, and the prompt/replay adapter render callbacks.
- HUD shells: bottom HUD notices, top telemetry shell, and the isolated FPS indicator surface.
- Touch-control markup slices: touch shell/docks, edge reveal shell, target selector rows, shared step selector value stack, thrust-control static markup, fallback time-warp feedback content, tutorial hint, and trajectory/time-warp controls that compose the shared selector.

The local Preact adapter pattern remains deliberately small: `createPreactUiSurface` creates a host, renders a component, and returns the rendered root through a typed ref. Per-surface factories keep their existing public APIs instead of introducing an app-wide Preact root, UI store, menu DSL, modal framework, or generic touch-control framework.

## Intentional Imperative Surfaces

### Preact Adapter Glue

`createPreactUiSurface`, migrated menu/dialog factories, scenario prompt creation, bottom HUD notices, and touch-control view factories still create host elements or query Preact-rendered children to recover stable DOM refs. This is the bridge between typed markup and the existing app/runtime contracts, not remaining migration debt.

### World-Space And Camera-Coupled Presentation

`createOverlayUi`, `bodyPresentation.ts`, and `spacecraftPresentation.ts` still own body labels, offscreen indicators, the spacecraft callout, thrust icon, heading target dot, heading target line, and heading turn slice. These elements are projected from simulation/world coordinates, measured against current viewport blockers, and mutated every frame through exact style/attribute updates.

Keeping them imperative preserves the render-loop boundary:

- body labels and offscreen indicators need per-frame projection, viewport clamping, overlap checks, and collision avoidance against live HUD rectangles;
- spacecraft callout and heading target visuals need per-frame position, heading, SVG line, SVG path, and visibility updates;
- direct `document.querySelector` calls in this area are measurement lookups for current HUD blockers, not ownership of those HUD surfaces.

### High-Frequency HUD Values

The telemetry strip and FPS shell are Preact-rendered, but `hudPresentation.ts` still owns high-frequency value writes, visibility toggles, animation classes, target/fuel state, and the FPS update throttle. Updating existing refs is the intended boundary for per-frame telemetry and avoids pushing render-loop state through a broad Preact store.

### Scenario Prompt Positioning

Scenario prompt and replay markup are Preact-owned. The prompt updater intentionally remains imperative for identity throttling, Floating UI positioning, arrow placement, trajectory-guide measurement, HUD/control focus classes, and resize/mutation observers. Those responsibilities depend on current layout measurements rather than component markup ownership.

### Touch Gesture Roots

Touch-control static markup has moved to Preact where it is valuable, while gesture controllers still mutate stable roots with classes, CSS custom properties, `left`/`top`, `display`, and visibility state. This applies to the thrust control, shared step selector root, reveal-control state, and fallback swipe time-warp feedback root. The root elements are the gesture/measurement boundary; their child markup is the Preact boundary.

### Short-Lived Effects

`overlayUpdates.ts` still creates and updates map ripples imperatively. A ripple is a transient, world-position-aware effect with a one-second lifetime and per-frame opacity/scale/position updates. Its remaining constant `innerHTML` is not a user-content trust boundary and does not justify a Preact surface by itself.

### Developer Debug UI

`debugPanel.ts` remains an imperative developer/debug tool. It builds fold buttons and syntax-highlight tokens for a throttled JSON/tree view, handles clipboard buttons, and is only visible in debug mode. It should stay outside the Preact migration unless it becomes a shipped user-facing surface or gains enough repeated UI structure to justify a focused component migration.

### Bootstrap Lookups

`main.ts` and `createGameApp.ts` still use direct document lookups for the app root, boot label, and boot screen. Those are startup/bootstrapping concerns and are outside the Preact DOM UI migration boundary.

## Classification Summary

- Migrated to Preact already: menus, dialogs, scenario prompt/replay/loading, bottom HUD notices, telemetry/FPS shells, and scheduled touch-control surfaces from issues #76-#80 and #92-#99.
- Should still be migrated in a new focused issue: none found.
- Intentionally imperative render-loop/world-space/measurement-driven surfaces: body labels, offscreen indicators, spacecraft callout, spacecraft thrust icon, heading target dot/line/turn slice, telemetry value writes, scenario prompt positioning, touch gesture roots, and map ripples.
- Intentionally developer/debug tooling for now: debug panel JSON/tree UI and debug window controls.

## Validation

This branch changes documentation only. No executable app code, runtime behavior, shipped asset, UI style, or user-visible site output changed, so `npm test`, `npm run build`, `npm run test:gui`, and Netlify deploy are not required by the repo guidance for this change.

Validation performed:

- Source inventory commands listed above.
- Manual classification against the current `origin/main` code and recent migration tech notes.
- `git diff --check` passed.
- `coderabbit --base main --agent` completed with three findings in touch-control files that are outside this branch's `origin/main` diff. They were not fixed here because issue #81 is a documentation-only boundary audit and the findings do not describe remaining Preact migration work.

## Follow-Ups

No follow-up GitHub issues were opened because the audit found no still-actionable Preact migration work. Future work should open a focused issue only if one of the intentional imperative surfaces becomes text-heavy, low-frequency, user-facing UI or if a concrete bug shows that its current render-loop/measurement boundary is the wrong owner.

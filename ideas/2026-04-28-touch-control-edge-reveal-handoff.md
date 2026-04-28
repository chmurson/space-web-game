# Touch control edge reveal handoff

## Context

The current mobile touch controls are usable, but visibility is inconsistent:

- time warp is visible most of the time
- thrust appears conditionally from its own hold/drag interaction

This note describes a conservative experiment where both controls can be hidden behind reusable edge "bookmark" tabs. The goal is to make hidden touch controls scalable for future controls without rewriting the time-warp or thrust interaction internals first.

## Current code shape

Relevant files:

- `src/ui/touchControls/createTouchControls.ts`
- `src/ui/touchControls/timeWarpControlTypes.ts`
- `src/ui/touchControls/selectorTimeWarpControl/createSelectorTimeWarpControl.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControl.css`
- `src/ui/touchControls/thrustControl.ts`
- `src/ui/touchControls/thrustControl.css`
- `src/ui/touchControls/touchControls.css`
- `src/presentation/hudPresentation.ts`

Important current behavior:

- `createTouchControls` owns the full-screen touch panel and routes touch sessions.
- Time warp is created via `createConfiguredTimeWarpControl(...)`.
- The selector time-warp control exposes `setVisible(visible)`.
- Thrust owns its own visibility through the `TouchInteractionModel`; there is no external `setVisible` API yet.
- HUD currently calls `touchControls.setTimeWarpControlVisible(showTimePill)` based on scenario-hidden UI.

## Goal

Add a reusable edge-reveal wrapper that can hide/show touch controls from small tabs glued to screen edges.

The first implementation should be conservative:

- swiping inward from a tab reveals the related control
- after reveal, the user operates the control normally
- do not try to hand off the same swipe into the real control gesture yet

Follow-up implementation:

- allow faster one-gesture interactions, such as swipe-to-arm thrust or reveal-then-immediately-drive time warp

## Design

Create a reusable helper, likely under:

`src/ui/touchControls/edgeRevealControl.ts`

Suggested API:

```ts
export type TouchControlRevealEdge = 'left' | 'right'

export type TouchControlRevealPlacement = {
  edge: TouchControlRevealEdge
  priority: number
}

export type EdgeRevealControlOptions = {
  className?: string
  content: HTMLElement
  icon?: string
  id: string
  label: string
  placement: TouchControlRevealPlacement
  revealThresholdPx?: number
}

export type EdgeRevealControl = {
  element: HTMLElement
  close(): void
  isOpen(): boolean
  setAvailable(available: boolean): void
  setOpen(open: boolean): void
  syncPlacement(indexOnEdge: number): void
}
```

The helper should render:

- a root wrapper
- a tab button
- a content container holding the original control element

The wrapper should only own generic reveal concerns:

- tab styling
- edge positioning
- open/closed state
- swipe inward detection
- optional tap-to-toggle fallback
- safe-area-aware placement

It should not know what "time warp" or "thrust" means.

## Configurable placement

Keep placement hardcoded at first, but in one obvious place so it is easy to change.

Suggested config in `createTouchControls.ts`:

```ts
const touchControlRevealLayout = {
  gapPx: 12,
  startOffsetPx: 96,
  controls: {
    timeWarp: {
      edge: 'left',
      priority: 10,
    },
    thrust: {
      edge: 'right',
      priority: 10,
    },
  },
} as const
```

Rules:

- `edge` controls whether the bookmark is glued to the left or right screen edge.
- `priority` controls vertical order on the same edge.
- Smaller priority appears closer to the top.
- Controls on the same edge have a fixed gap between tabs.
- The exact offsets can be CSS variables written by `syncPlacement(...)`.
- The initial version only needs left/right edges. Top/bottom can be added later if needed.

Suggested positioning logic:

```ts
const controlsByEdge = new Map<TouchControlRevealEdge, EdgeRevealControl[]>()

for (const revealControl of revealControls) {
  controlsByEdge.get(revealControl.placement.edge)?.push(revealControl)
}

for (const controls of controlsByEdge.values()) {
  controls
    .sort((a, b) => a.placement.priority - b.placement.priority)
    .forEach((control, index) => control.syncPlacement(index))
}
```

Use a simpler version if the final object shape differs.

## Conservative implementation plan

### 1. Build the generic wrapper

Touch:

- `src/ui/touchControls/edgeRevealControl.ts`
- `src/ui/touchControls/touchControls.css`

Implement:

- root markup for `.touch-edge-reveal-control`
- `.touch-edge-reveal-tab`
- `.touch-edge-reveal-content`
- classes for left/right edge
- classes for open/closed
- CSS variables for edge index, start offset, gap, and reveal direction
- touch gesture on the tab:
  - record start point
  - reveal when the user swipes inward past threshold, for example `36px`
  - ignore outward movement
  - prevent default while the tab gesture is active
- click/tap toggle as an accessibility fallback

Do not route global game gestures through this helper. Let it own only its tab.

### 2. Adapt time warp first

Touch:

- `src/ui/touchControls/selectorTimeWarpControl/createSelectorTimeWarpControl.ts`
- `src/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControl.css`
- `src/ui/touchControls/createTouchControls.ts`

Change time warp so its element can be placed inside a reveal content container instead of fixed directly to the viewport.

Suggested low-risk path:

- Extend `TimeWarpControlOptions` with an optional `container?: HTMLElement`.
- Append `view.element` to `options.container ?? options.panel`.
- Keep the existing `panel` option for measuring/global ownership.
- Add a CSS modifier or parent selector so `.touch-time-warp-selector` can be `position: relative` when inside `.touch-edge-reveal-content`.

Keep `setVisible(visible)` behavior for scenario-hidden UI. In the reveal world this should mean "available/unavailable", not "currently open/closed".

### 3. Adapt thrust conservatively

Touch:

- `src/ui/touchControls/thrustControl.ts`
- `src/ui/touchControls/thrustControl.css`
- `src/ui/touchControls/createTouchControls.ts`

This needs a small API addition.

Suggested first API:

```ts
setAvailable(available: boolean): void
setDockedContainer(container: HTMLElement): void
```

Simpler alternative:

```ts
container?: HTMLElement
```

For the conservative version, use a docked thrust control in the reveal panel:

- render the existing thrust slider inside the reveal content container
- add a CSS mode where `.touch-thrust-control` is `position: relative`, visible when the wrapper is open, and does not rely on `left/top`
- keep the existing bottom-right hold/spawn behavior disabled or bypassed while using edge reveal mode
- preserve the internal thrust drag logic as much as possible

If adapting the current floating thrust control becomes too invasive, build a thin docked thrust view that calls the same `TouchInteractionModel` methods. Do not broaden public runtime APIs just for this.

### 4. Wire layout in `createTouchControls`

Touch:

- `src/ui/touchControls/createTouchControls.ts`

Add the hardcoded placement config near the top of the file.

Expected initial layout:

- time warp tab on left edge
- thrust tab on right edge
- both around lower/mid screen, not near browser/system gesture zones
- if both are moved to the same edge via config, priority and gap should stack them predictably

Keep pinch zoom and double-tap heading selection working.

Global gesture routing should respect closed controls:

- closed time-warp reveal should not start a left-zone time-warp gesture from random screen touches
- closed thrust reveal should not start a bottom-right hold-spawn gesture if using docked reveal mode
- tab gestures should not become target-heading taps

### 5. Scenario-hidden UI integration

Keep the existing scenario-hidden UI behavior:

- if time warp is hidden by scenario directives, hide/disable the time-warp tab and force-close the panel
- if thrust is hidden by scenario directives in the future, use the same pattern

If no existing directive controls thrust touch control visibility, do not invent scenario policy in this pass. Just keep the hook/API ready.

## Follow-up update after conservative version

After the conservative reveal behavior is stable, experiment with faster interactions.

### Time warp follow-up

Possible upgrade:

- swipe inward from the time-warp tab opens the control
- if the user continues into a vertical drag, hand off to `timeWarpControl.beginGesture(...)`

Risk:

- current time warp gesture uses vertical `deltaY` from the gesture start point
- reveal is horizontal/inward
- handoff needs a clear new start point or it will feel jumpy

Recommendation:

- only begin the time-warp gesture after reveal completes
- reset the time-warp gesture start coordinates to the touch point at reveal completion

### Thrust follow-up

Possible upgrade:

- swipe inward from the thrust tab opens and arms thrust in one gesture
- continuing upward snaps thrust on

Risk:

- current thrust has hold-delay and pending visibility assumptions
- bypassing hold needs a deliberate API such as `beginDockedGesture(...)` or `beginImmediateGesture(...)`

Recommendation:

- add an explicit thrust method for the docked mode instead of overloading the existing bottom-right hold-spawn path

## Styling guidance

Visual direction:

- tab should feel like a small notepad/bookmark attached to the edge
- use vertical label text or compact icon; horizontal text will not fit
- tab must remain legible over the game scene
- content should feel like the current controls, not a totally new UI language

Suggested classes:

```css
.touch-edge-reveal-control {}
.touch-edge-reveal-control-left {}
.touch-edge-reveal-control-right {}
.touch-edge-reveal-control-open {}
.touch-edge-reveal-tab {}
.touch-edge-reveal-content {}
```

Use CSS variables:

```css
--touch-edge-reveal-index
--touch-edge-reveal-gap
--touch-edge-reveal-start
--touch-edge-reveal-tab-width
```

Respect:

- `env(safe-area-inset-left)`
- `env(safe-area-inset-right)`
- `env(safe-area-inset-bottom)` if tabs sit low
- `prefers-reduced-motion`

## Tests and verification

Run after implementation because this affects executable UI behavior:

- `npm test`
- `npm run build`

Manual mobile checks:

- time-warp tab appears on configured edge
- thrust tab appears on configured edge
- changing edge config moves each tab without code edits elsewhere
- same-edge controls stack by priority with a visible gap
- swiping inward from time-warp tab reveals time warp
- swiping inward from thrust tab reveals thrust
- closed controls do not react to random gameplay-area drags
- double-tap target heading still works outside tabs/controls
- pinch zoom still works outside active tab/control gestures
- scenario-hidden time warp hides the tab and content

Deploy:

- This is a non-`main` branch, so deploy to shared staging with `npm run deploy:netlify` before handing back after implementation.
- Share the staging URL after deploy.

## Guardrails

- Do not rewrite physics, runtime state, or autopilot for this.
- Do not remove pinch zoom or double-tap heading selection.
- Do not widen module APIs only to make tests easier.
- Keep the reveal helper generic and reusable.
- Keep placement configurable from one small config object.
- Preserve existing visual style unless the reveal-specific tab needs new styling.

## Status

Ready for implementation.

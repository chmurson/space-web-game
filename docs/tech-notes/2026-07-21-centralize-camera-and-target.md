# Centralize camera Follow, pan, and recenter

## What changed

- The camera now has one player-facing choice: `Follow` (`Spacecraft` or the
  active `Target`). A relative pan offset lets drag, edge pan, and focal zoom
  move away from that subject without changing what is followed.
- Added an explicit `Recenter` action to the shared in-game Controls popover.
  Recenter and every Follow change clear the pan offset.
- Removed player-facing View state, the `L` shortcut, camera-state notices,
  edge-dwell unlock progress, and swipe-unlock thresholds.
- Kept scenario-only camera locking private. It blocks Follow, Recenter,
  pointer/touch/edge pan, crash-inspection pan, and focal zoom adjustment.
- Updated debug snapshots, checkpoints, scenarios, DevTools protocol v2, and
  the browser extension to expose Follow, pan offset, and Recenter only.

## Why

The earlier Follow/View split still exposed an unnecessary lock concept to
players and made panning wait for a mode transition. Follow plus a relative pan
offset expresses the useful behavior directly: the selected subject remains
live, panning starts immediately, and one explicit action restores neutral
framing.

## Ownership boundaries

- `src/runtime/runtimeActions.ts` resolves the live followed subject, owns the
  relative pan offset, and guards all camera mutations against scenario locks.
- `src/input/pointerCameraInput.ts` and
  `src/ui/touchControls/createTouchControls.ts` translate direct pan and zoom
  gestures without unlock state or thresholds.
- `src/scenario/scenarioDirectiveTypes.ts` and
  `src/scenario/scenarioDirectives.ts` own private scenario constraints.
- `src/ui/components/InGameControlsMenuSurface.tsx` and
  `src/ui/createInGameControlsMenu.ts` own the shared Follow/Recenter controls.
- `src/debugScenarioSnapshot.ts`, `src/scenario/scenarioSession.ts`, and
  `src/runtime/scenarioRecovery.ts` retain narrow read compatibility for old
  saved camera fields.
- `src/devtools/devtoolsBridge.ts` and `extension/space-web-game-devtools/` own
  protocol version 2 and the matching extension controls.

## Important decisions

- Zero pan is the neutral state. Rendering combines it with the current
  viewport dimensions and measured mobile-dock inset, so Recenter never stores
  a stale dock-derived world offset.
- Follow changes clear pan. Automatic movement or replacement of the active
  target does not clear pan; the offset remains relative to the current target.
- Scenario locking is not player-facing and has no unlock route. Lock
  application recenters, while every runtime mutation path fails closed.
  Ordinary centered zoom remains available, but a locked camera cannot preserve
  an off-center focal point.
- Current runtime, scenario, snapshot-write, UI, and DevTools APIs contain no
  View state. Legacy snapshot/checkpoint `cameraView: locked` is read only to
  clear old pan offsets; legacy unlocked offsets remain recoverable.
- The existing 8 px tap-versus-drag tolerance remains only for distinguishing a
  touch tap from a heading-plan drag. It does not delay camera pan.

## Validation

- `npm run build` passed, including config validation, TypeScript, and the
  release Vite bundle.
- `npm test` passed: 578 Vitest tests and 19 automation claim/workflow tests.
- `npm run test:gui` passed all 76 Playwright tests, including direct first-move
  touch pan, immediate edge pan, no player camera notices, Follow/Recenter UI,
  and dock-aware target framing.
- Inspected the generated mobile and wide Controls screenshots plus the before
  and after dock-aware Recenter screenshots. Follow and Recenter are readable,
  the View/L UI is absent, and the followed target remains centered in the
  playable area above the open mobile Nav panel.

## Follow-ups and known gaps

- None identified. Production deployment remains outside this PR workflow.

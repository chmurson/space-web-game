# Runtime renderer DPR synchronization

Date: 2026-07-24

Issue: [#298](https://github.com/chmurson/space-web-game/issues/298)

Shipit state:
`.codex/shipit-workflows/automation/issue-298-sync-renderer-dpr.md`

## What changed

- The runtime resize action now synchronizes the renderer pixel ratio before
  applying its logical viewport size.
- Effective DPR remains capped at `2`, and `setPixelRatio` runs only when the
  effective value differs from the renderer's current value.
- Initial renderer sizing now uses the same runtime resize action as later
  window-size and DPR changes.
- App setup binds a resolution media query for the current browser DPR. A
  change invokes the runtime resize action, then replaces the listener with a
  query for the new DPR.
- App-component disposal removes the currently active DPR media-query
  listener.
- Browser-modified `+`/`-` keyboard shortcuts and Ctrl/Meta wheel gestures no
  longer dispatch game camera zoom. Plain unmodified camera zoom controls are
  unchanged.

## Why

Browser zoom, display scaling changes, and moving a browser window between
displays can change `window.devicePixelRatio` without producing a normal window
resize. Keeping the startup DPR in that situation leaves the WebGL drawing
buffer at a stale resolution, which can make the scene blurry or incorrectly
sized.

## Ownership boundaries

- `src/runtime/runtimeActions.ts` owns renderer DPR and logical-size
  synchronization alongside the existing camera, screen-space material, and
  starfield viewport update.
- `src/app/bindDevicePixelRatioChanges.ts` owns only current-DPR media-query
  subscription, rebinding, and cleanup.
- `src/app/createAppComponents.ts` wires initial synchronization and exposes
  the listener cleanup through app-component disposal.

## Implementation decisions

- The renderer contract used by runtime actions was extended only with
  `getPixelRatio` and `setPixelRatio`; unrelated renderer APIs remain hidden.
- The media query uses the browser's current uncapped DPR because its job is to
  detect any browser DPR transition. The runtime action independently applies
  the rendering cap.
- DPR-only notifications still run the existing camera/material/starfield
  viewport path, but do not rescale the heading screen position when logical
  viewport dimensions are unchanged.
- No polling, simulation viewport mutation, DPR-driven camera framing, or
  CSS/browser-zoom compensation was added.

## Validation

- Focused Vitest for DPR synchronization and browser-zoom input ownership —
  4 files / 62 tests passed.
- Focused browser regression — 1 Playwright test passed, confirming modified
  browser zoom gestures preserve game-camera viewport size while plain game
  zoom remains available.
- Full `npm test` — 66 Vitest files with 655 tests, 16 automation-claim tests,
  and 4 automation-workflow tests passed.
- `npm run build` — configuration validation, TypeScript compilation, and
  release Vite build passed.
- Changed-file Biome and `git diff --check` passed.
- Live Chromium emulation reproduced both supplied CSS/buffer/DPR measurement
  sets and their effective `2 ×` renderer buffer ratio.

## Follow-ups and known gaps

- No follow-up implementation is required for issue #298.
- Automated tests model DPR media-query notifications directly. Browser and
  operating-system support determine whether a particular display transition
  emits the corresponding media-query change event.

## Browser zoom clarification

Human review supplied two browser-zoom measurements:

- At 125% zoom, CSS `751 × 746`, buffer `1502 × 1492`, browser DPR `2.5`.
- At 200% zoom, CSS `469 × 466`, buffer `938 × 932`, browser DPR `4`.

Both buffers are exactly `2 ×` their CSS dimensions, so the renderer DPR cap
and synchronization are working as intended. The uncapped browser DPR remains
observable through `window.devicePixelRatio`; only the renderer's effective
pixel ratio is capped.

Browser page zoom still changes CSS-pixel viewport dimensions, physical HUD
size, and responsive breakpoint selection. That is native browser behavior and
is not counteracted by this runtime change. The review did reveal a separate
input collision: browser zoom shortcuts were also reaching the game's
unmodified `+`/`-` camera shortcuts, and browser-modified wheel gestures were
being consumed as camera zoom. Ignoring those modified events prevents an
additional game-camera zoom while preserving browser-owned page zoom.

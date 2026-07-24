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
- No polling, simulation viewport mutation, camera zoom adjustment, or
  browser-zoom compensation was added.

## Validation

- Focused Vitest:
  `tests/runtime/runtimeActions.test.ts` and
  `tests/app/bindDevicePixelRatioChanges.test.ts` — 34 tests passed.
- Full `npm test` — 66 Vitest files with 653 tests, 16 automation-claim tests,
  and 4 automation-workflow tests passed.
- `npm run build` — configuration validation, TypeScript compilation, and
  release Vite build passed.
- Changed-file Biome and `git diff --check` passed.

## Follow-ups and known gaps

- No follow-up implementation is required for issue #298.
- Automated tests model DPR media-query notifications directly. Browser and
  operating-system support determine whether a particular display transition
  emits the corresponding media-query change event.

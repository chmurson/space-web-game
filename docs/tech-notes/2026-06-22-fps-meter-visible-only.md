# FPS Meter Visible-Only Rendering

## What Changed

- Stopped mounting the FPS meter during overlay setup.
- Mounted the FPS meter only while the FPS debug toggle is enabled and the app state allows it to be displayed.
- Removed and cleared the FPS meter when hidden so it is not present in the DOM.
- Skipped FPS-meter text, graph, status, and frame-sample work while the meter is hidden.
- Skipped FPS-only CPU/GPU timing and browser GC probing while the meter is hidden.

## Why

The FPS meter was hidden with CSS, but its DOM and meter-specific formatting/graph work still ran every frame. Issue #34 asks for that FPS-meter-only work to exist only while the meter is visible.

## Key Files

- `src/ui/overlayUI/createOverlayUi.ts` owns initial overlay element creation and now leaves the FPS meter unmounted.
- `src/app/createAppComponents.ts` passes the app-level display policy into the frame loop.
- `src/presentation/hudPresentation.ts` owns FPS meter mount/update/remove behavior.
- `src/runtime/frameLoop.ts` owns frame timing samples used by the FPS meter.
- `tests/presentation/hudPresentation.test.ts` covers the hidden/visible/hidden presenter lifecycle without adding a DOM test dependency.

## Decisions

- Reused the existing FPS meter element instead of adding a component lifecycle abstraction.
- Used the overlay app element already reachable through `bottomPillArea.parentElement` so the meter still mounts under `#app` and keeps existing CSS.
- Kept CPU/GPU timing tied to actual FPS meter visibility now that commit `3715df6` removed the separate performance debug mode.
- Treated main-menu and crashed app states as not visible because those states already hide the FPS meter in CSS; the frame loop now passes that resolved policy to the HUD presenter.

## Validation

- `npx vitest run tests/presentation/hudPresentation.test.ts --config vite.config.ts`
- `npm test`
- `npx biome check src/app/createAppComponents.ts src/runtime/frameLoop.ts src/presentation/hudPresentation.ts src/ui/overlayUI/createOverlayUi.ts tests/presentation/hudPresentation.test.ts docs/tech-notes/2026-06-22-fps-meter-visible-only.md`
- `npm run build`
  - Passed with the existing Vite large-chunk warning.
- Vite preview headless Chrome desktop check at `1280x720`, `?scenario=earth-moon`:
  - Initial hidden state: `.fps-indicator` count `0`.
  - After enabling through the top menu: one connected `.fps-indicator` with live FPS text and visible bounds.
  - After disabling through the top menu: `.fps-indicator` count `0`.
  - No page errors or failed non-favicon responses.
- Vite preview headless Chrome mobile check at `390x844`, `?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=left&touchWarpSide=right`:
  - Initial hidden state: `.fps-indicator` count `0`.
  - After enabling through the top menu: one connected `.fps-indicator` with live FPS text and visible bounds.
  - After disabling through the top menu: `.fps-indicator` count `0`.
  - No page errors or failed responses.
- `coderabbit --base main --agent`
  - Completed with two minor documentation findings; both were fixed.
- Browser-plugin note: Chrome DevTools MCP was blocked by an already-running shared profile, so local verification used Playwright with an isolated headless Chrome profile and software WebGL.
- `npm run deploy:netlify`
  - Shared staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a3914569be617d72922d1da--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- None currently known.

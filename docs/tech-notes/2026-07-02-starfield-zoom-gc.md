# Starfield zoom GC reduction

## What changed

- `src/scene/starfield.ts` now reuses per-layer `Float32Array`/`BufferAttribute` storage while zoom changes rebuild the visible star chunks.
- Star generation still uses the existing deterministic hash inputs, layer fade rules, and chunk visibility keys.
- The renderer updates `geometry.drawRange` to draw only the current star count when a reused buffer has spare capacity.
- Hidden top/crash menus and the touch tutorial hint now skip no-op Preact renders during the frame loop.
- The FPS meter graph buckets frame samples to the graph's pixel width instead of building a path from every retained frame sample.
- Native browser GC probe events below 2 ms are ignored so the FPS meter reports performance-relevant pauses instead of every tiny V8 scavenge.
- `tests/scene/starfield.test.ts` covers buffer reuse while zoom changes reduce the drawn star count.

## Why

Free-roam wheel zoom repeatedly changes the starfield chunk range. The previous implementation built fresh JavaScript `number[]` arrays and fresh Three.js buffer attributes for each changed range, which created avoidable short-lived allocations and GC pressure during zoom.

After that fix, allocation sampling showed debug/UI surfaces as the next visible source when the FPS meter was open. The menu and touch-hint changes remove hidden no-op renders, and the FPS meter/probe changes reduce self-inflicted debug overlay churn and noise.

## Key files

- `src/scene/starfield.ts`: owns procedural star layer generation and render buffers.
- `src/runtime/browserGcProbe.ts`: owns FPS-meter GC event reporting.
- `src/ui/createTopMenu.ts`, `src/ui/createCrashMenu.ts`, `src/ui/touchControls/touchControlsTutorialHint.tsx`, `src/ui/hudText.ts`: own the debug/menu allocation reductions.
- `tests/scene/starfield.test.ts`: owns starfield behavior and regression coverage.

## Validation

- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
- `npx vitest run --config vite.config.ts tests/runtime/browserGcProbe.test.ts tests/ui/hudText.test.ts tests/scene/starfield.test.ts`
- `npm run build:dev`
- `npm test`
- `npm run test:gui -- mobileHudScreenshot.spec.ts`
- Production-preview Playwright zoom smoke test against `http://127.0.0.1:4174/?reachmoon=1`.
- Screenshot inspected: `tmp/perf/free-roam-starfield-zoom.png`.
- Chrome DevTools Protocol trace on the production preview after the starfield fix: 96 wheel zoom steps, sampled JS heap 6.98-15.17 MB, minor GC max 0.46 ms, major GC max 1.27 ms.
- Chrome DevTools Protocol trace on the production preview after the UI/probe follow-up: 160 wheel zoom steps with FPS meter visible, sampled JS heap 6.98-15.37 MB, minor GC max 0.42 ms, major GC max 1.27 ms, reportable native GC events at the 2 ms threshold: 0, FPS meter text ended at `gc? 0`.

## Follow-ups

- If zoom still feels uneven on real hardware, profile GPU/frame commit time separately; the post-fix trace no longer shows starfield allocation as the main sampled allocator.

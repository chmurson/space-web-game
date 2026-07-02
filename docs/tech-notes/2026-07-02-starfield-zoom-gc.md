# Starfield zoom GC reduction

## What changed

- `src/scene/starfield.ts` now reuses per-layer `Float32Array`/`BufferAttribute` storage while zoom changes rebuild the visible star chunks.
- Star generation still uses the existing deterministic hash inputs, layer fade rules, and chunk visibility keys.
- The renderer updates `geometry.drawRange` to draw only the current star count when a reused buffer has spare capacity.
- Hidden top/crash menus and the touch tutorial hint now skip no-op Preact renders during the frame loop.
- The FPS meter graph buckets frame samples to the graph's pixel width instead of building a path from every retained frame sample.
- The FPS meter now shows the maximum CPU frame cost inside the graph window, so short work spikes remain visible in text after the current CPU reading settles.
- The FPS value now uses a rolling one-second frame count while the FPS meter popup keeps its prior four-frame render cadence for the other values.
- The FPS meter graph now scales its Y axis from the lowest to highest CPU frame cost in the visible graph window so the normal low line stays at the bottom while small bumps remain visible.
- The FPS meter warning state now turns orange earlier as CPU/GPU work approaches the active frame budget, while danger still marks over-budget work or heavy measured FPS loss.
- Native browser GC probe events below 2 ms are ignored so the FPS meter reports performance-relevant pauses instead of every tiny V8 scavenge.
- Browsers without native GC entries or heap sampling, including Safari/WebKit, no longer label generic frame gaps as probable GC; the FPS meter reports `gc n/a` instead.
- `tests/scene/starfield.test.ts` covers buffer reuse while zoom changes reduce the drawn star count.

## Why

Free-roam wheel zoom repeatedly changes the starfield chunk range. The previous implementation built fresh JavaScript `number[]` arrays and fresh Three.js buffer attributes for each changed range, which created avoidable short-lived allocations and GC pressure during zoom.

After that fix, allocation sampling showed debug/UI surfaces as the next visible source when the FPS meter was open. The menu and touch-hint changes remove hidden no-op renders, and the FPS meter/probe changes reduce self-inflicted debug overlay churn and noise. The FPS meter also keeps short CPU work spikes readable by exposing the graph-window max value and scaling the graph over the visible CPU min-to-max range.

Safari/WebKit does not expose the browser APIs this probe needs for GC attribution. The earlier fallback treated long frames as `gc?`, which was misleading. The probe now reports GC as unavailable in that mode instead of implying a garbage collector pause.

## Key files

- `src/scene/starfield.ts`: owns procedural star layer generation and render buffers.
- `src/runtime/browserGcProbe.ts`: owns FPS-meter GC event reporting.
- `src/runtime/frameLoop.ts`: owns FPS meter frame samples, rolling FPS, and CPU timing inputs.
- `src/ui/createTopMenu.ts`, `src/ui/createCrashMenu.ts`, `src/ui/touchControls/touchControlsTutorialHint.tsx`, `src/ui/hudText.ts`: own the debug/menu allocation reductions.
- `src/presentation/hudPresentation.ts`: owns FPS meter text refresh cadence.
- `tests/scene/starfield.test.ts`: owns starfield behavior and regression coverage.

## Validation

- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
- `npx vitest run --config vite.config.ts tests/runtime/browserGcProbe.test.ts tests/ui/hudText.test.ts tests/scene/starfield.test.ts`
- `npm run build:dev`
- `npm test`
- `npm run test:gui -- mobileHudScreenshot.spec.ts`
- `npx vitest run --config vite.config.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts`
- Production-preview Playwright zoom smoke test against `http://127.0.0.1:4174/?reachmoon=1`.
- Screenshot inspected: `tmp/perf/free-roam-starfield-zoom.png`.
- Screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`.
- WebKit FPS-meter zoom check inspected: `tmp/perf/fps-meter-rolling-window-webkit.png`; FPS meter text included rolling FPS, graph-window max CPU frame cost, and `gc n/a` on unsupported WebKit GC APIs.
- WebKit FPS-meter dynamic-scale check inspected: `tmp/perf/fps-meter-dynamic-scale-webkit.png`; graph path reached the top of the graph at the visible max CPU frame cost while the popup remained readable.
- WebKit FPS-meter CPU-scale check inspected: `tmp/perf/fps-meter-cpu-scale-webkit.png`; `frame` showed rAF pacing while `cpu max` and the graph used measured CPU frame cost.
- WebKit FPS-meter CPU range-scale check inspected: `tmp/perf/fps-meter-cpu-range-scale-webkit.png`; the graph reached both bottom and top of the visible CPU min-to-max range.
- WebKit FPS-meter warning color check inspected: `tmp/perf/fps-meter-warning-orange-webkit.png`; warning state used the orange FPS-meter accent and remained readable.
- Chrome DevTools Protocol trace on the production preview after the starfield fix: 96 wheel zoom steps, sampled JS heap 6.98-15.17 MB, minor GC max 0.46 ms, major GC max 1.27 ms.
- Chrome DevTools Protocol trace on the production preview after the UI/probe follow-up: 160 wheel zoom steps with FPS meter visible, sampled JS heap 6.98-15.37 MB, minor GC max 0.42 ms, major GC max 1.27 ms, reportable native GC events at the 2 ms threshold: 0, FPS meter text ended at `gc? 0`.
- Playwright WebKit check: WebKit reported no native GC entry support and no `performance.memory` support; the old fallback produced a false `gc?` count from a frame gap, while sampled frames in the final window had no frames over 50 ms.

## Follow-ups

- If zoom still feels uneven on real hardware, profile GPU/frame commit time separately; the post-fix trace no longer shows starfield allocation as the main sampled allocator.

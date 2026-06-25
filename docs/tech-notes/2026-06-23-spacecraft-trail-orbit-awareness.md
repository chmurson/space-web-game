# Spacecraft Trail Orbit Awareness

Issue: https://github.com/chmurson/space-web-game/issues/32
Branch: `codex/issue-32-trail-orbit-awareness`
Shipit state: `.codex/shipit-workflows/codex/issue-32-trail-orbit-awareness.md`

## What Changed

- Spacecraft trail samples now keep absolute simulation positions plus per-body relative offsets.
- Trail rendering uses the same active assist target reference frame as trajectory rendering.
- Repeated target-bound orbits trim the historical trail to roughly the latest two loops.
- Transfer history keeps the existing elapsed-time and point-count bounds without orbit trimming until the spacecraft is bound to the active target.
- Trail capture now uses a fixed dense `250 km` spacing, while rendering decimates the captured trail based on current viewport.
- Zoomed-out trail render spacing was tightened to `4 Mm` at L3, `8 Mm` at L2, and `12 Mm` at L1.
- The debug window now shows current viewport size, zoom, trail render detail, rendered slice count, render spacing, and capture spacing in both readable text and copied JSON.

## Why

The fading trail already showed recent motion, but repeated Earth or lunar orbits could leave too many stale wraps. It also used absolute rendered positions while trajectory rendering is target-relative, so trail and trajectory could feel inconsistent around moving Earth/Moon reference targets.

## Key Files

- `src/presentation/spacecraftTrail.ts` owns trail sample creation, bounds, orbit-aware trimming, and render-point selection.
- `src/presentation/viewportSampling.ts` owns generic viewport-to-sample-spacing interpolation for trail now and trajectory later.
- `src/presentation/spacecraftPresentation.ts` owns Three.js trail geometry syncing and active-target-local rendering.
- `src/presentation/hudPresentation.ts` passes viewport and trail detail into the debug panel.
- `src/ui/hudText.ts` formats the readable debug window lines.
- `src/runtime/frameLoop.ts` passes the active assist target and target-bound trim gate into spacecraft presentation.
- `src/scene/createGameScene.ts` owns the stored trail sample type.
- `tests/presentation/spacecraftTrail.test.ts` covers target-relative samples, orbit trimming, transfer preservation, and point-count bounds.
- `tests/presentation/viewportSampling.test.ts` covers the reusable viewport sampler's sorting, clamping, interpolation, and duplicate-stop guard.
- `tests/ui/hudText.test.ts` and `tests/presentation/hudPresentation.test.ts` cover the debug window viewport/trail detail output.

## Decisions

- Kept trail state in presentation/scene ownership instead of moving it into simulation state.
- Reused `queries.getAssistTarget()` so the trail follows the existing trajectory target policy.
- Stored relative offsets for each body at sample time, keeping target switches cheap and avoiding a separate trail reference-frame policy.
- Used capture metrics as the trim gate: only target-bound motion gets the two-orbit cap, so transfer context is not erased too early.
- Capture spacing is fixed at `250,000m`, with the point cap raised to `2,000` so dense capture still preserves transfer context.
- Used seven smooth render-density stops instead of hard display modes: viewport `1000` renders at `12,000,000m`, `500` uses `8,000,000m`, `250` uses `4,000,000m`, `100` uses `2,000,000m`, `50` uses `1,000,000m`, `30` uses `500,000m`, and `15` or closer uses `250,000m`; intermediate viewports interpolate linearly.
- Kept the sampling helper generic, but kept trail-specific stop values private to the trail module so future trajectory reuse can choose its own policy.
- Derived debug-window trail detail from the same trail helper used by rendering, avoiding separate UI-only density labels.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/spacecraftTrail.test.ts tests/presentation/viewportSampling.test.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts`
- `npm test -- --run` passed: 46 files, 301 tests.
- `npx biome check src/presentation/hudPresentation.ts src/presentation/spacecraftTrail.ts src/presentation/spacecraftPresentation.ts src/presentation/viewportSampling.ts src/runtime/frameLoop.ts src/scene/createGameScene.ts src/ui/hudText.ts tests/presentation/spacecraftTrail.test.ts tests/presentation/viewportSampling.test.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts`
- `git diff --check`
- `npm run build` passed with the existing Vite large-chunk warning.
- `coderabbit --base main --agent`:
  - Initial review found a valid duplicate-stop guard gap in `viewportSampling`; fixed with a fail-fast check and test.
  - Second review found a valid generic sampler coverage gap; fixed with direct sorting, clamping, and interpolation tests.
  - Third review found a valid exact-threshold comparison edge case in trail capture/render selection; fixed with inclusive comparisons and boundary tests.
  - Final review after adding zoomed-out render-density stops completed with 0 findings.
- Browser playtest:
  - Local Vite dev server loaded Free Roam in the in-app browser.
  - Debug window check enabled debug mode, zoomed to viewport `20.44`, and verified the visible lines `viewport: 20.44 | zoom: 4.9x` and `trail detail: L6/7 close | render 341 km | capture 250 km`; debug JSON also included matching `viewport` and `trail` objects with separate render/capture distances.
  - Added the rendered trail slice count to the trail detail debug line and copied JSON.
  - Zoomed-out debug check reached viewport `1000.00` and verified `trail detail: L1/7 system | render 12 Mm | capture 250 km`.
  - Desktop close-zoom check targeted Earth, zoomed to viewport `11.27`, time-warped to about `1h17m` elapsed, and showed a continuous close-zoom trail arc with no crash.
  - Desktop `1280x720` and emulated mobile `390x844` gameplay captures initialized WebGL with canvas sizes matching their viewports.
  - Mobile gameplay check reached viewport `20.44` after time warp, with no crash and no console errors.
  - The only local desktop console error was an existing `/favicon.ico` 404, unrelated to this change.
  - Screenshots are stored as ignored Shipit scratch files under `.codex/shipit-workflows/codex/issue-32-*.png`.
- `npm run deploy:netlify`
  - Staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a3baad14fe3ab22234326c9--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- None currently known.

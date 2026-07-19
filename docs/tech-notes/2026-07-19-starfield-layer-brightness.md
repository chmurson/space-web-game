# Starfield Layer Brightness and Size Scaling

## What Changed

- Expanded the procedural starfield from six to seven layers and tuned chunk density, parallax, and overlapping fade ranges across the supported zoom range.
- Gave the closest layer its own deterministic seed so it no longer repeats the next layer's pattern.
- Derived a deterministic `0.5` to `1` point-size scale from each star's generated brightness and stored it in a reusable geometry attribute.
- Patched the existing Three.js `PointsMaterial` vertex shader so the per-star scale multiplies the material's native point-size uniform.
- Exposed visible layer opacity percentages in the HUD debug JSON.

## Why It Changed

The previous layer configuration left visible density and brightness transitions that were too abrupt at some zoom levels. Overlapping fade ranges keep adjacent detail bands contributing during transitions, while the additional layer and seed separation reduce repeated-looking patterns.

Per-star size makes brighter stars read more clearly without shipping textures or replacing the existing points material. The geometry attribute stores a dimensionless scale rather than an absolute pixel size because Three.js multiplies the material size by the renderer pixel ratio before uploading the native `size` uniform. Keeping that uniform preserves consistent CSS-pixel sizing on high-DPI displays.

## Key Files and Ownership

- `src/scene/starfield.ts` owns layer configuration, deterministic star appearance, buffer reuse, shader patching, fade visibility, and layer debug telemetry.
- `src/app/createAppComponents.ts` connects live starfield debug telemetry to the HUD presentation.
- `src/presentation/hudPresentation.ts` includes the visible layer data in debug JSON.
- `tests/scene/starfield.test.ts` covers deterministic geometry and size scales, shader injection, fade overlap, visibility, capacity, and buffer reuse.
- `tests/presentation/hudPresentation.test.ts` covers the HUD telemetry contract.

## Important Decisions

- Kept `THREE.PointsMaterial` and its native size/pixel-ratio behavior instead of introducing a custom shader material.
- Used one brightness hash progress value for both color brightness and point-size scale so both remain deterministic and correlated.
- Kept one-time maximum-capacity buffer allocation; position, color, and size-scale attributes are updated in place as visible chunks change.
- Kept the shared base opacity and brightness range outside per-layer configuration because they do not currently vary by layer.
- Kept debug telemetry additive and read-only, reporting only visible layers rounded to one decimal percent.

## Validation

- `npx biome check --write src/scene/starfield.ts tests/scene/starfield.test.ts`
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts tests/presentation/hudPresentation.test.ts` (`28` tests passed)
- `npx biome check src/scene/starfield.ts tests/scene/starfield.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm test` (`62` Vitest files / `553` tests plus `19` automation checks passed)
- `npm run build`
- `npm run test:gui` (`63` Playwright tests passed)
- Inspected `tmp/playwright-results/desktopTargetSelector-open-af22a-metry-button-and-T-shortcut-mobile-chromium/desktop-target-selector-open.png`; the desktop starfield showed deterministic brightness/size variation without shader artifacts.
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; the zoomed-out starfield remained sparse and readable behind the debug surface.

## Follow-Ups and Known Gaps

- Revisit per-layer brightness or opacity only when visual tuning needs values that actually differ between layers.
- Recheck the shader patch when upgrading Three.js because `onBeforeCompile` replacements depend on the built-in points vertex shader source.

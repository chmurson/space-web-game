# Starfield Layer Brightness, Size Scaling, and Focal Zoom

## What Changed

- Expanded the procedural starfield from six to seven layers and tuned chunk density, parallax, and overlapping fade ranges across the supported zoom range.
- Gave the closest layer its own deterministic seed so it no longer repeats the next layer's pattern.
- Derived a deterministic `0.5` to `1` point-size scale from each star's generated brightness and stored it in a reusable geometry attribute.
- Patched the existing Three.js `PointsMaterial` vertex shader so the per-star scale multiplies the material's native point-size uniform.
- Exposed visible layer opacity percentages in the HUD debug JSON.
- Made unlocked mobile pinch zoom preserve the starfield's world position while the camera target shifts around the pinch focal point.

## Why It Changed

The previous layer configuration left visible density and brightness transitions that were too abrupt at some zoom levels. Overlapping fade ranges keep adjacent detail bands contributing during transitions, while the additional layer and seed separation reduce repeated-looking patterns.

Per-star size makes brighter stars read more clearly without shipping textures or replacing the existing points material. The geometry attribute stores a dimensionless scale rather than an absolute pixel size because Three.js multiplies the material size by the renderer pixel ratio before uploading the native `size` uniform. Keeping that uniform preserves consistent CSS-pixel sizing on high-DPI displays.

Pinch zoom already kept the touched world point stable for bodies, but it did so as a centered zoom followed by a camera pan. The starfield correctly applied its distant-background parallax to that pan, which made the stars appear to zoom around the viewport center instead. Applying the focal zoom in one camera update lets the starfield preserve its world position for only that target shift, so stars and bodies share the same visual zoom origin without changing ordinary camera parallax.

## Key Files and Ownership

- `src/scene/starfield.ts` owns layer configuration, deterministic star appearance, buffer reuse, shader patching, fade visibility, and layer debug telemetry.
- `src/app/createAppComponents.ts` connects live starfield debug telemetry to the HUD presentation and converts the mobile pinch centroid to a world focal point.
- `src/runtime/runtimeActions.ts` applies the clamped focal zoom and camera-target shift atomically.
- `src/render/sceneUpdates.ts` forwards the focal-zoom preserve signal to the starfield.
- `src/presentation/hudPresentation.ts` includes the visible layer data in debug JSON.
- `tests/scene/starfield.test.ts` covers deterministic geometry and size scales, shader injection, fade overlap, visibility, capacity, buffer reuse, and focal-zoom positioning.
- `tests/runtime/runtimeActions.test.ts` covers focal and centered zoom camera contracts.
- `tests/gui/turnPlanningInput.spec.ts` exercises an off-center pinch in the mobile browser surface and captures before/after screenshots.
- `tests/presentation/hudPresentation.test.ts` covers the HUD telemetry contract.

## Important Decisions

- Kept `THREE.PointsMaterial` and its native size/pixel-ratio behavior instead of introducing a custom shader material.
- Used one brightness hash progress value for both color brightness and point-size scale so both remain deterministic and correlated.
- Kept one-time maximum-capacity buffer allocation; position, color, and size-scale attributes are updated in place as visible chunks change.
- Kept the shared base opacity and brightness range outside per-layer configuration because they do not currently vary by layer.
- Kept debug telemetry additive and read-only, reporting only visible layers rounded to one decimal percent.
- Kept desktop, keyboard, wheel, locked-camera, and double-tap-and-hold zoom centered by making the world focal point optional.
- Kept normal starfield camera parallax; only the camera-target shift required to preserve an unlocked pinch focal point holds the existing starfield world position.

## Validation

- `npx biome check` on all changed source, test, and documentation files (passed)
- `npx vitest run --config vite.config.ts tests/runtime/runtimeActions.test.ts tests/scene/starfield.test.ts` (`45` tests passed)
- `npx playwright test --config playwright.config.ts tests/gui/turnPlanningInput.spec.ts` (`4` tests passed)
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts tests/presentation/hudPresentation.test.ts` (`28` tests passed)
- `npx tsc --noEmit --pretty false`
- `npm test` (`62` Vitest files / `556` tests plus `19` automation checks passed)
- `npm run build`
- `npm run test:gui` (`64` Playwright tests passed)
- The repository-wide `npx biome check src tests scripts` also reports `14` existing formatting/import-order errors and `3` `!important` warnings in unrelated files; none are in this change.
- Inspected `tmp/playwright-results/desktopTargetSelector-open-af22a-metry-button-and-T-shortcut-mobile-chromium/desktop-target-selector-open.png`; the desktop starfield showed deterministic brightness/size variation without shader artifacts.
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`; the zoomed-out starfield remained sparse and readable behind the debug surface.
- Inspected the `mobile-pinch-before.png` and `mobile-pinch-after.png` artifacts under `tmp/playwright-results/mobilePinchZoom-*/`; stars and bodies scaled around the same off-center focal point while the HUD and touch controls remained stable.

## Follow-Ups and Known Gaps

- Revisit per-layer brightness or opacity only when visual tuning needs values that actually differ between layers.
- Recheck the shader patch when upgrading Three.js because `onBeforeCompile` replacements depend on the built-in points vertex shader source.

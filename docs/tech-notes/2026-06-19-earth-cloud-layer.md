# Earth Cloud Layer

## What Changed

- Added a generated transparent Earth cloud texture at `src/assets/bodies/earth-clouds.webp`.
- Updated the body texture generator to download and process the Natural Earth III cloud map.
- Loaded Earth cloud textures through the scenario asset pipeline.
- Added an Earth-only transparent cloud shell in the Three.js scene.
- Rotated the cloud shell independently from Earth to create slow atmospheric drift.

## Why It Changed

The textured Earth globe looked static without clouds. The first cloud shell used the same sphere radius as the Earth mesh, which caused visible depth fighting where the globe appeared to eat the cloud layer while both textures moved.

The cloud shell now sits slightly above the globe with `EARTH_CLOUD_RADIUS_MULTIPLIER = 1.001`. This keeps the layer close to the surface while avoiding coplanar mesh conflict.

## Key Files

- `scripts/generateBodyTextures.mjs`: cloud source download and alpha WebP generation.
- `src/render/scenarioAssets.ts`: cloud texture loading and caching.
- `src/scene/createGameScene.ts`: Earth cloud shell creation and texture application.
- `src/presentation/bodyRotation.ts`: independent cloud drift timing.
- `src/presentation/bodyPresentation.ts`: per-frame cloud rotation update.
- `tests/scene/starfield.test.ts`: scene-level cloud shell coverage.
- `tests/render/scenarioAssets.test.ts`: cloud asset loading coverage.
- `tests/presentation/bodyRotation.test.ts`: cloud drift coverage.

## Implementation Decisions

- Keep clouds as a separate transparent mesh instead of folding them into Earth diffuse texture, so clouds can drift independently.
- Keep simulation state untouched; cloud motion is presentation-only.
- Raise the cloud shell physically above the Earth mesh instead of depending on polygon depth offset.
- Keep the shell Earth-specific until another body needs the same presentation behavior.

## Validation

- `npm test -- --run tests/scene/starfield.test.ts tests/render/scenarioAssets.test.ts tests/presentation/bodyRotation.test.ts`
- `npm test`
- `npm run build`
- `sips -g pixelWidth -g pixelHeight src/assets/bodies/earth-clouds.webp`
- Browser visual check in Free Roam at high time warp.
- CodeRabbit was attempted with `coderabbit --base main --agent`, but it emitted only reviewing heartbeats for roughly 3 minutes and was interrupted without findings.

## Follow-Ups

- No follow-up issue proposed yet.
- A future WebGL visual regression harness could cover globe/cloud clipping if the project adds screenshot diff testing.

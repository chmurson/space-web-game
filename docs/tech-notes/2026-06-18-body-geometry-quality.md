# Body Geometry Quality

Date: 2026-06-18
Issue: https://github.com/chmurson/space-web-game/issues/9
Branch: `codex/issue-9-body-geometry`
Shipit state: `.codex/shipit-workflows/codex/issue-9-body-geometry.md`

## What Changed

Earth and Moon body meshes now use `THREE.SphereGeometry` with `64 x 32`
segments instead of `32 x 16`.

The Earth atmosphere rim remains at `96 x 48` segments.

Earth's stylized diffuse texture is now generated at `4096x2048` instead of
`2048x1024`. The Moon texture remains at `2048x1024`.

## Why

Close camera views could expose faceting on the textured body sphere before the
atmosphere rim became the visual limit. A fixed geometry bump is the smallest
useful first pass and matches the issue guidance to avoid LOD unless the simple
approach proves insufficient.

## Key Files

- `src/scene/createGameScene.ts` owns render-only body mesh construction.
- `tests/scene/starfield.test.ts` asserts the body mesh and atmosphere rim
  segment counts through the public scene refs.
- `scripts/generateBodyTextures.mjs` owns the generated body texture sizes and
  stylized ImageMagick processing.
- `src/assets/bodies/earth-stylized.webp` is the regenerated higher-resolution
  Earth texture.

## Decisions

- No geometry LOD was added.
- Earth was raised to a single higher-resolution diffuse map because Earth is
  the closer and more frequently inspected body in the default scenario.
- Moon was left at the existing resolution.
- No custom texture LOD or mipmap logic was added.
- Simulation, scenario, HUD, input, and save/debug code were left unchanged.

## Validation

- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
  passed: 1 file, 8 tests.
- `npx biome lint src/scene/createGameScene.ts tests/scene/starfield.test.ts`
  passed.
- `npm test` passed: 34 files, 206 tests.
- `npm run build` passed. Vite emitted the existing chunk-size warning.
- Desktop and mobile close-zoom screenshots were captured locally for Earth and
  Moon.
- `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` deployed to
  https://space-web-game-woven-moth.netlify.app.
- Earth texture dimensions after regeneration: `4096x2048`, `521666B`.
- Moon texture dimensions after regeneration: `2048x1024`, `284912B`.

## Follow-Ups

- Reconsider geometry LOD only if browser validation or future body counts show
  this fixed segment count is measurably wasteful.
- Reconsider higher-resolution texture variants only with screenshot evidence
  and asset-size measurements.

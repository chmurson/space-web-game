# Earth Cloud Texture Size

## What Changed

- Reduced `src/assets/bodies/earth-clouds.webp` from a `4096x2048` overlay to `2048x1024`.
- Updated `scripts/generateBodyTextures.mjs` to emit the cloud texture at the smaller size with WebP `quality=76` and `webp:alpha-quality=70`.
- Updated `src/assets/bodies/README.md` so the committed asset notes match the generator.

## Why It Changed

The Earth cloud layer is a translucent, slowly drifting overlay. At normal menu, desktop gameplay, and mobile gameplay distances, it does not need to match the Earth diffuse texture's full `4096x2048` resolution. The previous 2.4 MB cloud WebP dominated the shipped body texture payload.

## Key Files

- `scripts/generateBodyTextures.mjs`: owns body texture generation and the cloud WebP output settings.
- `src/assets/bodies/earth-clouds.webp`: regenerated shipped cloud overlay.
- `src/assets/bodies/README.md`: documents source imagery, output sizes, and processing notes.

Runtime ownership remains unchanged: `src/render/scenarioAssets.ts` loads the texture and `src/scene/createGameScene.ts` applies it to the Earth cloud shell.

## Decisions

- Kept WebP and ImageMagick so the existing asset pipeline stays intact.
- Reduced only the cloud overlay size; Earth and Moon diffuse textures are unchanged.
- Used lossy alpha after temp candidate checks showed a large size reduction without obvious texture-sheet artifacts.
- Did not add runtime LODs or alternate texture variants; one smaller committed overlay is enough for current gameplay distances.

## Original Quality Reference

- Original committed cloud asset: `4096x2048`, `2,499,940` bytes.
- Original generator settings: WebP `quality=88`, `webp:method=6`, no explicit `webp:alpha-quality`.
- Midpoint candidate checked during this task: `2048x1024`, WebP `quality=88`, no explicit alpha quality, about `667 KB`.
- Current generated asset: `2048x1024`, WebP `quality=76`, `webp:alpha-quality=70`, `273,614` bytes.
- If quality needs to be bumped later, first raise `webp:alpha-quality`, then WebP `quality`, and only then restore `4096x2048` if browser screenshots show the smaller source is visibly too soft.

## Validation

- `npm run generate:body-textures`
- `magick identify -format '%f %m %wx%h size=%b channels=%[channels]\n' src/assets/bodies/earth-clouds.webp src/assets/bodies/earth-stylized.webp src/assets/bodies/moon-stylized.webp`
  - `earth-clouds.webp`: `2048x1024`, `273614B`, `srgba`
  - `earth-stylized.webp`: `4096x2048`, `521666B`, unchanged
  - `moon-stylized.webp`: `2048x1024`, `284912B`, unchanged
- `npm test -- tests/render/scenarioAssets.test.ts tests/scene/starfield.test.ts tests/presentation/bodyRotation.test.ts`
- `git diff --check`
- `npx biome check scripts/generateBodyTextures.mjs`
- `npm test`
- `npm run build` (existing Vite large-chunk warning only)
- Browser screenshot checks against the local dev server:
  - menu at `1280x800`
  - `?scenario=earth-moon` at `1280x800`
  - `?scenario=earth-moon` at `390x844`
- Screenshot crop pixel checks confirmed nonblank Earth render regions:
  - menu crop: mean `0.125857`, standard deviation `0.138672`, colors `10685`
  - desktop gameplay crop: mean `0.0808074`, standard deviation `0.106757`, colors `4543`
  - mobile gameplay crop: mean `0.0859132`, standard deviation `0.111058`, colors `4808`
- Staging deploy:
  - https://space-web-game-woven-moth.netlify.app
  - https://6a391c2766bc1b11a9c2404e--space-web-game-woven-moth.netlify.app

## Follow-Ups

- None currently planned.

# Textured Earth and Moon Bodies

Date: 2026-06-17

Branch: `textures-bodies`

Shipit state: `.codex/shipit-workflows/textures-bodies.md`

## Summary

Earth and Moon now render with stylized, real-derived diffuse texture maps instead of solid colors.

The goal was not photorealism. The chosen visual language is recognizable and natural, but simplified enough to fit the game's approximate orbital-simulation feel.

## Why

Solid-color bodies made Earth and Moon read as abstract markers. Textures add immediate spatial identity and make close-orbit scenes feel more like bodies in space.

The game is still intentionally simplified, so this pass avoided a full planet-rendering stack. No cloud layer, normal map, displacement, specular ocean, night lights, atmosphere shader, or GLB body model was added.

## Asset Pipeline

Generated assets live in `src/assets/bodies/`:

- `earth-stylized.webp`
- `moon-stylized.webp`
- `README.md`

Source downloads are written into ignored `tmp/body-texture-sources/`.

Regenerate with:

```sh
npm run generate:body-textures
```

The script is `scripts/generateBodyTextures.mjs`. It checks for `curl` and ImageMagick before downloading and processing sources.

Source imagery:

- Earth: NASA Blue Marble: Next Generation, August base map
  https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg
- Moon: NASA SVS CGI Moon Kit color map
  https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

Output details from the first pass:

- Earth texture: `2048x1024`, about 95 KB on disk, 96.82 KB in Vite build output.
- Moon texture: `2048x1024`, about 278 KB on disk, 284.91 KB in Vite build output.
- Projection: equirectangular latitude-longitude map, 2:1 aspect ratio.
- Runtime use: diffuse/base-color only.

## Runtime Design

The runtime change is intentionally local to `src/scene/createGameScene.ts`.

`createGameScene` imports the generated WebP files through Vite and maps known body ids to texture URLs:

- `earth`
- `moon`

Body meshes still start with the existing `body.color`, so the old visual path remains the fallback. When the texture finishes loading, the material switches to:

- `map = diffuseTexture`
- `color = '#ffffff'`
- `texture.colorSpace = THREE.SRGBColorSpace`

If texture loading fails, the material keeps or restores the original body color.

Simulation data did not change. `body.color` remains available for HUD glyphs, labels, devtools, and fallback rendering.

## Why This Shape

This approach keeps the render graph as an adapter over simulation state:

- Textures are render assets, not simulation data.
- Body ids provide a stable bridge between simulation bodies and render-only material choices.
- Texture generation happens offline, not at app startup.
- Vite handles asset hashing and delivery.

Alternatives intentionally avoided in this pass:

- Remote runtime texture URLs, because they add CORS, cache, availability, and reproducibility risks.
- GLB body models, because the project already has simple sphere geometry and only needed surface maps.
- Shader-heavy planet rendering, because the current art direction is not hyperreal and the first pass should stay easy to tune.
- Texture LOD, because the committed assets are already small and GPU mipmaps handle zoomed-out sampling for now.

## Validation

Validation run for this pass:

- `npm run generate:body-textures`
- `npx biome check scripts/generateBodyTextures.mjs src/scene/createGameScene.ts package.json`
- `npm run build`
- `npm test`
- `git diff --check`
- Playwright/Chrome screenshots:
  - desktop `?scenario=earth-moon`
  - desktop `?scenario=moon-capture-debug`
  - mobile `?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=hidden&touchWarpSide=right`
- `coderabbit --base main --agent`; final full-diff rerun passed with zero findings
- `npm run deploy:netlify`

Staging deploy:

- Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a32b71acd6ea915f254cf8f--fanciful-bunny-d77b4b.netlify.app

## Review Findings Applied

CodeRabbit found five valid issues across review passes:

- Avoid a white placeholder before async textures load.
- Keep solid body color fallback if a texture fails to load.
- Validate required generator commands up front.
- Include process spawn details when the generator fails to run a command.
- Keep missing-command guidance specific to `curl` versus ImageMagick.

All were fixed before merge.

## Follow-Up Issues

- #5 Render Earth spin and tidally locked Moon rotation: https://github.com/chmurson/space-web-game/issues/5
- #6 Add render-driven day and night shading for bodies: https://github.com/chmurson/space-web-game/issues/6
- #7 Add a stylized Earth cloud layer: https://github.com/chmurson/space-web-game/issues/7
- #8 Add a subtle Earth atmosphere rim: https://github.com/chmurson/space-web-game/issues/8
- #9 Tune body geometry and texture quality by zoom: https://github.com/chmurson/space-web-game/issues/9

## Known Gaps

The current texture grading is a first pass. The script is deliberately easy to tune. Future visual work should adjust `scripts/generateBodyTextures.mjs`, regenerate the two WebP files, and compare desktop/mobile screenshots before changing the runtime architecture.

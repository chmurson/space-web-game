# Earth Atmosphere Rim

Date: 2026-06-17

Issue: #8 Add a subtle Earth atmosphere rim

Branch: `issue-8-earth-atmosphere-rim`

Shipit state: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim.md`

## Summary

Earth now has a thin render-only atmosphere rim. The effect is a lightweight Three.js sphere with a small fade shader that improves Earth silhouette and depth without changing simulation state or the existing body texture pipeline.

## Why

The textured Earth reads more naturally than the old solid-color sphere, but its edge can still look flat against the starfield. A restrained rim gives Earth a recognizable atmospheric cue while keeping the game's clean orbital-simulation style.

## Runtime Design

The implementation is local to `src/scene/createGameScene.ts`.

When `createGameScene` builds the Earth body mesh, it also adds an `earth-atmosphere-rim` child mesh:

- geometry: slightly larger `SphereGeometry`
- segments: `96 x 48` so the atmospheric silhouette stays rounded at closer zooms
- material: `ShaderMaterial`
- side: `THREE.BackSide`
- blending: `THREE.AdditiveBlending`
- opacity: computed from the view angle so the halo is brightest at the silhouette and fades inward toward the planet
- depth write: disabled

Parenting the rim to the Earth body mesh keeps the effect render-only and avoids new simulation or presentation state. Existing body presentation code moves and hides the Earth mesh, so the rim follows Earth position and hidden-body visibility automatically.

The shader is intentionally small. It uses the surface normal and view direction to make the atmosphere strongest at the limb, then fades inward so the halo reads as a thin atmospheric shell instead of a filled glow.

## Boundaries

This pass intentionally avoids:

- post-processing
- volumetric atmosphere
- full custom planet shader stack
- one-off surface atmosphere tinting
- simulation changes
- body schema or save-state changes
- a generalized atmosphere system for every body

## Future Alignment

Keep the rim as a separate render-only shell for issue #8. When issue #6 adds render-driven day/night shading, introduce the planet-surface atmosphere tint there instead of adding a separate one-off shader in this pass.

Recommended future body rendering stack:

- Earth surface sphere: texture, sun-direction lighting, soft terminator, and subtle view-angle atmosphere tint
- Cloud shell: separate low-opacity transparent sphere from issue #7, with independent slow rotation
- Atmosphere rim shell: this separate glow sphere, later made sun-aware so the lit edge is brighter and the night edge is restrained

This keeps the current rim useful while avoiding shader work that would likely be rewritten once visual sun direction becomes part of the body material path.

## Validation

Validation run for this pass:

- focused scene tests for Earth-only rim creation and material settings
- `npm test`
- `npm run build`
- `npx biome lint src/scene/createGameScene.ts tests/scene/starfield.test.ts`
- `git diff --check`
- desktop screenshot: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/desktop-edge-bright-rim.png`
- mobile screenshot: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/mobile-edge-bright-rim.png`
- screenshot sanity check with ImageMagick color count/mean brightness
- `coderabbit --base main --agent`; completed with zero findings
- `npm run deploy:netlify`

Staging deploy:

- Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a33ba4bee2f6700968f8803--fanciful-bunny-d77b4b.netlify.app

## Known Gaps

The rim is a stylized readability cue, not physically based scattering. Future day/night lighting work may tune the rim opacity or color once the visual sun direction lands.

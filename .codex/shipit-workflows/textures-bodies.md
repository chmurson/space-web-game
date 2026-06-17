# Shipit State

Task: Textured Earth and Moon bodies
Branch: textures-bodies
Current Mode: yeet
Status: active

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] PR opened/updated (waived: not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline
- Tech note: `docs/tech-notes/2026-06-17-textured-earth-moon-bodies.md`

## Decisions

- Created branch `textures-bodies` from `main` in worktree `/Users/chmurson/Dev/priv/worktrees/space-web-game/textures-bodies/space-web-game`.
- Existing `merge-policy` worktree had a modified `AGENTS.md`; it was left untouched.
- No project-specific `.codex/shipit.config.md`, `.codex/delivery-flow.config.md`, or `.codex/workflow.config.md` exists.
- Game Studio routing: use `game-studio:three-webgl-game` for the Three.js material/runtime changes and `game-studio:web-3d-asset-pipeline` for texture source, size, packaging, and validation choices.
- Repository deploy guidance applies after executable or user-visible implementation: non-`main` changes should deploy to the configured staging site before handoff.
- Current body meshes are created in `src/scene/createGameScene.ts` with `MeshStandardMaterial` using `body.color`; body colors should remain available for HUD/devtools glyphs and fallback styling.
- Art direction should not aim for hyperrealism. The game has an approximation/simulation feel, so Earth and Moon should use a simple, natural, easygoing graphical language: real-derived enough to read as Earth/Moon, but simplified and not visually noisy.
- Avoid a rich realism stack for now: no displacement, detailed normal maps, cloud layer, night lights, or specular ocean pass unless later visual tests show the bodies feel too flat.
- Preferred texture source direction: NASA official sources, processed into stylized committed derivatives. Use Blue Marble: Next Generation for Earth and NASA SVS CGI Moon Kit color map for Moon.
- Preferred grading direction: downscale, lightly blur/simplify fine noise, reduce contrast/saturation, nudge colors toward the existing game palette, and keep the result as diffuse-only material maps.
- Asset processing can be handled locally by the agent. ImageMagick is already available at `/opt/homebrew/bin/magick`; if unavailable in a later environment, install it before regenerating assets.
- Permanent asset documentation should be added during implementation, likely at `src/assets/bodies/README.md`, with source URLs, credit text, generated output names, and exact regeneration commands.
- Added `.codex/shipit.config.md` so future substantial Shipit work requires a dated tech note under `docs/tech-notes/` before marking artifacts/docs complete.
- Created follow-up GitHub issues for the next rendering realism passes: #5, #6, #7, #8, and #9.
- Follow-up: wired the `AGENTS.md` Shipit review requirements into `.codex/shipit.config.md` so CodeRabbit, automated-finding triage, Ponytail review lens, self-review, and solution-retrospect recording are explicit project Shipit review gates.

## Open Questions

- None for the first implementation.

## Validation

- [x] `npm run build` passed; Vite emitted `earth-stylized-OBilL9Sv.webp` at 96.82 kB and `moon-stylized-Be-gkYCJ.webp` at 284.91 kB. Existing large JS chunk warning remains.
- [x] `npm test` passed: 34 files, 201 tests.
- [x] Browser playtest: desktop `earth-moon` screenshot confirms Earth renders textured, nonblank, and correctly lit.
- [x] Browser playtest: desktop `moon-capture-debug` screenshot confirms Moon renders textured, nonblank, and correctly lit.
- [x] Browser playtest: mobile viewport confirms Earth texture remains visible and no HUD/canvas overlap regression appears.
- [x] `git diff --check` passed.
- [x] Verify generated texture file sizes are reasonable for web delivery: source files are ignored in `tmp/`; committed WebP outputs are about 95K and 278K on disk.
- [x] `npm run generate:body-textures` passed after adding command checks.
- [x] `npm run deploy:netlify` passed.
- [x] Follow-up docs/workflow check: `git diff --check` passed after wiring Shipit review gates into config.

## Next Step

Commit the branch, squash merge to main, validate, and deploy production.

## Brainstorm Handoff

Problem statement:

- Earth and Moon currently render as solid-colored sphere meshes.
- Goal is to make both bodies use real surface textures without disrupting simulation state, HUD colors, targeting labels, or existing Three.js scene ownership.

Current implementation observations:

- `src/scene/createGameScene.ts` creates one `SphereGeometry` and one `MeshStandardMaterial` per simulation body.
- `src/simulation/scenarios/earthMoon.ts` supplies body colors for Earth and Moon.
- `src/presentation/bodyPresentation.ts` updates mesh visibility and position only; it does not own materials.
- There is no existing `public/` directory and no committed raster texture asset pipeline.

Options:

- Option A, simple committed diffuse textures: add Earth and Moon equirectangular color maps, load them with `THREE.TextureLoader`, set `texture.colorSpace = THREE.SRGBColorSpace`, and use them as `MeshStandardMaterial.map` for matching body ids. This is the smallest runtime change and likely the best first implementation.
- Option B, richer material stack: add Earth color plus specular/cloud/normal or bump maps, and Moon albedo plus displacement/bump or normal maps. This gives more realism when zoomed in, but costs more asset size, tuning, and lighting validation.
- Option C, generated approximation: generate local raster textures from procedural noise or image generation. This avoids sourcing and attribution work, but does not fully satisfy "real textures" if real means NASA/mission-derived imagery.
- Option D, textured GLB spheres: ship Earth and Moon as GLB assets with packaged materials. This matches a full 3D asset pipeline, but is overkill because the game already has good procedural sphere geometry and only needs surface maps.
- Option E, remote runtime texture URLs: load textures from external domains. This keeps binaries out of the repo, but adds CORS, availability, caching, offline, and licensing risks; not recommended for shipped gameplay.

Initial recommendation:

- Implement Option A first with official-source Earth and Moon diffuse maps at modest resolution, keep `body.color` as fallback/UI data, and structure the material creation so Option B can add optional bump/specular/cloud maps later without changing simulation types.
- Refined after art-direction clarification: use low-to-moderate resolution diffuse textures, color-grade them toward the existing calm game palette, keep high roughness, and let lighting remain simple. The result should feel textured and recognizable rather than photographic.

Color-grading sketch:

- Earth: start from a 5400x2700 Blue Marble base map, resize to 2048x1024 or 1024x512, soften tiny satellite detail, reduce contrast, gently desaturate, shift oceans toward the current calm blue, keep land readable but not photographic, and export WebP or JPEG.
- Moon: start from the 2048x1024 CGI Moon Kit color map, desaturate, raise midtones, soften harsh crater contrast, warm it slightly toward the current gray, and export WebP or JPEG.
- Keep source URLs and transformation notes in a small asset README so the derivatives are reproducible and attributable.

Proposed reproducible asset workflow:

- Create ignored/source working directories if useful:
  - `tmp/body-texture-sources/` for downloaded originals, not committed.
  - `src/assets/bodies/` for committed generated derivatives and the permanent README.
- Download source files:
  - Earth August Blue Marble base map, 5400x2700: `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg`
  - Moon CGI Moon Kit 2025 color map, 2048x1024: `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg`
- Generate first-pass stylized derivatives with ImageMagick, then tune after browser screenshots:
  - Earth sketch:
    - `magick earth-source.jpg -resize 2048x1024 -blur 0x0.25 -modulate 104,86,100 -sigmoidal-contrast -2x48% -colors 128 -quality 82 src/assets/bodies/earth-stylized.webp`
  - Moon sketch:
    - `magick moon-source.jpg -resize 2048x1024 -blur 0x0.15 -modulate 108,55,100 -sigmoidal-contrast -1.5x50% -colors 96 -quality 82 src/assets/bodies/moon-stylized.webp`
- Runtime loading should use the committed stylized derivatives, not remote URLs.
- The implementation should keep asset generation separate from app startup so players do not pay any processing cost.
- The permanent README should record:
  - source page links and direct source file URLs
  - NASA/SVS credit
  - exact ImageMagick version or command form used
  - output dimensions and file sizes
  - chosen art-direction notes: simplified, natural, not hyperreal

## Design Handoff

Scope:

- Add a repeatable local generation path for stylized Earth/Moon diffuse textures.
- Commit generated WebP derivatives and a permanent asset README.
- Load those derivatives in the existing Three.js body material path for known body ids.
- Keep `body.color` as UI/fallback data and avoid changing simulation body contracts.

Target files:

- `scripts/generateBodyTextures.mjs`
- `src/assets/bodies/README.md`
- `src/assets/bodies/earth-stylized.webp`
- `src/assets/bodies/moon-stylized.webp`
- `src/scene/createGameScene.ts`
- `tests/scene/starfield.test.ts` for focused material assertions if practical.

Runtime approach:

- Import generated WebP files through Vite.
- Create one `THREE.TextureLoader` inside `createGameScene`.
- Map `earth` and `moon` ids to texture URLs.
- For mapped bodies, start with the existing body color, load the diffuse texture asynchronously, set `texture.colorSpace = THREE.SRGBColorSpace`, then swap the material to `color: '#ffffff'` plus `map` only after load completes.
- For unmapped bodies, preserve existing solid-color material behavior.
- On texture load error, keep the existing solid body color.
- Keep material simple: high roughness, no displacement/normal/specular/cloud stack.

Risks:

- Texture files could be too large for a small Vite game; verify committed output sizes.
- Imported WebP assets may need build validation in Node/Vite, but `vite/client` should already provide typing.
- Stylized processing may need visual tuning after screenshot inspection.
- Sphere UV seam/orientation may make the initial visible face less useful; rotate only if browser screenshots show a bad starting view.

Validation commands:

- `npm run build`
- `npm test`
- browser playtest at desktop and mobile viewports
- `git diff --check`
- `npm run deploy:netlify`

Completion criteria:

- Earth and Moon render with recognizable stylized texture maps in the live game.
- The look remains simplified and readable rather than hyperreal.
- Regeneration command and source attribution are documented.
- Asset sizes remain reasonable.

## Task Slices

- [x] Record source URLs, art direction, and repeatable processing plan.
- [x] Add texture generation script and permanent asset README.
- [x] Generate first-pass Earth and Moon WebP derivatives.
- [x] Wire body id texture maps into `createGameScene`.
- [x] Add/adjust focused tests for textured material assignment, or explicitly cover through build/browser validation.
- [x] Run build/tests/browser validation and tune if needed.

## Implementation Handoff

Changed files:

- `.gitignore`
- `.codex/shipit.config.md`
- `docs/tech-notes/2026-06-17-textured-earth-moon-bodies.md`
- `package.json`
- `scripts/generateBodyTextures.mjs`
- `src/assets/bodies/README.md`
- `src/assets/bodies/earth-stylized.webp`
- `src/assets/bodies/moon-stylized.webp`
- `src/scene/createGameScene.ts`

Behavior implemented:

- Added `npm run generate:body-textures`, which downloads NASA source maps into ignored `tmp/body-texture-sources/` and generates committed stylized WebP derivatives.
- Added permanent asset documentation with source URLs, credit, art direction, projection, and regeneration notes.
- Added a dated tech note capturing the high-level implementation footprint, why the approach was chosen, validation, and follow-up issues.
- Added a Shipit config gate requiring dated tech notes for future substantial executable, runtime, rendering, asset, or user-visible changes.
- Earth and Moon body meshes now load body-id-specific diffuse textures through `THREE.TextureLoader`.
- Texture color space is set to `THREE.SRGBColorSpace`.
- Unknown/future bodies keep the old solid-color material behavior.
- Simulation body `color` remains unchanged for HUD, labels, devtools, and fallback use.

Deviations from design:

- No unit test was added for material assignment because `TextureLoader` is browser-oriented and the current Vitest environment is Node. Build validation covers asset imports, and browser screenshots cover actual WebGL texture rendering.

Known gaps:

- The first texture grading pass is intentionally subjective. Future iterations can tune the ImageMagick commands in `scripts/generateBodyTextures.mjs` and regenerate.

## Cleanup Notes

- Removed the timestamped generated manifest from the script draft to avoid noisy diffs on every regeneration.
- Ran scoped Biome check on `scripts/generateBodyTextures.mjs`, `src/scene/createGameScene.ts`, and `package.json`; fixed import ordering.
- Kept the runtime material simple: diffuse-only, existing roughness/metalness, no new material abstraction or shader stack.
- Source downloads and browser screenshots stay under ignored `tmp/`.
- Added durable dated tech-note guidance to Shipit config rather than relying on chat memory.

## Review Notes

Supplied findings:

- CodeRabbit major: avoid a white placeholder before async textures load. Valid and fixed by keeping the body-color material until `TextureLoader` completes, then swapping to the texture and white base color.
- CodeRabbit major: failed texture loads should fall back to `body.color`. Valid and fixed with a `TextureLoader` error callback that keeps/restores the solid color fallback.
- CodeRabbit minor: generator should validate required commands. Valid and fixed with upfront checks for `curl` and `magick`/`MAGICK_BIN`.

Self-review findings:

- No further code defects found after checking the final diff and the untracked asset/docs files.
- Ponytail review lens: kept the runtime path as a small body-id texture map plus `TextureLoader`; no GLB asset pipeline, material abstraction, shader stack, or extra maps were added.
- The only new script is justified because it makes the visual asset pass reproducible and documented.
- The new Shipit config is intentionally small and only adds a tech-note gate for substantial changes.

Solution retrospect:

- The chosen approach matches the clarified art direction: real-derived, simplified diffuse textures rather than hyperreal rendering.
- Starting with body color until textures load is better than assigning a white material immediately because it preserves the previous visual fallback and avoids load flashes.
- No rewrite warranted. Future visual iteration should tune `scripts/generateBodyTextures.mjs` commands and regenerate the two WebP outputs.

Requirement coverage:

- Earth and Moon render with recognizable texture maps.
- Texture source and color-grading steps are reproducible from `npm run generate:body-textures`.
- Permanent docs live with the assets at `src/assets/bodies/README.md`.
- High-level dated technical notes live at `docs/tech-notes/2026-06-17-textured-earth-moon-bodies.md`.
- Follow-up GitHub issues were created for rotation, day/night shading, clouds, atmosphere rim, and zoom/body quality.
- Runtime still uses the existing simulation body data and keeps `body.color` for UI/fallback paths.

Residual risk:

- Visual taste is subjective; this is a first stylized pass and may need art-direction tuning after user review.
- Browser console check via the temporary Playwright module surfaced a generic 404 console message, likely favicon/browser noise. Screenshot validation confirmed the texture assets load and render in the WebGL scene.

Validation results:

- `npm run generate:body-textures` passed.
- `npx biome check scripts/generateBodyTextures.mjs src/scene/createGameScene.ts package.json` passed.
- `npm run build` passed; Vite emitted `earth-stylized-OBilL9Sv.webp` at 96.82 kB and `moon-stylized-Be-gkYCJ.webp` at 284.91 kB. Existing large JS chunk warning remains.
- `npm test` passed: 34 files, 201 tests.
- `git diff --check` passed.
- Playwright/Chrome screenshots passed:
  - desktop `?scenario=earth-moon`
  - desktop `?scenario=moon-capture-debug`
  - mobile `?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=hidden&touchWarpSide=right`
- `npm run deploy:netlify` passed.

Staging deploy:

- Shared staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
- Unique deploy URL: `https://6a32b71acd6ea915f254cf8f--fanciful-bunny-d77b4b.netlify.app`
- Build logs: `https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a32b71acd6ea915f254cf8f`

## Follow-Up: Shipit Review Config

Requested change:

- Copy the Shipit review steps already present in `AGENTS.md` into `.codex/shipit.config.md` so future Shipit review mode carries them directly.

Implementation:

- Added a `Shipit Review Gate` section to `.codex/shipit.config.md`.
- The gate requires CodeRabbit with `coderabbit --base main --agent`.
- The gate requires explicit user alerting and review-note recording if CodeRabbit fails, times out, or cannot produce findings.
- The gate requires automated findings to be treated as hypotheses and verified against current code and diff.
- The gate requires Ponytail review lens coverage and recording.
- The gate blocks `Review complete` until CodeRabbit status, automated finding triage, Ponytail outcome, self-review, solution retrospect, residual risk, and validation results or accepted gaps are recorded.

Validation:

- `git diff --check` passed.

Deploy:

- Not run for this follow-up because it changes only Shipit workflow documentation/config, not executable app code, runtime behavior, or user-visible site output.

## Final Pre-Merge Shipit Review

Date: 2026-06-17

CodeRabbit:

- Ran `coderabbit --base main --agent` against the full intended diff after adding new files with intent-to-add.
- CodeRabbit reported 2 minor findings in `scripts/generateBodyTextures.mjs`.
- Valid finding: command execution failures should include `spawnSync` `result.error` details. Fixed by adding `result.error.message` to `run` failure messages.
- Valid finding: missing-command guidance should not mention `MAGICK_BIN` for `curl`. Fixed by making `checkCommand` accept command-specific install guidance.
- Reran `coderabbit --base main --agent`; final result: `review_completed`, `findings: 0`.

Ponytail review lens:

- Lean already. Ship.
- No dependency added for texture generation; existing Node, `curl`, and ImageMagick are enough.
- No speculative render stack added: still diffuse-only, no GLB body model, no shader framework, no cloud/night/specular/LOD abstraction in this branch.
- Net simplification available: 0 lines.

Self-review:

- Checked the full intended diff after `git add -N` made new files visible to Git review.
- Verified runtime change stays local to `src/scene/createGameScene.ts`.
- Verified `body.color` remains the initial material and texture-load fallback, so existing UI/devtools color semantics are preserved.
- Verified source downloads stay under ignored `tmp/` and only stylized WebP derivatives are committed.
- Updated the dated tech note so it records the final CodeRabbit fixes.

Solution retrospect:

- The implementation still fits the accepted design: real-derived, stylized diffuse maps with a reproducible offline generator.
- The final CodeRabbit fixes improved diagnostics without broadening scope.
- No rewrite is justified. Future realism work belongs in the already-created follow-up issues for rotation, day/night shading, clouds, atmosphere, and zoom quality.

Validation results:

- `npm run generate:body-textures` passed after the final generator diagnostic fixes.
- `npx biome check scripts/generateBodyTextures.mjs src/scene/createGameScene.ts package.json` passed.
- `npm run build` passed; existing large JS chunk warning remains. Vite emitted `earth-stylized-OBilL9Sv.webp` at 96.82 kB and `moon-stylized-Be-gkYCJ.webp` at 284.91 kB.
- `npm test` passed: 34 files, 201 tests.
- `git diff --check` passed.
- Playwright/Chrome screenshots passed visual smoke checks:
  - desktop `?scenario=earth-moon`
  - desktop `?scenario=moon-capture-debug`
  - mobile `?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=hidden&touchWarpSide=right`

Residual risk:

- Texture grading remains a subjective first pass and may need visual tuning.
- Production deploy is pending the main squash merge.

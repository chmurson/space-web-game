# Shipit State

Task: Improve star rendering
Branch: improve-star-rendering
Current Mode: review
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] PR opened/updated (not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Branch created from freshly fetched `origin/main` at `a977f9e`.
- Follow repository guidance for renderer work: use `game-studio:three-webgl-game` and keep star rendering inside Three.js scene/render presentation boundaries.
- Do not change gameplay simulation, scenario data, save/debug snapshot formats, or HUD behavior unless a later design explicitly requires it.
- Existing untracked workflow screenshot artifacts from `coach-tutorial-turning-phase` were left untouched.
- This setup pass is planning/context only; no runtime code changes, tests, builds, or deploys are required yet.
- User selected zoom density as the first improvement target.
- Confirmed current layer opacity is stateless and viewport-size driven, so some star layers fade away when zooming in as well as when zooming out.
- Use a stateless monotonic opacity model for this pass: all layers are eligible while zoomed in, and layer opacity can only decrease as `viewportSize` increases.
- Avoid frame-history or zoom-direction state unless visual validation shows the stateless model is insufficient.

## Open Questions

- none for this implementation slice

## Validation

- [x] `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
- [x] `npx biome lint src/scene/starfield.ts tests/scene/starfield.test.ts`
- [x] `npm test`
- [x] `npm run build`
- [x] Browser playtest with desktop/mobile screenshots and pan/zoom checks
- [x] `npm run deploy:netlify`

## Brainstorm Handoff Draft

Current implementation:
- `src/scene/starfield.ts` owns star rendering. It creates six deterministic `THREE.Points` layers from chunked procedural positions and vertex colors.
- Each layer has fixed config for chunk size, density, brightness range, opacity, point size, fade-in/fade-out viewport ranges, parallax factor, seed, and background Y.
- `createStarfield().update()` receives camera target, viewport dimensions, and viewport size. It updates layer opacity/visibility, parallax group position, and visible chunk geometry.
- Geometry rebuilds are avoided unless the visible chunk range key changes.
- Star point materials use `sizeAttenuation: false`, `transparent: true`, `depthWrite: false`, `depthTest: true`, vertex colors, and `toneMapped = false`.
- `src/scene/createGameScene.ts` creates the starfield before the hidden debug grid and gameplay meshes.
- `src/render/sceneUpdates.ts` calls `starfield.update()` from `updateCameraView()` after camera projection/material resolution updates.
- `tests/scene/starfield.test.ts` covers deterministic geometry, parallax movement, wider zoom coverage, close-layer fade-out, max-zoom crossfade, and default hidden grid wiring.

Prior context from `visual-improvement-for-space-plane`:
- The first pass intentionally replaced the default grid emphasis with deterministic stars only, no nebula/fantasy treatment.
- The implementation is global-seeded and renderer-owned to avoid scenario/save-format churn.
- The previous follow-up addressed star density differences between max zoom-in and max zoom-out by adding close/detail layers and viewport fade ranges.
- Browser verification previously focused on desktop/mobile pan/zoom, debug grid visibility, foreground readability, and absence of obvious repetition.

Likely improvement areas:
- Visual richness: point stars currently have no halo, shape variation, pulse/twinkle, clustered contrast, or rare bright anchors.
- Depth/readability: all stars are simple points on layer planes, so stronger effects must stay behind gameplay objects and avoid fighting trajectory/body markers.
- Zoom transitions: current layer fade ranges are config-only and create visible density or brightness changes at extreme viewport sizes. Because opacity is only a function of viewport size, layers with `fadeInStartViewport`/`fadeInEndViewport` also fade away when zooming back in.
- Performance: any richer material/shader/sprite approach should preserve chunked generation, low draw-call count, and avoid per-frame geometry churn.
- Testability: existing tests inspect public `Starfield` output through Three.js objects; new behavior should stay testable without exporting internals just for tests.

## Zoom Density Confirmation

The current implementation supports the user's concern.

- Layers 0 and 1 fade out as `viewportSize` increases: layer 0 fades from viewport 8 to 24; layer 1 fades from 40 to 110.
- Layers 2 through 5 fade in as `viewportSize` increases, which means they fade away when the user zooms back in.
- Example opacity checkpoints from the current config:
  - viewport 4: layers 0 and 1 visible; layers 2 through 5 hidden.
  - viewport 100: layers 2 and 3 visible; layer 1 nearly gone.
  - viewport 1,800: layer 5 visible; layers 3 and 4 are fading or hidden.
- The current behavior is a symmetric crossfade by zoom level, not a directional rule where stars only disappear on zoom-out.

Improvement space:
- Preserve stable anchor stars across zoom so visible stars do not vanish while zooming in.
- Treat closer-detail stars as additive density during zoom-in instead of replacing the existing field.
- Restrict thinning/removal to zoom-out, where density must be reduced for readability/performance.
- Add tests that assert layer opacity/visibility does not decrease across a zoom-in sequence for the chosen stable star set.

## Design Handoff

Implementation scope:
- Update `src/scene/starfield.ts` layer config so `fadeInStartViewport` and `fadeInEndViewport` are removed.
- Keep `fadeOutStartViewport` and `fadeOutEndViewport` as the only zoom-dependent layer visibility controls.
- Tune layer opacities and fade-out ranges so close zoom is rich but not overloaded, mid zoom keeps stable anchor stars, and far zoom thins detail layers for readability/performance.
- Keep the implementation as `THREE.Points`; no shader/sprite pass for this zoom-density fix.
- Update `tests/scene/starfield.test.ts` to assert that layer opacity never decreases while zooming in.
- Replace the old symmetric-crossfade test with behavior that matches the new design: far anchor layers are already visible at close zoom, while detail layers disappear only as viewport size grows.

Target files:
- `src/scene/starfield.ts`
- `tests/scene/starfield.test.ts`
- `.codex/shipit-workflows/improve-star-rendering.md`

Risks:
- Making all layers visible at tight zoom could over-brighten the close view. Mitigation: lower far-anchor opacity and rely on sparse large chunks.
- Removing fade-in ranges changes visual density at close zoom. Mitigation: browser screenshots at tight, normal, and wide zoom.
- Tests currently inspect layer indexes. Keep layer order stable and update test names/expectations to reflect the new model.

Validation plan:
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
- `npm test`
- `npm run build`
- Browser playtest with desktop/mobile screenshots and zoom in/out checks.
- `npm run deploy:netlify` before handoff because this changes user-visible rendering on a non-main branch.

Completion criteria:
- Stars/layers do not fade away during zoom-in sequences.
- Stars can still fade away while zooming out to preserve density.
- The implementation remains deterministic, chunked, renderer-owned, and free of scenario/runtime state changes.

## Task Slices

- [x] Change starfield layer opacity config to zoom-out-only fading.
- [x] Update starfield tests for monotonic zoom-in opacity and zoom-out thinning.
- [x] Print the updated layer config as a readable table.
- [x] Validate with tests/build/browser playtest/deploy.

## Implementation Handoff

Changed files:
- `src/scene/starfield.ts`
- `tests/scene/starfield.test.ts`

Completed behavior:
- Removed `fadeInStartViewport` and `fadeInEndViewport` from starfield layer config.
- Layer opacity is now controlled only by optional fade-out thresholds, so opacity cannot decrease during zoom-in.
- Tuned base opacity down on multiple layers so far anchor layers can remain visible at close zoom without over-brightening the scene.
- Kept a sparse persistent anchor layer visible at every zoom level.
- Added a focused test that walks a zoom-in viewport sequence and asserts each layer opacity is monotonic non-decreasing.
- Updated the max zoom-out test to expect persistent sparse anchors while detail layers are thinned.

Printed configuration:

| Layer | Chunk | Stars/chunk | Base opacity | Fades out at viewport | Size px |
| --- | ---: | --- | ---: | --- | ---: |
| L0 close detail | 1.2 | 4-7 | 0.36 | 8 -> 24 | 0.62 |
| L1 near texture | 2.8 | 3-5 | 0.28 | 40 -> 110 | 0.7 |
| L2 mid detail | 12 | 2-4 | 0.22 | 180 -> 420 | 0.85 |
| L3 base field | 150 | 5-7 | 0.28 | 900 -> 2100 | 0.95 |
| L4 wide anchors | 260 | 3-4 | 0.18 | 900 -> 1800 | 1.1 |
| L5 persistent anchors | 420 | 2-3 | 0.16 | never | 1.25 |

Validation so far:
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts` passed: 1 file, 7 tests.
- `npx biome lint src/scene/starfield.ts tests/scene/starfield.test.ts` passed.
- `npm test` passed: 34 files, 205 tests.
- `npm run build` passed.
- `git diff --check` passed.
- Chrome DevTools visual playtest passed on desktop and mobile.
- `npm run deploy:netlify` passed and deployed to woven-moth staging.

Deviations:
- No direction-aware state was added. The stateless monotonic fade-out model is simpler and directly matches the desired behavior for zoom-in.
- In-app Browser was unavailable (`iab` not available), so visual verification used Chrome DevTools browser controls.

Blockers: none.

Known gaps:
- Visual tuning may still need iteration after screenshot review.

## Cleanup Notes

Cleanup performed:
- Removed now-unused fade-in config fields and the fade-in multiplier helper.
- Kept the same starfield module boundary and public `Starfield` API.
- Kept tests focused on public Three.js output rather than exporting internal config.

Cleanup skipped:
- No new helper was extracted because the opacity logic is currently one short fade-out helper plus a one-line composition.
- No runtime state was added because the stateless monotonic model satisfies the zoom-in requirement with less moving state.

Stale artifacts/docs:
- New screenshots are local Shipit evidence under `.codex/shipit-workflows/`; they are not shipped app assets.

## Review Notes

Supplied findings: none.

CodeRabbit: `coderabbit --base main --agent` completed with 0 findings.

Ponytail review lens: Lean already. Ship.

Self-review:
- No correctness issue found in opacity monotonicity, layer visibility, or renderer ownership.
- Removing fade-in config makes layer opacity non-decreasing as viewport size decreases, which matches the requested zoom-in behavior.
- Zoom-out thinning remains intact through fade-out thresholds.
- The change does not touch simulation state, scenario data, persistence, input behavior, or HUD logic.

Solution retrospect:
- The stateless fade-out-only approach is preferable for this pass because it removes logic instead of adding previous-viewport tracking.
- A richer shader/sprite pass can remain separate if later visual iteration needs halos or brighter anchors.

Residual risk:
- Visual density is subjective and may need another tuning pass after user review.
- Chrome DevTools was used for browser verification because the in-app Browser surface was unavailable.

Browser evidence:
- Desktop default: `.codex/shipit-workflows/improve-star-rendering-desktop-default.png`
- Desktop zoomed out: `.codex/shipit-workflows/improve-star-rendering-desktop-zoomed-out.png`
- Desktop zoomed in: `.codex/shipit-workflows/improve-star-rendering-desktop-zoomed-in.png`
- Mobile default: `.codex/shipit-workflows/improve-star-rendering-mobile-default.png`

Deploy result:
- Staging URL: https://space-web-game-woven-moth.netlify.app
- Unique deploy URL: https://6a3307b736f4e81418528ecc--space-web-game-woven-moth.netlify.app
- Build logs: https://app.netlify.com/projects/space-web-game-woven-moth/deploys/6a3307b736f4e81418528ecc

## Main Merge Review

Requested:
- Run Shipit review.
- Merge feature branch work into `main`.

Pre-merge status:
- `origin/main` was fetched and merged into `improve-star-rendering`; it was already up to date at `a977f9e`.
- Intended commit files are `src/scene/starfield.ts`, `tests/scene/starfield.test.ts`, and this Shipit state file.
- Local screenshot evidence and unrelated `coach-tutorial-turning-phase` screenshots are intentionally left untracked.

Review:
- CodeRabbit rerun: `coderabbit --base main --agent` completed with 0 findings.
- Ponytail review lens: Lean already. Ship.
- Self-review found no issues in opacity monotonicity, zoom-out thinning, test coverage, or renderer boundaries.

Validation:
- `git diff --check` passed.
- `npx biome lint src/scene/starfield.ts tests/scene/starfield.test.ts` passed.
- `npm test` passed: 34 files, 205 tests.
- `npm run build` passed.

Merge/deploy status:
- Pending feature commit, merge to `main`, merged-main validation, and production deploy.

## Next Step

Commit feature branch, merge to `main`, validate, and deploy production.

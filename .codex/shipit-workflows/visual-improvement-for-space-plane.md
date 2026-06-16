# Shipit State

Task: Visual improvement for space plane
Branch: visual-improvement-for-space-plane
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

- The target is the space plane, not a settings pane or DOM panel.
- Normal gameplay should emphasize realistic space, not an isometric or rectangular grid.
- The grid should be hidden by default and remain available through debug tooling.
- First visual pass is a deterministic realistic starfield: stars only, no nebula or fantasy treatment.
- Use the existing canvas/WebGL/Three.js renderer rather than DOM/CSS background styling.
- Object movement and gameplay behavior should remain unchanged.
- Follow repository Game Studio guidance: use Three.js renderer-native primitives and verify through panning/zooming screenshots.
- Use the existing `debugModeEnabled` runtime/devtools flag for grid visibility in the first version instead of adding a second persisted grid setting.
- Use a global deterministic starfield seed for this pass so scenario data and save/debug snapshot formats do not change.

## Open Questions

- none

## Validation

- [x] npm test
- [x] npm run build
- [x] Browser playtest with desktop and mobile screenshots, pan/zoom checks, and foreground readability checks
- [x] npm run deploy:netlify

## Brainstorm Handoff

The rectangular/isometric grid currently makes the play area read as a technical board rather than outer space. Replace the default visual emphasis with a realistic deterministic starfield behind gameplay objects. The grid should be off by default but still available for debugging, ideally through the existing Chrome extension or debug tooling, with a query-param/render flag fallback if needed.

Desired behavior:
- Add 2-3 background star layers.
- Layers create subtle parallax during map pan.
- Stars feel far away relative to gameplay objects.
- Zooming should not make stars feel attached to the foreground plane.
- Background supports effectively infinite scrolling without obvious repetition.
- Foreground objects remain visually dominant and readable.
- No noticeable performance regression during pan/zoom.

Suggested approach:
- Generate stars procedurally from world/map coordinates and a deterministic seed.
- Divide space into large chunks/cells and generate only visible chunks.
- Give each layer different density, brightness, size, parallax factor, and slight color-temperature variation.
- Keep apparent star size mostly screen-space stable.
- Render behind gameplay objects.
- Move the existing grid renderer behind a debug flag.

## Design Handoff

Renderer architecture:
- Core Three.js scene creation lives in `src/scene/createGameScene.ts`.
- Camera pan/zoom is represented by `runtime.ui.camera.panOffset` and `runtime.simulation.viewportSize`, then applied through `updateCameraView` in `src/render/sceneUpdates.ts`.
- The current grid is a `THREE.GridHelper` added directly to the scene.
- The Chrome extension/devtools panel already exposes writable runtime debug flags through `src/devtools/devtoolsBridge.ts`; `debugModeEnabled` is already toggleable from the extension and top menu.

Implementation scope:
- Add `src/scene/starfield.ts` with a deterministic procedural starfield rendered as Three.js `Points`.
- Create 3 layers with different parallax, density, brightness, and point size.
- Divide star space into chunks and rebuild only the visible chunk range per layer.
- Keep each layer's points in a parallax group whose X/Z offset depends on the camera target, so pan shifts stars more slowly than foreground objects.
- Use `PointsMaterial.sizeAttenuation = false` so star size is mostly screen-space stable across zoom.
- Add the starfield group to the scene before gameplay objects and keep it behind the gameplay plane.
- Keep the existing grid ref in `GameSceneRefs`, default it to hidden, and sync it to `runtime.debug.debugModeEnabled` in the frame loop before render.

Risks:
- Starfield coverage must be generous enough for the angled orthographic camera and zoomed-out viewport.
- The star geometry should not be rebuilt every frame; only chunk-range changes should rebuild.
- Transparent star points must remain behind gameplay objects and not reduce readability.

Test strategy:
- Add focused tests for deterministic starfield output, parallax group movement, zoom-driven chunk expansion, and default grid hidden.
- Run `npm test` and `npm run build`.
- Browser playtest desktop and mobile: boot, pan/zoom, enable debug mode/grid, inspect foreground readability and screenshots.

Cleanup expectations:
- Keep the starfield logic isolated to scene/render presentation code.
- Avoid new dependencies, DOM/CSS backgrounds, scenario schema changes, or gameplay state changes.

Completion criteria:
- Normal gameplay boots with a realistic starfield and no grid.
- Debug mode reveals the grid.
- Panning gives subtle parallax, zoom preserves star point size, and no obvious tiling/seams appear during large movement.

## Task Slices

- [x] Add procedural starfield scene module.
- [x] Wire starfield and hidden debug grid into `createGameScene`.
- [x] Update camera/frame-loop sync for starfield parallax and debug grid visibility.
- [x] Add focused tests.
- [x] Validate with tests, build, browser playtest, and staging deploy.

## Implementation Handoff

Changed files:
- `src/scene/starfield.ts`
- `src/scene/createGameScene.ts`
- `src/render/sceneUpdates.ts`
- `src/runtime/frameLoop.ts`
- `tests/scene/starfield.test.ts`

Completed behavior:
- Added a deterministic procedural starfield with three Three.js `Points` layers.
- Each layer uses chunk-based deterministic generation, layer-specific density/brightness/size, and a low parallax factor.
- Star layer groups move relative to the camera target so pans shift stars more slowly than foreground objects.
- Star point materials use `sizeAttenuation: false` so zoom changes the visible field without making stars feel foreground-attached.
- The existing `GridHelper` is now stored as `debugGrid`, hidden by default, and synced to `runtime.debug.debugModeEnabled` during the frame loop.
- `updateCameraView` updates starfield visibility coverage and parallax after camera projection updates.
- Added tests for deterministic output, parallax movement, zoom coverage expansion, and default hidden grid.

Deviations:
- Used the existing `debugModeEnabled` flag instead of adding a separate grid-only debug flag. This keeps the first version available through the existing top menu and Chrome extension without adding setting persistence or snapshot schema changes.
- The in-app Browser plugin control tool was unavailable, so visual verification used Chrome remote debugging directly with SwiftShader WebGL.

Blockers: none.

Known gaps:
- The starfield seed is global, not scenario-specific. This is deliberate for the first pass to avoid scenario/save-format churn.

Validation results so far:
- `npm test` passed: 33 files, 175 tests.
- `npm run build` passed.
- `npx biome lint` passed on touched executable/test files.
- Chrome visual playtest passed on desktop 1280x800 and mobile 390x844 with screenshots in `.codex/shipit-workflows/visual-improvement-for-space-plane/`.
- Chrome playtest confirmed default debug/grid off, debug mode/grid on after toggle, camera pan offset changed after drag, zoom changed viewport size, and no browser console errors.

## Cleanup Notes

Cleanup performed:
- Kept the starfield implementation isolated in `src/scene/starfield.ts`.
- Reused the existing debug-mode flag and devtools bridge instead of adding new runtime settings or snapshot schema.
- Kept validation screenshots as local workflow evidence under `.codex/shipit-workflows/visual-improvement-for-space-plane/`; they are not product/runtime files.

Cleanup skipped:
- No shared abstraction was extracted because the starfield is currently the only chunked procedural background renderer.
- No UI copy changes were made because the existing debug mode label already maps to the flag used by the extension and top menu.

Stale artifacts/docs:
- none.

## Review Notes

Supplied findings: none.

CodeRabbit: `coderabbit --base main --agent` completed with 0 findings.

Ponytail review: Lean already. Ship.

Self-review:
- No correctness issues found in camera update order, debug grid visibility, or renderer/simulation boundaries.
- The starfield remains renderer-owned and does not change gameplay state, scenario data, saved snapshots, or input semantics.
- Grid visibility uses the existing debug-mode path exposed by the top menu and Chrome extension.

Solution retrospect:
- The one-module starfield design is still the right shape for this scope.
- A separate renderer debug flag may be useful later if debug overlay and grid visibility need independent controls, but adding it now would widen runtime/debug state and storage for little benefit.
- At maximum viewport, the starfield can draw roughly 100k point sprites across the three layers; this remains acceptable because each layer is one `Points` object and geometry rebuilds only when the visible chunk range changes.

Requirement coverage:
- Default space plane renders as dark space with deterministic stars and no grid.
- Debug mode reveals the grid.
- Starfield has three layers with subtle parallax, stable screen-space point sizing, chunked deterministic generation, and no visible seams in desktop/mobile pan/zoom screenshots.
- Foreground bodies, spacecraft marker, labels, HUD, and target controls remain readable.

Residual risk:
- Browser verification used Chrome remote debugging because the in-app Browser plugin control tool was unavailable in this session.
- The first pass uses a global starfield seed rather than scenario/map-specific seeds.

Validation results:
- `npm test` passed: 33 files, 175 tests.
- `npm run build` passed locally.
- `npx biome lint src/scene/createGameScene.ts src/scene/starfield.ts src/render/sceneUpdates.ts src/runtime/frameLoop.ts tests/scene/starfield.test.ts` passed.
- Chrome visual playtest passed on desktop 1280x800 and mobile 390x844 with screenshots in `.codex/shipit-workflows/visual-improvement-for-space-plane/`.
- `npm run deploy:netlify` passed and deployed to staging.

Deploy result:
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a31927eefea0263acf78744--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a31927eefea0263acf78744

## Follow-Up: Zoom Density

User feedback:
- Star density felt too different between maximum zoom-in and maximum zoom-out.
- The desired feel is similarly rich space across zoom levels, with additional close/detail layers that fade away as the user zooms out.

Changes made:
- Added three close/detail star layers with smaller procedural chunks for tight zoom levels.
- Added smooth viewport-size fade-out per layer so close/detail layers disappear before wide zoom.
- Reduced wide/base layer density and faded mid/accent layers earlier so zoom-out is less visually overloaded.
- Moved star planes closer behind the gameplay plane so they remain in frame at extreme orthographic zoom-in.

Validation:
- `npm test` passed: 33 files, 176 tests.
- `npm run build` passed.
- `npx biome lint src/scene/starfield.ts tests/scene/starfield.test.ts` passed.
- Chrome visual zoom-density screenshots captured at viewport sizes 100, 3.33, and 1000 under `.codex/shipit-workflows/visual-improvement-for-space-plane/zoom-density/`.

## Merge Review

Requested next step:
- Run Shipit review after zoom-density follow-up.
- Commit the branch changes.
- Merge to `main`.
- Deploy `main` to Netlify production per repository guidance.

Status:
- Fresh CodeRabbit review passed with 0 findings.
- Ponytail review lens: Lean already. Ship.
- Validation rerun passed: `npm test`, `npm run build`, `npx biome lint src/scene/createGameScene.ts src/scene/starfield.ts src/render/sceneUpdates.ts src/runtime/frameLoop.ts tests/scene/starfield.test.ts`, and `git diff --check`.
- Feature commit created: `9ca87c8 feat(scene): improve space plane visuals`.
- Local `main` was first brought up to date with `origin/main` via merge commit `06c042c`.
- Visual branch merged into `main` via merge commit `1b42149`.
- Merged `main` validation passed: `npm test` (33 files, 177 tests) and `npm run build`.
- Production deploy target: `https://space-web-game.netlify.app` via `npm run deploy:netlify` from `main`.
- Production deploy passed from `main`.
- Unique production deploy URL: `https://6a31a53ef511ba1dd741cf82--space-web-game.netlify.app`.

Review notes:
- No supplied findings.
- Self-review found no merge-blocking issues in renderer ownership, debug-grid visibility, starfield parallax, zoom-layer fade behavior, or tests.
- Screenshot workflow artifacts are intentionally left untracked; they are local review evidence, not shipped app assets.

## Next Step

Task complete.

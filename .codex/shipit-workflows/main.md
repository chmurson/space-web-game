# Shipit State

Task: Earth cloud texture layer
Branch: main
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
- [ ] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: waived; narrow rendering/asset change already implemented before Shipit review was requested.
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Add Earth clouds as a separate transparent texture shell, not as a second diffuse map on the Earth material.
- Keep cloud drift in presentation rotation code so simulation state stays independent from Three.js objects.
- Avoid keeping the cloud shell coplanar with the Earth globe; raise it slightly to avoid transparent/opaque depth fighting while Earth and cloud textures rotate independently.
- Current branch is already `main`, so the requested merge-to-main path is direct review, commit, deploy, and push on `main` rather than a PR merge.

## Open Questions

- none

## Validation

- [x] `npm test -- --run tests/scene/starfield.test.ts tests/render/scenarioAssets.test.ts tests/presentation/bodyRotation.test.ts`
- [x] `npm run build`
- [x] `coderabbit --base main --agent` attempted; interrupted after only heartbeats and no findings for roughly 3 minutes.
- [x] `npm test`
- [x] `sips -g pixelWidth -g pixelHeight src/assets/bodies/earth-clouds.webp`
- [ ] production deploy after main commit

## Next Step

Commit the reviewed changes on `main`, deploy production, record commit/deploy details, then push `main`.

## Brainstorm Handoff

Problem:
- Earth should show a moving cloud texture without the globe visually eating the cloud layer as Earth and clouds rotate.

Goal:
- Ship a readable Earth cloud layer that remains visually stable during normal play and high time warp.

Non-goals:
- No change to simulation physics.
- No new renderer architecture or material system.
- No new shipped 3D model format.

## Design Handoff

Scope:
- `scripts/generateBodyTextures.mjs`: generate a transparent Earth cloud texture from source imagery.
- `src/render/scenarioAssets.ts`: load cloud textures alongside body diffuse textures.
- `src/scene/createGameScene.ts`: create a transparent Earth cloud mesh and apply cloud texture assets.
- `src/presentation/bodyRotation.ts` and `src/presentation/bodyPresentation.ts`: drift clouds separately from the globe.
- Tests for asset loading, cloud drift, and scene cloud mesh setup.
- `docs/tech-notes/2026-06-19-earth-cloud-layer.md`: durable implementation note.

Risks:
- Transparent cloud geometry can z-fight or depth-sort poorly if it shares the exact Earth sphere surface.
- Cloud shell must not look detached from Earth.
- Added cloud asset increases shipped texture payload.

Validation plan:
- Focused tests for scene, asset loading, and rotation.
- Full test suite.
- Release build.
- Browser visual check at high time warp.
- CodeRabbit plus self-review before commit.

## Implementation Handoff

Implemented:
- Added generated `earth-clouds.webp` asset and texture-generation pipeline changes.
- Loaded Earth cloud textures through scenario assets and cached them with diffuse textures.
- Added `bodyCloudMeshes` to scene refs and created an Earth-only transparent cloud shell.
- Raised the cloud shell with `EARTH_CLOUD_RADIUS_MULTIPLIER = 1.001`, avoiding coplanar depth conflict instead of relying on polygon offset.
- Added slower independent cloud drift rotation.
- Updated tests for cloud texture loading, cloud drift, and Earth-only cloud mesh creation.

Known gaps:
- No automated pixel-diff visual regression test exists for the WebGL globe.

## Cleanup Notes

Cleanup performed:
- Removed the earlier polygon-offset workaround once the cloud shell was raised above the Earth mesh.
- Kept the cloud shell implementation local to scene creation; no new abstraction was added for one body-specific layer.
- Updated asset README wording to match the raised transparent cloud shell.

Cleanup intentionally skipped:
- No shared shell/atmosphere layer factory; Earth cloud and atmosphere meshes still have different material behavior and only one current caller each.

## Review Notes

Automated review:
- `coderabbit --base main --agent` was run as required. It reached the reviewing phase and emitted heartbeats, but produced no findings or completion after roughly 3 minutes, so it was interrupted and treated as an automated-review gap.

Ponytail review lens:
- Found one repo-quality simplification: `EARTH_CLOUD_LAYER_NAME` was exported only for tests. Fixed by making the scene constant private and using a local test literal.
- No dependency, abstraction, or generalized layer factory is justified for one Earth-only cloud shell.
- Kept cloud presentation as plain Three.js mesh/material code; no new render subsystem added.

Self-review findings:
- Fixed the test-only API export described above.
- Cloud shell now has real radius separation (`1.001`) instead of coplanar depth offset, addressing the observed globe/cloud depth conflict.
- Cloud motion is presentation-only and does not mutate simulation state.
- Asset caching covers both diffuse and cloud textures, and failed texture loads still fall back without blocking scenario creation.
- Tests cover cloud asset loading, cloud drift, Earth-only cloud shell creation, and the non-coplanar radius.

Solution retrospect:
- The split between scenario asset loading, scene mesh creation, and presentation rotation is still the right boundary for this repo.
- Keeping `bodyCloudMeshes` avoids per-frame scene-tree searches while staying narrowly scoped.
- A future reusable shell helper would be premature until another body needs similar layered rendering.

Requirement coverage:
- Earth clouds render as a separate transparent texture layer.
- Clouds drift independently from the Earth globe.
- The cloud shell is slightly raised to avoid the “Earth eating clouds” artifact.
- Docs and tech note record the new cloud texture source, processing, and runtime behavior.

Residual risk:
- No automated pixel-diff visual regression exists for WebGL globe/cloud clipping.
- CodeRabbit did not complete, so automated review coverage is missing.
- The cloud WebP adds about 2.4 MB of shipped asset payload.

Validation results:
- `npm test -- --run tests/scene/starfield.test.ts tests/render/scenarioAssets.test.ts tests/presentation/bodyRotation.test.ts`: passed, 3 files / 21 tests.
- `npm test`: passed, 37 files / 230 tests.
- `npm run build`: passed.
- `sips -g pixelWidth -g pixelHeight src/assets/bodies/earth-clouds.webp`: confirmed `4096x2048`.
- Browser visual check in Free Roam at high time warp: passed; no globe/cloud clipping observed after radius separation.

Follow-up issues:
- None proposed.

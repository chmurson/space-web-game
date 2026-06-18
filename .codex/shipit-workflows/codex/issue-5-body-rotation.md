# Shipit State

Task: Issue #5 - render Earth spin and tidally locked Moon rotation
Branch: codex/issue-5-body-rotation
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
- [x] PR opened/updated (not requested; working tree handoff)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline
- Tech note: `docs/tech-notes/2026-06-18-body-rotation.md`

## Decisions

- Start from `origin/main` on `codex/issue-5-body-rotation`.
- Follow repository `AGENTS.md`: validate executable changes and deploy staging before handoff on a non-main branch.
- Follow `.codex/shipit.config.md`: add dated tech note, run CodeRabbit during review, apply Ponytail review lens, and update targeted GitHub issue before completion.
- Keep rotation render-only; simulation body positions, velocities, and physics state remain authoritative and unchanged.
- Avoid asset-loading and material-pipeline scope to minimize conflict with active issue #11 work.

## Open Questions

- None currently. Issue #5 acceptance criteria are clear enough to design and implement.

## Validation

- [x] npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts
- [x] npm test
- [x] npm run build
- [x] npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts src/runtime/frameLoop.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md
- [x] Browser smoke check desktop viewport
- [x] Browser smoke check mobile viewport
- [x] coderabbit --base main --agent
- [x] npm run deploy:netlify

## Next Step

User review, then normal commit/PR/merge path if accepted.

## Brainstorm Handoff

Problem: Earth and Moon currently render as static body meshes, making textured planets feel inert even while simulation time advances.

Goals:
- Earth should visibly spin based on elapsed simulation time.
- Moon should render as approximately tidally locked in Earth-Moon scenarios, with the same face oriented toward Earth.
- Rotation must be deterministic for the same simulation time after reset/restart.
- Existing HUD, labels, prediction lines, and simulation behavior must remain unchanged.

Non-goals:
- No physics/orbital-state changes.
- No new texture, cloud, lighting, or shader work.
- No dependency on the active issue #11 asset-loading branch.

User-facing behavior:
- Players see Earth rotate during normal gameplay.
- In Earth-Moon scenarios the Moon orientation tracks its direction relative to Earth instead of spinning freely.

Edge cases:
- Hidden bodies should stay hidden.
- Missing Earth or Moon bodies should not throw.
- Non Earth-Moon scenarios should keep sensible default body orientation.

## Design Handoff

Implementation scope:
- Add a pure presentation policy for body visual Y-axis rotation.
- Wire body presentation updates to receive simulation elapsed time.
- Apply rotations to existing Three.js body meshes only; do not mutate `SimulationState` bodies.
- Keep material, texture loading, lighting, clouds, and asset pipeline unchanged.

Target files:
- `src/presentation/bodyRotation.ts`
- `src/presentation/bodyPresentation.ts`
- `src/runtime/frameLoop.ts`
- `tests/presentation/bodyRotation.test.ts`

Data/render flow:
- `frameLoop` already has `runtime.simulation.state.elapsed`; pass it to `bodyPresentation.updateVisuals`.
- `bodyPresentation` sets mesh position and visual rotation during the existing per-frame body sync.
- Earth rotation is derived from elapsed simulation seconds using an approximately real 24-hour visual day so rotation is deterministic after restart while staying close to real-world intuition.
- Moon rotation is derived from the current Moon-to-Earth vector, orienting the same local face toward Earth when both bodies exist.

Risks:
- Rotation axis must stay aligned with the X/Z simulation plane and Three.js Y-up scene.
- Hidden bodies should not become visible or alter indicator/label behavior.
- Constants should remain presentation-only so later day/night shading can replace or reuse them cleanly.

Test strategy:
- Unit-test pure Earth elapsed rotation and Moon tidally locked rotation math.
- Rely on existing build/typecheck for integration wiring.
- Browser smoke-check desktop and mobile for obvious visual/runtime regressions.

Completion criteria:
- Earth mesh rotation changes with elapsed time.
- Moon mesh orientation tracks Earth direction.
- Reset/restart remains deterministic because rotation depends only on simulation state.
- Existing HUD, labels, prediction lines, and physics are unchanged.

## Task Slices

- [x] Add pure body rotation policy and unit tests.
- [x] Pass elapsed simulation time through body presentation.
- [x] Apply render-only mesh rotations for Earth and Moon.
- [x] Run focused tests, full test suite, build, browser checks, CodeRabbit, and staging deploy.

## Implementation Handoff

Changed files:
- `src/presentation/bodyRotation.ts`
- `src/presentation/bodyPresentation.ts`
- `src/runtime/frameLoop.ts`
- `tests/presentation/bodyRotation.test.ts`
- `docs/tech-notes/2026-06-18-body-rotation.md`
- `.codex/shipit-workflows/codex/issue-5-body-rotation.md`

Completed slices:
- Added pure body rotation policy and unit tests.
- Passed elapsed simulation time through body presentation from both frame-loop update paths.
- Applied render-only mesh rotations for Earth and Moon.

Behavior implemented:
- Earth visual rotation derives from elapsed simulation seconds.
- Moon visual rotation derives from the current direction from Moon to Earth.
- Simulation state, body positions, trajectory prediction, labels, HUD, and physics are unchanged.

Deviations from design:
- Browser smoke used CDP with an isolated headless Chrome because the in-app Browser surface was unavailable and the Chrome DevTools MCP profile was locked.

Known gaps:
- No direct automated screenshot diff for rotation over long elapsed time; the rotation math is covered by unit tests, and browser smoke covers integration/rendering.

## User Follow-Up Adjustment

User asked to keep Earth visual spin "real" enough by using a 24-hour day rather than the initial stylized 6-hour day. Updated `EARTH_VISUAL_DAY_SECONDS` to `24 * 60 * 60`, added a direct unit assertion for the 24-hour value, and updated the tech note/state language.

Follow-up validation:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed: 1 file, 5 tests.
- `npm test` passed: 36 files, 215 tests.
- `npm run build` passed. Vite emitted the existing chunk-size warning.
- `npx biome check --write src/presentation/bodyRotation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md` passed with no fixes.
- `npm run deploy:netlify` deployed to https://fanciful-bunny-d77b4b.netlify.app and unique deploy https://6a34196553539c28b4a10349--fanciful-bunny-d77b4b.netlify.app.
- Final CodeRabbit rerun after the 24-hour adjustment was attempted twice and rate-limited. Last successful CodeRabbit run before this constant/test/doc adjustment completed with 0 findings.

## Cleanup Notes

Cleanup performed:
- Ran Biome safe fixes on touched source/test files.
- Reviewed the rotation helper API and kept it as a production-used presentation policy rather than exporting internals from `bodyPresentation`.
- Confirmed no stale docs/artifacts beyond the new required tech note.

Cleanup intentionally skipped:
- No shared abstraction for presentation updates; the existing frame-loop calls are narrow and changing that would be unrelated.
- No material or texture refactor; those areas are intentionally left for issue #6/#7 and active issue #11 work.

## Review Notes

CodeRabbit status:
- First run before the rebase completed with 1 finding. It suggested reading `Body.position.z`, but simulation bodies have only `position.x` and `position.y`; `renderPosition` maps simulation `y` to Three.js render `z`, so the proposed fix was invalid.
- A clarity change was still applied in `bodyRotation.ts` by renaming the local value to `towardEarthRenderZ` and adding a short mapping comment.
- Final rerun after rebasing onto latest `origin/main` completed with 0 findings.

Ponytail lens outcome:
- Lean already. Ship.
- No dependency, asset pipeline, scene API, or speculative abstraction was added.
- The helper module is kept because production code uses it and it gives focused behavior coverage without exporting body-presentation internals.

Self-review outcome:
- Verified rotation stays render-only and does not mutate simulation bodies.
- Verified startup and frame-loop body presentation calls both pass elapsed simulation time.
- Verified hidden body handling, offscreen indicators, labels, trajectory rendering, HUD, and physics paths are not otherwise changed.
- Verified the branch was rebased onto latest `origin/main` after issue #11 landed.

Solution retrospect:
- The implementation is still the same shape I would choose after seeing the full diff: a small presentation policy plus existing frame-loop wiring.
- No rewrite or broader refactor is justified.
- Unit tests cover the math; browser checks cover runtime rendering integration.
- No additional user-facing docs are needed beyond the required tech note.

Validation results:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed: 1 file, 4 tests.
- `npm test` passed: 36 files, 214 tests.
- `npm run build` passed. Vite emitted the existing chunk-size warning.
- `npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts src/runtime/frameLoop.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md` passed.
- Desktop and mobile CDP smoke checks reached `?scenario=earth-moon`, each with one correctly sized WebGL canvas and visible textured Earth, HUD, spacecraft label, and Moon indicator. Desktop logged only a missing `favicon.ico`.
- Final `coderabbit --base main --agent` rerun completed with 0 findings.
- `npm run deploy:netlify` deployed to https://fanciful-bunny-d77b4b.netlify.app and unique deploy https://6a34129b497b3312c53ebecd--fanciful-bunny-d77b4b.netlify.app.

Residual risk:
- There is no automated visual screenshot diff proving texture orientation changes over long elapsed time. Rotation math is covered directly by tests, and browser smoke covers rendering integration.
- CodeRabbit did not complete after the final 24-hour adjustment because of rate limiting. The adjustment after the last successful 0-finding CodeRabbit run was limited to the Earth visual day constant, one direct unit assertion, and docs/state text.

## User Follow-Up Moon Texture Alignment

User asked whether the Moon texture's near side can be better aligned scientifically. The texture source is the NASA CGI Moon Kit LROC color map and the stylized asset shows the familiar near-side maria centered in the equirectangular image. Three.js maps the center of a `SphereGeometry` texture to local `+X`, while the first tidal-lock pass pointed local `+Z` toward Earth.

Updated the tidal-lock rotation to point local `+X` toward Earth and added tests that verify this axis convention with arbitrary Moon/Earth positions.

Moon alignment validation:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed: 1 file, 6 tests.
- `npm test` passed: 36 files, 216 tests.
- `npm run build` passed. Vite emitted the existing chunk-size warning.
- `npx biome check --write src/presentation/bodyRotation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md` passed with no fixes.
- `npm run deploy:netlify` deployed to https://fanciful-bunny-d77b4b.netlify.app and unique deploy https://6a341c10e5c2722df0b99425--fanciful-bunny-d77b4b.netlify.app.
- Final CodeRabbit rerun after this Moon alignment adjustment was attempted and rate-limited. Last successful CodeRabbit run before the follow-up constant/test/docs/Moon-axis adjustments completed with 0 findings.

Issue status:
- Issue URL: https://github.com/chmurson/space-web-game/issues/5
- Progress comment: https://github.com/chmurson/space-web-game/issues/5#issuecomment-4743877086
- Final issue state for this handoff: open, pending user review plus normal commit/PR/merge path.

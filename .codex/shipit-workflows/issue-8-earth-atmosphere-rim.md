# Shipit State

Task: Issue #8 subtle Earth atmosphere rim
Branch: issue-8-earth-atmosphere-rim
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
- [x] PR opened/updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Issue #8 is assigned to `chmurson`.
- Base the feature branch on current `main` because issue #8 follows the textured body work.
- Leave the pre-existing local `AGENTS.md` edit unrelated and unstaged unless explicitly requested.
- Use the Three.js render graph only; do not alter simulation state, body data, saved state, or UI behavior.
- Prefer a lightweight Earth-only transparent rim mesh over post-processing or a full planet shader.
- Attach the rim to the Earth body mesh so it inherits position and visibility without widening `GameSceneRefs` only for tests.
- Keep the rim subtle enough to preserve trajectory, label, marker, and HUD readability.
- Follow project Shipit review gates: CodeRabbit, Ponytail lens, self-review, validation, tech note, and staging deploy.
- User requested a softer rim that fades out farther from the planet center instead of a crisp uniform edge.

## Open Questions

- none

## Validation

- [x] npm test
- [x] npm run build
- [x] npx biome lint on touched files
- [x] Browser playtest with desktop and mobile screenshots
- [x] coderabbit --base main --agent
- [x] npm run deploy:netlify

## Brainstorm Handoff

Issue #8 asks for a subtle Earth atmosphere/rim cue that improves Earth silhouette and depth without competing with gameplay readouts. The feature should be render-only, lightweight, resilient on desktop/mobile, and documented if it changes the render model.

Non-goals:
- No physical atmosphere simulation.
- No heavy post-processing stack.
- No full custom planet renderer.
- No change to trajectory, HUD, labels, markers, controls, or physics behavior.

Edge cases:
- Earth may be hidden by scenario directives; the rim must hide with it.
- Other bodies should not receive the Earth rim.
- Empty or non-Earth scenes should keep working.
- The effect must remain behind or visually subordinate to trajectory lines and target labels.

## Design Handoff

Implementation scope:
- Extend `src/scene/createGameScene.ts` with an Earth-only atmosphere rim mesh created alongside the Earth body mesh.
- Attach the rim as a child of the Earth body mesh so presentation code continues to synchronize only the body mesh position and visibility.
- Use built-in Three.js geometry/material primitives: a slightly larger sphere, back-side rendering, transparent additive blending, disabled depth write, low opacity.
- Keep `src/presentation/bodyPresentation.ts` unchanged unless implementation proves a separate atmosphere ref is needed.
- Add focused tests under `tests/scene/` and/or presentation-adjacent coverage for rim creation and default behavior.
- Add a dated tech note under `docs/tech-notes/` describing the render choice and validation.

Risks:
- The rim can look like a blob if it renders over the planet face; use back-side rendering and low opacity.
- The rim can obscure lines or labels if opacity or scale is too high.
- Visibility sync can drift if the rim is added as a separate scene object; avoid that by parenting it to the Earth mesh.

Completion criteria:
- Earth has a restrained atmospheric edge at normal gameplay zoom.
- Moon and other bodies are unchanged.
- Hidden Earth also hides the rim.
- Desktop/mobile screenshot checks show stable nonblank rendering and no obstruction of gameplay overlays.

## Task Slices

- [x] Add Earth atmosphere rim mesh creation.
- [x] Confirm rim inherits body presentation visibility and position.
- [x] Add focused tests.
- [x] Add/update tech note.
- [x] Run validation, review, and staging deploy.

## Implementation Handoff

Changed files:
- `src/scene/createGameScene.ts`
- `tests/scene/starfield.test.ts`
- `docs/tech-notes/2026-06-17-earth-atmosphere-rim.md`

Completed behavior:
- Added an Earth-only `earth-atmosphere-rim` child mesh during scene creation.
- The rim uses a slightly larger sphere with a transparent additive `ShaderMaterial`, `BackSide` rendering, disabled depth writes, edge-bright limb opacity, and `96 x 48` geometry segments.
- The rim is parented to Earth, so existing body presentation movement and visibility automatically apply to it.
- Added focused scene coverage for Earth-only rim creation and material settings.
- Added the required dated tech note for the render-model change.

Deviations:
- Did not add a new `GameSceneRefs` atmosphere map. Parenting the rim to Earth kept the public scene refs smaller and avoided extra sync code.

Blockers: none.

Known gaps:
- Visual tuning may need adjustment after day/night lighting work lands.

Validation results so far:
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts` passed.
- `npx biome lint src/scene/createGameScene.ts tests/scene/starfield.test.ts` passed.

## Cleanup Notes

Cleanup performed:
- Kept the atmosphere implementation inside scene creation, where body render assets are already owned.
- Avoided a new `GameSceneRefs` map or presentation sync path because parenting the rim to Earth covers movement and visibility.
- Tightened the test texture-loader mock so it restores even if the test body throws.

Cleanup skipped:
- No shared atmosphere factory module was extracted because only Earth has this effect.
- No body asset pipeline changes were made because the rim has no texture asset.

Stale artifacts/docs:
- none.

## Review Notes

Supplied findings: none.

CodeRabbit: `coderabbit --base main --agent` completed with 0 findings.

Ponytail review: Lean already. Ship.

Self-review:
- The atmosphere rim is renderer-owned and does not change simulation state, body schema, saved state, scenario logic, input, HUD, labels, or trajectory behavior.
- Parenting the rim to the Earth mesh keeps movement and hidden-body visibility aligned with existing body presentation.
- The material is lightweight and avoids post-processing, extra assets, or a generalized atmosphere system.
- Tests cover Earth-only creation and material settings without exporting internals.

Solution retrospect:
- A child mesh is still the smallest correct design for this scope.
- A separate material factory or atmosphere registry would be premature while only Earth has this effect.
- Visual day/night work may tune color and opacity later, but that should remain in issue #6.

Requirement coverage:
- Earth has a visible restrained atmospheric edge in desktop and mobile screenshots.
- The effect does not obscure spacecraft label, HUD, Moon indicator, or trajectory space in the captured states.
- Rendering was nonblank and stable after normal app startup wait.
- The render-model choice is documented in `docs/tech-notes/2026-06-17-earth-atmosphere-rim.md`.

Residual risk:
- The in-app Browser `iab` surface was unavailable and Chrome DevTools automation was blocked by a profile lock, so browser verification used Playwright CLI screenshots instead.
- Initial no-wait screenshots captured before WebGL finished rendering; waited screenshots passed and were kept as evidence.

Validation results:
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts` passed: 1 file, 7 tests.
- `npx biome lint src/scene/createGameScene.ts tests/scene/starfield.test.ts` passed.
- `npm test` passed: 34 files, 205 tests.
- `npm run build` passed locally; Vite reported the existing chunk-size warning.
- `git diff --check` passed.
- Playwright CLI desktop screenshot passed: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/desktop-earth-moon-wait.png`.
- Playwright CLI mobile screenshot passed: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/mobile-earth-moon-wait.png`.
- ImageMagick screenshot sanity check passed: desktop `colors=6082 mean=0.0356571`, mobile `colors=6267 mean=0.0418366`.
- `coderabbit --base main --agent` passed with 0 findings.
- `npm run deploy:netlify` passed.

Deploy result:
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a33089d6c15bf278bd9a7d9--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a33089d6c15bf278bd9a7d9

## Follow-Up: Faded Rim Falloff

User feedback:
- The rim should fade out farther from the planet center for a more realistic, less hard-edged atmosphere.

Changes made:
- Replaced the rim's `MeshBasicMaterial` with a small `ShaderMaterial`.
- The shader uses view direction and surface normal to compute limb strength.
- The halo now fades toward the outer atmosphere edge instead of reading as a uniform circle.
- Increased the atmosphere shell radius slightly so the fade has visible room, while lowering peak alpha to keep the effect restrained.

Validation:
- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts` passed: 1 file, 7 tests.
- `npx biome lint src/scene/createGameScene.ts tests/scene/starfield.test.ts` passed.
- `npm test` passed: 34 files, 205 tests.
- `npm run build` passed locally; Vite reported the existing chunk-size warning.
- `git diff --check` passed.
- Playwright CLI desktop screenshot passed: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/desktop-earth-moon-wide-fade-rim.png`.
- Playwright CLI mobile screenshot passed: `.codex/shipit-workflows/issue-8-earth-atmosphere-rim/mobile-earth-moon-wide-fade-rim.png`.
- ImageMagick screenshot sanity check passed: desktop `colors=6132 mean=0.0355914`, mobile `colors=6288 mean=0.0416103`.
- `coderabbit --base main --agent` passed with 0 findings.
- `npm run deploy:netlify` passed.

Updated deploy result:
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a330ba9d5b1fb203396ca8b--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a330ba9d5b1fb203396ca8b

## Follow-Up: Edge-Bright Rim And Smoother Geometry

User feedback:
- Reference rim reads better when it is brightest at the outer silhouette and fades inward toward the planet.
- The rim should be rounder and more robust at close zoom.

Changes made:
- Adjusted the rim shader so `edgeGlow` increases toward the limb instead of fading the outside edge away.
- Added a subtle color mix so the strongest edge becomes whiter while the inward fade remains blue.
- Increased atmosphere rim geometry from `48 x 24` to `96 x 48` segments.
- Documented that planet-surface atmosphere tinting should wait for issue #6 day/night material work.
- Commented on GitHub issues #6, #8, and #9 to align future sun direction, atmosphere, clouds, and geometry tuning.

Review status:
- CodeRabbit final-diff review completed with 0 findings.
- Ponytail final-diff review found nothing useful to delete or simplify: Lean already. Ship.
- Normal self-review found no in-scope fixes beyond refreshing stale workflow/docs wording.
- Final validation rerun passed for tests, build, touched-file Biome, and whitespace.

Final Shipit review:
- Supplied findings: none.
- CodeRabbit: `coderabbit --base main --agent` completed with 0 findings.
- Ponytail lens: Lean already. Ship.
- Self-review: the change stays render-only, Earth-only, parented to the Earth mesh, and does not alter simulation, body schema, UI, trajectory, input, or scenario behavior.
- Solution retrospect: a separate child rim mesh remains the smallest useful design. Surface atmosphere tinting is intentionally deferred to issue #6, and broader body geometry tuning is deferred to issue #9.
- Residual risk: repo-wide `npx biome check src tests scripts` fails on pre-existing unrelated import-order/CSS formatting issues; touched files pass scoped Biome validation.

Final validation:
- `npm test` passed: 34 files, 205 tests.
- `npm run build` passed; Vite reported the existing chunk-size warning.
- `npx biome check src/scene/createGameScene.ts tests/scene/starfield.test.ts` passed.
- `git diff --check` passed.
- Latest staging deploy before merge passed: https://6a33ba4bee2f6700968f8803--fanciful-bunny-d77b4b.netlify.app.
- After publishing the previously completed local `main` texture/star-rendering history to `origin/main`, rebased this branch onto current `origin/main`.
- Post-rebase validation passed: `npm test` passed with 206 tests, `npm run build` passed, scoped Biome passed after one formatting-only test fix, and `git diff --check` passed.

Latest deploy result before merge review:
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a33ba4bee2f6700968f8803--fanciful-bunny-d77b4b.netlify.app
- Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a33ba4bee2f6700968f8803

## Yeet Notes

- Branch commits after rebase onto current `origin/main`:
  - `2285248 feat(scene): add Earth atmosphere rim`
  - `f426627 docs(shipit): record atmosphere rim PR`
  - `3a52ad1 test(scene): format starfield opacity check`
- Branch pushed: `origin/issue-8-earth-atmosphere-rim`
- PR: https://github.com/chmurson/space-web-game/pull/10
- Post-commit staging deploy: https://6a33bc217ac230090fc5e515--fanciful-bunny-d77b4b.netlify.app
- Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app

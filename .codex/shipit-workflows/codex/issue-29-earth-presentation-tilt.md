# Shipit State

Task: Issue #29 - fixed Earth presentation tilt
Branch: codex/issue-29-earth-presentation-tilt
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
- [ ] Merged to main
- [x] GitHub issue updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline
- Tech note: `docs/tech-notes/2026-06-19-earth-presentation-tilt.md`

## Decisions

- Target GitHub issue: https://github.com/chmurson/space-web-game/issues/29
- In-progress issue comment: https://github.com/chmurson/space-web-game/issues/29#issuecomment-4750715391
- Progress issue comment: https://github.com/chmurson/space-web-game/issues/29#issuecomment-4750799619
- Current issue state: assigned to `chmurson`; enhancement label; no project status.
- Issue #29 has no comments as of intake, so there are no conflicting issue instructions.
- Follow root `AGENTS.md`, `.codex/shipit.config.md`, Shipit, Ponytail, and `game-studio:three-webgl-game` guidance.
- Mark issue in progress before product-code edits by assigning `chmurson` and leaving a start comment because the repo has no project status or `in progress` label.
- Keep the change render/presentation-only; do not change simulation plane, orbital mechanics, body data, scenario state, or controls.
- Prefer a small Earth-only orientation policy over generalized axis systems or new scene APIs.

## Open Questions

- None. The issue scope is clear enough to design and implement.

## Validation

- [x] npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts
- [x] npm test
- [x] npm run build
- [x] npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-19-earth-presentation-tilt.md .codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md
- [x] Browser playtest desktop viewport
- [x] Browser playtest mobile viewport
- [x] coderabbit --base main --agent
- [x] npm run deploy:netlify

## Next Step

Commit the feature branch, fast-forward `main`, deploy production, close issue #29, and record final Shipit completion.

## Brainstorm Handoff

Problem:
- Earth currently reads too straight-on relative to the game surface and camera.
- The desired composition should hide the north pole a bit and expose more equator plus some southern hemisphere.

Goals:
- Add a stable, fixed visual Earth tilt in gameplay and menu views.
- Keep the tilt coherent with the current camera angle and a future bottom-of-viewport sunlight/glow direction.
- Keep clouds, atmosphere rim, and Earth surface aligned.

Non-goals:
- No actual Sun object.
- No day/night shading work.
- No simulation-plane or orbital-mechanics changes.
- No change to existing Earth/cloud drift unless the fixed tilt requires a composition adjustment.

User-facing behavior:
- Earth appears slightly leaned away from a north-pole-forward read, with a clearer equator/southern-hemisphere presentation.
- Clouds and atmosphere continue to track the tilted Earth shell.

Edge cases:
- Hidden Earth must remain hidden.
- Menu and gameplay scene setup should use the same fixed presentation policy.
- Existing Earth spin and cloud drift should remain deterministic and visually aligned.

## Design Handoff

Implementation scope:
- Add an Earth-only fixed axial presentation tilt to the existing body rotation policy.
- Apply visual body orientation through a quaternion in `bodyPresentation` so Earth can combine fixed tilt with existing elapsed-time spin.
- Keep cloud drift as a child-local Y rotation so it inherits the tilted Earth parent and stays aligned with the surface shell and atmosphere rim.

Target files:
- `src/presentation/bodyRotation.ts`
- `src/presentation/bodyPresentation.ts`
- `tests/presentation/bodyRotation.test.ts`
- `docs/tech-notes/2026-06-19-earth-presentation-tilt.md`

Data/render flow:
- `bodyPresentation.updateVisuals` continues to synchronize body position, visibility, labels, and indicators.
- Earth mesh quaternion becomes `fixed tilt * elapsed spin`.
- Moon and other bodies keep their existing Y-axis visual orientation behavior.
- Cloud shells remain children of Earth and keep their existing slow relative drift.
- Atmosphere rim remains an Earth child mesh, so it inherits the parent tilt automatically.

Risks:
- Euler `rotation.y` alone cannot represent a stable off-axis Earth tilt plus spin without losing clarity.
- A wrong tilt direction could show more north pole instead of less, so tests should assert the north axis leans away from the camera-side X/Z direction.
- The visual target still needs browser screenshot checks because the exact composition is perceptual.

Test strategy:
- Unit-test the Earth tilt angle and direction in the pure presentation policy.
- Keep existing Earth spin, cloud drift, and Moon tidally locked tests.
- Use build/typecheck for integration.
- Use desktop and mobile browser checks for visual composition and nonblank rendering.

Completion criteria:
- Earth has a fixed render-only tilt in menu and gameplay scene updates.
- Earth surface, clouds, and atmosphere rim stay in one tilted shell.
- Existing moon orientation, cloud drift, labels, indicators, physics, and trajectories remain unchanged.

## Task Slices

- [x] Add a fixed Earth tilt quaternion policy with focused tests.
- [x] Apply body visual orientation by quaternion in presentation sync.
- [x] Add the required tech note.
- [x] Run focused tests, full validation, browser checks, CodeRabbit, and staging deploy.

## Implementation Handoff

Changed files:
- `src/presentation/bodyRotation.ts`
- `src/presentation/bodyPresentation.ts`
- `tests/presentation/bodyRotation.test.ts`
- `docs/tech-notes/2026-06-19-earth-presentation-tilt.md`
- `.codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md`

Completed behavior:
- Added an Earth-only fixed `23.5` degree presentation tilt that leans the north pole away from the camera-side X/Z plane direction.
- Composed Earth orientation as fixed tilt plus elapsed-time visual spin.
- Switched body mesh visual orientation application from Y-only Euler assignment to the shared quaternion policy.
- Kept Moon tidally locked orientation, default body orientation, Earth cloud drift, labels, indicators, trajectories, and simulation state unchanged.
- Added unit coverage for tilt angle, tilt direction, and stable spin axis.
- Added the required dated tech note.

Deviations from design:
- None.

Blockers:
- None.

Known gaps:
- The final look still needs desktop and mobile browser screenshot checks because the tilt target is visual/compositional.

Validation results so far:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed: 1 file, 9 tests.

## Cleanup Notes

Cleanup performed:
- Ran Biome safe formatting on touched source/test files.
- Kept the tilt policy in the existing `bodyRotation` presentation helper instead of adding a new scene API or body-axis abstraction.
- Removed failed first-pass screenshots that were caused by a headless Chrome `--disable-gpu` flag disabling WebGL.
- Kept valid CDP desktop and mobile screenshots as browser evidence:
  - `.codex/shipit-workflows/codex/issue-29-earth-presentation-tilt/desktop-earth-moon-cdp.png`
  - `.codex/shipit-workflows/codex/issue-29-earth-presentation-tilt/mobile-earth-moon-cdp.png`

Cleanup intentionally skipped:
- No shared quaternion factory or generalized seasonal-lighting model; issue #29 only needs Earth presentation tilt.
- No scene graph changes; Earth clouds and atmosphere already inherit the parent mesh transform.

Stale artifacts/docs:
- None.

Additional validation results:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed after formatting: 1 file, 9 tests.
- `npm test` passed: 37 files, 232 tests.
- `npm run build` passed. Vite emitted the existing large chunk warning.
- `npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-19-earth-presentation-tilt.md .codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md` passed for the 3 configured Biome-tracked files.
- `git diff --check` passed.
- Desktop CDP browser check reached `?scenario=earth-moon` with a `1280x800` WebGL canvas, visible HUD, Earth, and Moon label. Console showed only Vite debug messages and the existing missing `favicon.ico`.
- Mobile CDP browser check reached `?scenario=earth-moon` with a `780x1688` backing canvas for a `390x844` viewport, visible HUD, Earth, and Moon label. Console showed only Vite debug messages and the existing missing `favicon.ico`.
- Screenshot sanity check passed:
  - desktop `1280x800`, `colors=5714`, `mean=0.0355668`
  - mobile `780x1688`, `colors=13289`, `mean=0.041324`

## Review Notes

Supplied findings:
- None.

CodeRabbit status:
- `coderabbit --base main --agent` completed with 0 findings.
- Pre-merge rerun on 2026-06-19 completed with 0 findings.

Automated findings:
- None to fix or skip.

Ponytail lens outcome:
- Lean enough. No dependency, scene ref, asset pipeline, generalized axis system, or seasonal-lighting abstraction was added.
- The new quaternion helper is production-used by `bodyPresentation` and avoids per-frame allocations while keeping the existing rotation policy boundary.

Self-review outcome:
- Verified the change is render-only and does not mutate simulation bodies, scenario state, controls, trajectories, labels, or physics.
- Verified Earth orientation composes fixed tilt with elapsed-time spin, while Moon/default body Y rotations keep existing behavior.
- Verified Earth cloud drift remains child-local and the atmosphere rim/cloud shell inherit the tilted Earth parent.
- Verified tests cover tilt angle, tilt direction, stable spin axis, existing Earth spin, cloud drift, and Moon texture orientation.
- Verified browser screenshots show visible tilted Earth with aligned clouds/rim and no HUD overlap issues on desktop or mobile.

Solution retrospect:
- The implementation is still the smallest correct shape after seeing the full diff: add one Earth-only quaternion policy and use it in existing presentation sync.
- A generalized body-axis model or future sunlight/day-night path would be premature; issue #6 can own that when needed.
- No rewrite or broader refactor is justified.

Requirement coverage:
- Earth has a stable fixed visual tilt in gameplay checks.
- The visible composition de-emphasizes the north-pole-forward read and exposes more equator/southern hemisphere.
- Clouds, atmosphere rim, and Earth surface remain aligned through the Earth parent mesh.
- Desktop and mobile browser screenshots/checks cover the affected view.

Residual risk:
- There is no automated golden-image assertion for the exact visual composition. Unit tests cover the transform direction, and browser screenshots cover the rendered result.
- The shared staging URL can be overwritten by later non-main deploys; the unique deploy URL remains tied to this validation run.

Final validation results:
- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts` passed: 1 file, 9 tests.
- `npm test` passed: 37 files, 232 tests.
- `npm run build` passed locally and during Netlify deploy. Vite emitted the existing large chunk warning.
- `npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-19-earth-presentation-tilt.md .codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md` passed for the 3 configured Biome-tracked files.
- `git diff --check` passed.
- Desktop and mobile CDP browser checks passed with screenshots in `.codex/shipit-workflows/codex/issue-29-earth-presentation-tilt/`.
- `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` deployed staging URL https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL https://6a351d079be61703af22d1b7--fanciful-bunny-d77b4b.netlify.app.
- Pre-merge reruns on 2026-06-19 passed:
  - `git diff --check`
  - `coderabbit --base main --agent`: 0 findings
  - `npm test`: 37 files, 232 tests
  - `npm run build`: passed with the existing large chunk warning

GitHub issue update:
- Left progress comment https://github.com/chmurson/space-web-game/issues/29#issuecomment-4750799619.
- Issue remains open because commit/PR/merge has not been requested yet.

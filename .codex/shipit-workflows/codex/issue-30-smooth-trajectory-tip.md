# Shipit State

Task: Issue #30 - Smooth trajectory tip rendering between fixed samples
Branch: codex/issue-30-smooth-trajectory-tip
Current Mode: yeet
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
- [x] PR opened/updated (not requested; direct main merge requested)
- [x] GitHub issue updated

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline
- Tech note: `docs/tech-notes/2026-06-19-smooth-trajectory-tip.md`

## Decisions

- Target GitHub issue: https://github.com/chmurson/space-web-game/issues/30
- In-progress issue comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4751618006
- Progress issue comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4751709806
- High-warp follow-up issue comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4751828322
- Start-anchor follow-up issue comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752014404
- Main-menu start-blend follow-up issue comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752074230
- Final issue close comment: https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752163774
- Merged to `main` in commit `1107055d1077f50f824d13b4ebbc727d533ff5e5` via direct fast-forward merge; no PR was opened for this task.
- Production deploy URL: https://space-web-game.netlify.app
- Unique production deploy URL: https://6a3549fcb8a0ec165596fb0b--space-web-game.netlify.app
- Issue #30 has no comments as of pickup on 2026-06-19, so there are no conflicting issue instructions.
- Final issue state: closed on 2026-06-19 after merge and production deploy.
- Follow root `AGENTS.md`, `.codex/shipit.config.md`, Shipit, Ponytail, and `game-studio:three-webgl-game` guidance.
- Mark issue in progress before product-code edits by assigning `chmurson` and leaving a start comment because the repo has no project status or `in progress` label.
- Keep trajectory calculation, sampling cadence, and simulation state unchanged.
- Keep the smoothing render-only; do not extend rendered trajectories beyond calculated data.
- Prefer the smallest presentation-side trim/cap over a broader prediction scheduler or trajectory data model change.

## Open Questions

- None currently. The issue body is clear enough to design and implement.

## Validation

- [x] Focused tests for trajectory rendering trim/smoothing behavior
- [x] npm test
- [x] npm run build
- [x] npx biome check on touched files
- [x] git diff --check
- [x] Browser playtest with desktop and mobile screenshots
- [x] coderabbit --base main --agent attempted and recorded as stalled
- [x] npm run deploy:netlify

## Next Step

Complete. Issue #30 was reviewed, merged to `main`, deployed to production, and closed.

## Brainstorm Handoff

Problem:
- Trajectory previews are calculated at fixed time intervals such as `1s` or `0.5s`.
- The fixed cadence leaks into presentation: on short, zoomed trajectories, the visible tip jumps forward as new samples arrive.

Goals:
- Keep the existing trajectory sampling and calculation logic unchanged.
- Smooth only the visual progression of the rendered trajectory endpoint.
- Cap or trim the visible trajectory slightly at render time so the tip advances with minimal visible stepping.
- Never render beyond calculated trajectory data.
- Keep behavior consistent for common intervals like `1s` and `0.5s`.

Non-goals:
- No prediction scheduler rewrite.
- No physics/simulation changes.
- No extending or extrapolating the trajectory beyond known samples.
- No new visual mode or UI control.

User-facing behavior:
- The path math stays the same, but the visible end of the trajectory should move more smoothly instead of stepping forward in noticeable chunks.

Edge cases:
- Very short trajectories should still render enough visible path to be useful.
- Empty or single-point trajectory data should remain safe.
- Smoothing should be render-only and deterministic from available samples and elapsed render state.

## Design Handoff

Implementation scope:
- Track the visual age of the current trajectory prediction inside `createTrajectoryPresentation`.
- Reset that age whenever the prediction runtime refreshes.
- Before drawing the coast prediction line, trim only the trailing calculated segment by the unrevealed refresh time: `refreshInterval - predictionVisualAgeSeconds`.
- Convert that trim time to sample-segment progress using the existing prediction config `stepSeconds`.
- Use the smoothed point list for the coast line, fade colors, end marker, and impact gradient so visible trajectory elements share one endpoint.
- Keep assisted prediction, inertial debug prediction, circularization lines, prediction sampling, physics, and runtime prediction data unchanged.

Target files:
- `src/presentation/trajectoryLineSmoothing.ts`
- `src/presentation/trajectoryPresentation.ts`
- `tests/presentation/trajectoryLineSmoothing.test.ts`
- `docs/tech-notes/2026-06-19-smooth-trajectory-tip.md`

Data/render flow:
- `trajectoryPredictionRuntime` continues to own calculated prediction points and refresh cadence.
- `trajectoryPresentation.maybeRefreshPrediction(realDt)` increments a local render-age counter and resets it after runtime refresh.
- `updateTargetRelativePredictionVisuals` receives the current prediction config plus visual age.
- A pure smoothing helper returns the same points unless there is enough multi-point data and a positive unrevealed refresh window.
- The renderer never extrapolates. It either keeps calculated points or replaces the final visible point with an interpolation between already calculated points.

Risks:
- Trimming too much could make very short predictions disappear; clamp so at least two points remain visible.
- Endpoint marker and impact gradient can disagree with the line if they do not share the smoothed points.
- A broad scheduler or prediction-data change would violate the render-only requirement.

Test strategy:
- Unit-test the smoothing helper for no-op, partial final-segment trim, common `1s` and `0.5s` sample intervals, and at-least-two-points clamping.
- Run the focused test, full tests, build, Biome check, browser desktop/mobile screenshots, CodeRabbit, and Netlify deploy.

Completion criteria:
- Trajectory calculation and sampling stay unchanged.
- The visible coast trajectory endpoint starts each refresh slightly trimmed and advances toward the calculated endpoint until the next refresh.
- The renderer does not draw beyond calculated data.
- Common `1s` and `0.5s` sample intervals have deterministic smoothing behavior.

## Task Slices

- [x] Add a pure render-only helper that trims the final visible trajectory point by unrevealed refresh time.
- [x] Track prediction visual age in `createTrajectoryPresentation`.
- [x] Apply smoothed coast points consistently to the line, colors, endpoint marker, and impact gradient.
- [x] Add focused unit tests and the required tech note.
- [x] Run validation, browser playtest, CodeRabbit, deploy, and update the issue.

## Implementation Handoff

Changed files:
- `src/app/createAppComponents.ts`
- `src/presentation/trajectoryLineSmoothing.ts`
- `src/presentation/trajectoryPresentation.ts`
- `tests/presentation/trajectoryLineSmoothing.test.ts`
- `docs/tech-notes/2026-06-19-smooth-trajectory-tip.md`
- `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md`

Completed behavior:
- Added a pure render-only smoothing helper that trims the currently unrevealed tail of the final calculated trajectory segment.
- Added a render-only start anchor so the coast trajectory begins at the current target-relative ship position before endpoint smoothing runs.
- Added render-only blending for fixed prediction samples after the live ship anchor, so the main-menu orbit transitions from the previous prediction to the new one over the refresh window instead of snapping at the first calculated sample.
- The helper converts unrevealed prediction seconds to sample-segment progress with the existing `predictionStepSeconds`.
- The unrevealed prediction seconds are calculated as the remaining real-time refresh window scaled by the active time warp, so `x300` / `5m` trims about `120s` after a `0.4s` refresh.
- The trajectory presentation tracks prediction visual age locally and resets it whenever the prediction runtime refreshes.
- The coast line, fade colors, endpoint marker, and impact gradient all use the same smoothed visible point list.
- The renderer only interpolates between existing calculated points and never extends beyond prediction data.
- Prediction sampling, prediction runtime state, physics, assisted prediction, inertial debug prediction, and circularization visuals are unchanged.

Deviations from design:
- Removed the now-redundant original endpoint parameter inside the coast visual update; the smoothed point list owns visible endpoint placement.

Blockers:
- None.

Known gaps:
- Smoothness remains a visual behavior; browser screenshots verify rendered presence, but there is no automated video/golden-frame assertion for tip motion.

Validation results so far:
- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 1 file, 11 tests.
- `npm test` passed: 38 files, 251 tests.
- `npm run build` passed. Vite emitted the existing large chunk warning.
- `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
- `git diff --check` passed.

## Cleanup Notes

Cleanup performed:
- Removed redundant use of `targetRelativePredictionEnd` inside trajectory visual updates after the smoothed visible point list became the single endpoint source.
- Kept smoothing in a small presentation helper instead of changing prediction/runtime data or adding a scheduler abstraction.
- Kept the helper deterministic and dependency-free.
- Added only one app-composition option pass-through for existing `timeWarps`.
- Kept start anchoring in the same pure presentation helper module as endpoint smoothing.
- Kept previous-to-current sample blending in the same helper module; no new presentation scheduler or prediction-runtime API was added.
- Review cleanup: avoided building a temporary previous-prediction point list with an invalid start anchor when current prediction data is empty.

Cleanup intentionally skipped:
- No new config knob; the existing prediction refresh interval and sample step already define the minimum render-only trim.
- No interpolation of assisted, inertial, or circularization lines because issue #30 targets the coast trajectory preview tip.
- No blending of the live ship anchor itself; it must stay locked to the current ship position every frame.

Stale artifacts/docs:
- Added the required dated tech note. No stale docs found.

## Review Notes

Supplied findings:
- None.

CodeRabbit status:
- `coderabbit --base main --agent` connected, set up the review, reached `reviewing`, then emitted repeated review heartbeats without findings output.
- The run was stopped manually after repeated heartbeats. Treat this as a stalled CodeRabbit gate, not a clean CodeRabbit pass.
- Final retry after the review cleanup first returned a recoverable rate limit, then reached `reviewing` and emitted heartbeats without findings output again; it was stopped manually. No CodeRabbit findings were produced.

Automated findings:
- None available because CodeRabbit did not finish.

Ponytail lens outcome:
- Kept the solution render-only: one small presentation helper, no scheduler rewrite, no prediction runtime API expansion, no config knob, and no dependency.
- Removed redundant original-endpoint plumbing once the smoothed visible point list became the endpoint source.
- After the final guard cleanup, no further over-engineering findings remained. Lean already. Ship.

Self-review outcome:
- Verified the diff does not change prediction calculation, sampling cadence, physics, scenario flow, assisted prediction, inertial debug prediction, or circularization visuals.
- Verified smoothing never extrapolates; it either returns calculated points or interpolates between existing points.
- Verified previous-to-current blending keeps point 0 live while blending only fixed prediction samples after the ship.
- Verified the coast prediction line, fade colors, endpoint marker, and impact gradient share the same smoothed visible endpoint.
- Verified very short or invalid inputs stay unchanged instead of hiding the line.
- Fixed a local review cleanup so previous prediction blending is skipped when the current anchored point list is empty.

Solution retrospect:
- The current helper is still the smallest correct shape after seeing the full diff.
- Exposing refresh age from `trajectoryPredictionRuntime` would broaden the runtime API for a presentation concern, so the local presentation-age counter is preferable.
- A config knob is premature; the existing refresh interval and step size already define the trim window.
- Blending the fixed samples after the live ship anchor is smaller than handing the start smoothing to a separate task because it uses the same refresh-age state and visual-only constraints.

Requirement coverage:
- Trajectory gameplay/simulation logic is unchanged.
- The visible endpoint is trimmed only within calculated data and advances toward the calculated endpoint between refreshes.
- The visible trajectory start is locked to the ship while fixed samples after it transition from the previous prediction to the current one.
- Tests cover `1s`, `0.5s`, `x300` / `5m`, start anchoring, and previous-to-current sample blending behavior.
- Desktop, mobile, high-warp, and main-menu browser checks confirm the trajectory renders in the relevant scenarios.

Residual risk:
- CodeRabbit did not complete and produced no findings.
- Smoothness is visual; unit tests cover deterministic trim math, and screenshots cover rendered presence, but there is no automated video/golden-frame assertion for tip motion.
- The shared staging URL can be overwritten by later non-main deploys; the unique deploy URL remains tied to this run.

Final validation results:
- Final rerun after review cleanup:
  - `npm test` passed: 38 files, 251 tests.
  - `npm run build` passed. Vite emitted the existing large chunk warning.
  - `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
  - `git diff --check` passed.
- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 1 file, 11 tests.
- `npm test` passed: 38 files, 251 tests.
- `npm run build` passed locally and during Netlify deploy. Vite emitted the existing large chunk warning.
- `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
- `git diff --check` passed.
- Desktop browser playtest passed on `http://127.0.0.1:5173/?scenario=earth-moon`; screenshot: `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip-desktop.png`.
- Mobile browser playtest passed with `390x844` emulation; screenshot: `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip-mobile-emulated.png`.
- High-warp browser smoke reached `x5m` through keyboard input; runtime snapshot reported `timeWarp: 300`, `timeWarpIndex: 4`; screenshot: `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-start-x5m-desktop.png`.
- Main-menu background browser smoke ran after multiple refreshes with runtime snapshot `appMode: menu`, `scenarioId: menu-background`, `timeWarp: 300`, `viewportSize: 50`; screenshot: `.codex/shipit-workflows/codex/issue-30-main-menu-start-blend-after-refresh.png`.
- Browser console after mobile reload showed only Vite debug connection messages.
- Main-menu console showed only Vite debug connection messages.
- Desktop pre-reload console showed the existing `favicon.ico` 404; network confirmed `GET /favicon.ico [404]`.
- Screenshot sanity check passed:
  - desktop `1000 x 1688`, `colors=13304`, `mean=0.0394729`
  - mobile emulated `780 x 1688`, `colors=13366`, `mean=0.0432238`
  - main menu after refresh `1000 x 800`, `colors=11112`, `mean=0.0473449`
- `coderabbit --base main --agent` stalled in review heartbeats and was stopped; final retry also stalled after a recoverable rate limit; no findings were produced.
- `npm run deploy:netlify` deployed staging URL https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL https://6a3546f667d5ad04692eee7c--fanciful-bunny-d77b4b.netlify.app.
- Staging smoke check passed: `curl -I https://fanciful-bunny-d77b4b.netlify.app` returned `HTTP/2 200`.
- `git switch main && git merge --ff-only codex/issue-30-smooth-trajectory-tip` merged commit `1107055d1077f50f824d13b4ebbc727d533ff5e5` to `main`.
- `git push origin main` pushed `main` to GitHub.
- `npm run deploy:netlify` deployed production URL https://space-web-game.netlify.app and unique deploy URL https://6a3549fcb8a0ec165596fb0b--space-web-game.netlify.app.
- Production smoke check passed: `curl -I https://space-web-game.netlify.app` returned `HTTP/2 200`.

GitHub issue update:
- Left progress comment https://github.com/chmurson/space-web-game/issues/30#issuecomment-4751709806.
- Left high-warp follow-up comment https://github.com/chmurson/space-web-game/issues/30#issuecomment-4751828322.
- Left start-anchor follow-up comment https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752014404.
- Left main-menu start-blend follow-up comment https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752074230.
- Closed issue #30 with final merge/deploy comment https://github.com/chmurson/space-web-game/issues/30#issuecomment-4752163774.

## Follow-Up After User Playtest

Observation:
- User reported that switching time warp to `5m` still shows clear trajectory tip jumps.

Root cause:
- The first implementation trimmed by the real-time refresh window only.
- At `5m` / `x300`, the same `0.4s` real-time refresh window advances about `120s` of simulation, so a `0.4s` prediction-time trim is far too small.

Follow-up implementation scope:
- Keep prediction calculation and refresh cadence unchanged.
- Scale the render-only unrevealed tip trim by the active time warp.
- Clamp large trims so at least two calculated points remain visible.

Follow-up implementation:
- Added `getUnrevealedTrajectoryTipSeconds` so the high-warp trim calculation is explicit and tested.
- Passed existing configured `timeWarps` into `createTrajectoryPresentation`.
- At render time, the remaining refresh window is multiplied by the active time warp before trimming the visible endpoint.

Historical validation for this high-warp follow-up:
- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 1 file, 7 tests.
- `npm test` passed: 38 files, 247 tests.
- `npm run build` passed locally and during Netlify deploy. Vite emitted the existing large chunk warning.
- `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
- `git diff --check` passed.
- Browser smoke reached `x5m` through keyboard input; runtime snapshot reported `timeWarp: 300`, `timeWarpIndex: 4`, and a rendered screenshot was saved to `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip-x5m-desktop.png`.
- Browser console showed Vite debug connection messages and the existing `favicon.ico` 404.
- `coderabbit --base main --agent` reached review mode and stalled with repeated heartbeats again; no findings were produced.
- `npm run deploy:netlify` deployed staging URL https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL https://6a353eb8674021f1431a7e6b--fanciful-bunny-d77b4b.netlify.app.
- Staging smoke check passed: `curl -I https://fanciful-bunny-d77b4b.netlify.app` returned `HTTP/2 200`.

## Follow-Up For Trajectory Start

Observation:
- User asked whether the same smoothing should apply to the start of the trajectory near the ship.

Decision:
- Keep this in issue #30 because it is the same render-only trajectory presentation issue.
- Use the smaller fix: prepend the current target-relative ship position to the rendered coast trajectory, so the line starts on the ship and follows it every frame.

Scope:
- Do not change prediction calculation, sampling, physics, or refresh cadence.
- Keep the endpoint smoothing already added.
- Keep assisted, inertial debug, and circularization lines unchanged.

Implementation:
- Added `getTrajectoryPointsWithStart` to prepend a current target-relative ship start point only when prediction data exists.
- `updateTargetRelativePredictionVisuals` passes the current spacecraft position and target to anchor the rendered coast line.
- Empty prediction data still renders no line.

Historical validation for this anchor-only follow-up:
- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 1 file, 9 tests.
- `npm test` passed: 38 files, 249 tests.
- `npm run build` passed locally and during Netlify deploy. Vite emitted the existing large chunk warning.
- `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
- `git diff --check` passed.
- Browser smoke reached `x5m` through keyboard input; runtime snapshot reported `timeWarp: 300`, `timeWarpIndex: 4`; screenshot saved to `.codex/shipit-workflows/codex/issue-30-smooth-trajectory-start-x5m-desktop.png`.
- Browser console showed only Vite debug connection messages.
- Screenshot sanity check passed: `1000 x 800`, `colors=5545`, `mean=0.0363738`.
- `coderabbit --base main --agent` reached review mode and stalled with repeated heartbeats again; no findings were produced.
- `npm run deploy:netlify` deployed staging URL https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL https://6a3544f8af7c9211c367c6b2--fanciful-bunny-d77b4b.netlify.app.
- Staging smoke check passed: `curl -I https://fanciful-bunny-d77b4b.netlify.app` returned `HTTP/2 200`.

## Follow-Up For Main-Menu Start Blend

Observation:
- User reported the starting point still jumped in the main-menu scenario as time progressed.

Root cause:
- Anchoring the first rendered vertex to the live ship position fixed point 0, but the first fixed prediction samples after the ship still snapped to newly refreshed values.
- The main-menu background orbit is tight enough that this made the trajectory start visibly jump even though the line technically began on the ship.

Decision:
- Keep this in issue #30 because it uses the same render-only trajectory smoothing mechanism.
- Smooth only presentation points. Do not change prediction calculation, sampling cadence, physics, or scenario flow.
- Keep the ship anchor live every frame; blend only the fixed prediction samples after it.

Implementation:
- Added `getBlendedTrajectoryPoints` to blend matching previous and current rendered prediction samples over the refresh window.
- Captured the previous target-relative prediction points when the runtime refreshes, then reset the local prediction visual age.
- `updateTargetRelativePredictionVisuals` now anchors both previous and current point lists to the live ship position, blends samples after point 0, then applies the existing high-warp endpoint trim.
- If the previous point shape is missing or mismatched, rendering falls back to the current points instead of guessing.

Validation:
- `npx vitest run --config vite.config.ts tests/presentation/trajectoryLineSmoothing.test.ts` passed: 1 file, 11 tests.
- `npm test` passed: 38 files, 251 tests.
- `npm run build` passed locally and during Netlify deploy. Vite emitted the existing large chunk warning.
- `npx biome check src/app/createAppComponents.ts src/presentation/trajectoryLineSmoothing.ts src/presentation/trajectoryPresentation.ts tests/presentation/trajectoryLineSmoothing.test.ts docs/tech-notes/2026-06-19-smooth-trajectory-tip.md .codex/shipit-workflows/codex/issue-30-smooth-trajectory-tip.md` passed for the 4 configured Biome-tracked files.
- `git diff --check` passed.
- Browser smoke on the main menu ran after multiple refreshes with runtime snapshot `appMode: menu`, `scenarioId: menu-background`, `timeWarp: 300`, `viewportSize: 50`; screenshot saved to `.codex/shipit-workflows/codex/issue-30-main-menu-start-blend-after-refresh.png`.
- Main-menu screenshot sanity check passed: `1000 x 800`, `colors=11112`, `mean=0.0473449`.
- Browser console showed only Vite debug connection messages.
- `coderabbit --base main --agent` reached review mode and stalled with repeated heartbeats again; no findings were produced.
- `npm run deploy:netlify` deployed staging URL https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL https://6a3546f667d5ad04692eee7c--fanciful-bunny-d77b4b.netlify.app.
- Staging smoke check passed: `curl -I https://fanciful-bunny-d77b4b.netlify.app` returned `HTTP/2 200`.

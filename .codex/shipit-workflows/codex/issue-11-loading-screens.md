# Shipit State

Task: Issue #11 Add boot and scenario asset loading screens
Branch: codex/issue-11-loading-screens
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
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Issue URL: https://github.com/chmurson/space-web-game/issues/11
- Picked issue #11 because it is the newest open unassigned issue.
- Read the issue body and all comments before implementation. There are no comments as of 2026-06-18.
- Scope is clear enough to enter design: add a static boot screen, an in-app scenario loading overlay, a simple scenario asset manifest/cache, preload Earth/Moon body textures before scenario presentation, and handle failures without a stuck overlay.
- Apply the Ponytail lens throughout: no full asset manager, no progress bars, no new heavy dependencies, no simulation-loader coupling, and no speculative asset pipeline.
- Branch was created from `origin/main` because local `main` is checked out in another worktree.
- Planning/setup only so far; no tests, build, or deploy are required until executable or user-visible code changes are made.
- Deployed to woven-moth staging: https://space-web-game-woven-moth.netlify.app
- Unique deploy: https://6a3401315c898e17bdbdacd2--space-web-game-woven-moth.netlify.app
- Issue progress comment posted: https://github.com/chmurson/space-web-game/issues/11#issuecomment-4743001423
- User reported that previous-scenario visuals remain visible behind the loading overlay; accepted follow-up is to blur/dim the background while loading.
- Blur follow-up deployed to woven-moth staging: https://space-web-game-woven-moth.netlify.app
- Blur follow-up unique deploy: https://6a340a0c45409e3c4928aca6--space-web-game-woven-moth.netlify.app
- Blur follow-up issue comment posted: https://github.com/chmurson/space-web-game/issues/11#issuecomment-4743359282
- User requested a delayed fade-in for the initial HTML boot loading state; accepted follow-up is a CSS-only delayed fade for the boot panel so fast startup avoids a spinner flash.
- Delayed boot fade follow-up deployed to woven-moth staging: https://space-web-game-woven-moth.netlify.app
- Delayed boot fade unique deploy: https://6a340bddf2ddbc3faac28bbf--space-web-game-woven-moth.netlify.app
- Delayed boot fade issue comment posted: https://github.com/chmurson/space-web-game/issues/11#issuecomment-4743431588

## Open Questions

- none for intake

## Validation

- [x] `npx vitest run --config vite.config.ts tests/render/scenarioAssets.test.ts tests/scene/starfield.test.ts`
- [x] `npx biome lint src/main.ts src/app/createGameApp.ts src/app/createAppComponents.ts src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts src/runtime/highLevelActions/registerHighLevelActions.ts src/render/scenarioAssets.ts src/scene/createGameScene.ts src/ui/createScenarioLoadingOverlay.ts tests/render/scenarioAssets.test.ts tests/scene/starfield.test.ts`
- [x] `git diff --check`
- [x] `npx biome lint src/style.css`
- [x] `npm run build`
- [x] `npm test`
- [x] Browser verification for desktop boot/menu/loading overlay/tutorial and mobile tutorial startup
- [x] Browser verification for blurred desktop loading overlay with Moon texture paused
- [x] Browser verification for delayed initial boot panel fade with `/src/main.ts` paused
- [x] `coderabbit --base main --agent`
- [x] `npm run deploy:netlify`

## Brainstorm Handoff

Problem:
- Initial page load can show a blank or partially initialized page before the web bundle, Three.js runtime, and visual assets are ready.
- Scenario transitions can present missing or half-loaded visuals when scenario-specific assets are still loading.

Goals:
- Avoid a white screen during initial page load.
- Show a small branded boot/loading state before app runtime readiness.
- Add a reusable in-app loading overlay for scenario transitions.
- Ensure known scenario assets load before a scenario is presented as playable.
- Keep loading concerns at the app/scenario boundary, outside simulation logic.
- Cache loaded assets or load promises so repeat scenario entry does not duplicate work.

Non-goals:
- No large asset pipeline.
- No progress bars until asset counts justify them.
- No simulation state in the loader.
- No blocking the main menu on gameplay-only assets unless the menu background uses them.
- No new heavy dependencies.

Acceptance criteria:
- Initial page load shows a deliberate boot/loading screen instead of a white screen.
- Tutorial, free roam, saved scenario load, and relevant transitions show an in-app loading overlay if assets need preparation.
- Earth/Moon textures are loaded before the scenario is shown as ready, or a deliberate fallback is used if loading fails.
- Restarting or re-entering a scenario reuses cached assets.
- Loading failures fall back gracefully instead of leaving the user stuck behind the overlay.
- Relevant build/tests pass.
- Browser verification covers at least one desktop viewport and one mobile viewport.

## Design Handoff

Implementation scope:
- Add critical boot-screen markup and CSS to `index.html` so the browser shows an intentional loading state before the Vite bundle executes.
- Make `createGameApp` preload startup scenario assets before constructing the scene, then remove the boot screen after the app has initialized and the frame loop has started.
- Add a render-side scenario asset manifest/cache keyed by scenario id and stable logical asset keys. Keep it to body diffuse textures for this pass.
- Change `createGameScene` so it receives already-loaded body textures and no longer starts `TextureLoader.load` internally.
- Add a small helper that applies newly loaded body textures to existing body meshes after scenario transitions.
- Add a DOM scenario loading overlay using existing shared glass surface tokens.
- Wrap high-level scenario transitions with load/apply/hide behavior; keep simulation transition functions synchronous and unaware of assets.

Target files:
- `index.html`
- `src/app/createGameApp.ts`
- `src/app/createAppComponents.ts`
- `src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/render/scenarioAssets.ts`
- `src/scene/createGameScene.ts`
- `src/ui/createScenarioLoadingOverlay.ts`
- `src/style.css`
- focused tests under `tests/render` and `tests/scene`
- dated tech note under `docs/tech-notes`

Risks:
- The scene is created once, so later transition preloads must apply assets to existing meshes instead of relying on scene reconstruction.
- Async high-level actions must not leave the menu hidden or the loading overlay stuck if a saved snapshot is unavailable or an asset fails.
- Startup should still proceed with color fallbacks if texture loading fails.

Validation plan:
- Focused scenario asset cache tests.
- Existing scene tests updated to prove `createGameScene` uses provided textures without internal async loads.
- Full `npm test` and `npm run build`.
- Browser desktop and mobile checks for boot/menu/transition overlay behavior.
- CodeRabbit review and staging deploy before handoff.

Completion criteria:
- Boot screen is visible before bundle startup and removed only after app startup completes.
- Scenario transitions preload relevant body textures through the manifest/cache and do not duplicate cached loads.
- Earth/Moon texture failures resolve to color fallback rather than blocking the game.
- UI overlay is compact, themed, and does not persist after transitions.
- Tests/build/browser verification pass and staging is deployed.

## Task Slices

- [x] Add render-side scenario asset manifest/cache and focused tests.
- [x] Move body texture application out of `createGameScene` async loading.
- [x] Add static boot screen and runtime removal.
- [x] Add scenario loading overlay and wrap high-level transitions.
- [x] Add tech note and update Shipit implementation notes.
- [x] Run validation, review, browser playtest, and staging deploy.

## Implementation Handoff

Changed files:
- `index.html`
- `src/main.ts`
- `src/app/createGameApp.ts`
- `src/app/createAppComponents.ts`
- `src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts`
- `src/runtime/highLevelActions/registerHighLevelActions.ts`
- `src/render/scenarioAssets.ts`
- `src/scene/createGameScene.ts`
- `src/ui/createScenarioLoadingOverlay.ts`
- `src/style.css`
- `tests/render/scenarioAssets.test.ts`
- `tests/scene/starfield.test.ts`
- `docs/tech-notes/2026-06-18-loading-screens-assets.md`
- `.codex/shipit-workflows/codex/issue-11-loading-screens.md`

Completed behavior:
- Added a static boot screen in `index.html` with critical CSS, shown before the app bundle runs.
- `createGameApp` now preloads startup scenario assets before constructing the Three.js scene and removes the boot screen after initialization/start.
- Added `src/render/scenarioAssets.ts` with a tiny scenario manifest and promise cache for Earth/Moon diffuse textures.
- `createGameScene` now consumes preloaded body textures and no longer starts `TextureLoader.load` internally.
- Added `applyBodyTextureAssetsToScene` so later scenario preloads can update the existing one-time scene meshes.
- Added a compact DOM scenario loading overlay using shared glass UI tokens.
- The scenario loading overlay now blurs and dims the live scene behind it.
- The initial HTML boot panel now fades in after a short delay while the dark boot backdrop remains immediate.
- Wrapped high-level scenario transitions for free roam, tutorial, saved snapshot load, return to menu, restart, and checkpoint restore with load/apply/hide behavior.
- Loading transitions gate gameplay input and frame advancement while in progress.
- Added focused tests for asset manifest/cache behavior and scene texture consumption.
- Added the required tech note.

Deviations:
- The overlay is indeterminate; progress bars remain a non-goal for this pass.
- `menu-background` preloads Earth only; Moon loads on first gameplay scenario transition and is then cached.
- Checkpoint restore from an active prompt keeps the existing prompt-specific path, but high-level checkpoint restore goes through the loading guard.

Blockers:
- none

Known gaps:
- none before commit/PR

## Cleanup Notes

Cleanup performed:
- Reverted accidental whole-file formatting churn in `src/style.css` and kept only the loading-overlay CSS block.
- Added a catch path in `GameHighLevelActionsMediator.dispatch` so async high-level transition failures are logged instead of becoming unhandled promise rejections.
- Kept the asset loader as a small module with a manifest and promise cache, not an asset-manager class.
- Kept the loading overlay as one DOM helper and one CSS block, reusing shared UI glass tokens.
- Kept the user-requested blur as CSS on the overlay instead of adding transition state or snapshot machinery.
- Kept the user-requested boot fade as a CSS-only delayed panel animation in `index.html`, with no runtime timer or loader state.
- Kept scenario load/preload behavior at the app/high-level-action boundary; simulation and low-level transition modules remain synchronous.

Cleanup skipped:
- No progress model or progress bar was added because current asset count does not justify it.
- No texture LOD, asset pipeline, dynamic import splitting, or dependency was added.
- No broad UI refactor was done around menus or prompts.

Stale artifacts/docs:
- Added `docs/tech-notes/2026-06-18-loading-screens-assets.md`.
- Screenshot evidence is under `tmp/loading-screens-playtest/` and is not a shipped asset.

## Review Notes

Supplied findings:
- none

CodeRabbit:
- First run found one valid minor issue: the static boot title used a `<p>` where a heading was more semantic.
- Fixed by changing the boot title to `<h1 class="boot-title">Space Web Game</h1>`.
- Final `coderabbit --base main --agent` rerun completed with 0 findings.

Ponytail lens:
- Kept the implementation small: one render-side manifest/cache module, one DOM overlay helper, and no asset manager class.
- Avoided progress bars, texture LOD, dynamic import splitting, dependencies, and simulation-loader coupling.
- Cleanup also removed accidental full-file CSS formatting churn.

Self-review:
- Startup waits for known render assets before scene construction and removes the boot screen only after app initialization/start.
- High-level scenario actions preload assets before switching runtime state, apply loaded textures to existing meshes, and always hide the overlay in `finally`.
- Texture failures resolve to fallback colors and clear the failed cache entry so later transitions can retry.
- Overlay blur/dim happens through CSS backdrop filtering with a darker background fallback.
- Simulation state, scenario state construction, and low-level runtime transitions remain synchronous.
- Existing direct UI action paths for normal start/tutorial/free roam/menu/restart/saved load are covered through high-level actions.

Solution retrospect:
- The current manifest/cache is the right size for two texture assets. A larger asset manager should wait for audio, GLB, or progress-count needs.
- The loading overlay is intentionally indeterminate; asset count is too small for meaningful progress.
- The scene is still created once, so applying assets to existing meshes is simpler than rebuilding scene objects per scenario.

Validation results:
- Focused asset/scene tests passed: 2 files, 12 tests.
- Full `npm test` passed: 35 files, 210 tests.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
- Biome lint passed for touched TypeScript/test files.
- `git diff --check` passed.
- Browser verification passed with headless Chrome/CDP. In-app Browser was unavailable, and Chrome DevTools MCP was blocked by an existing profile lock, so local Chrome was launched with an isolated profile.
- Follow-up blur verification passed with local Chrome/CDP: overlay computed `backdrop-filter: blur(10px) saturate(0.75)` and screenshot evidence was saved to `tmp/loading-screens-playtest/desktop-loading-overlay-blurred.png`.
- Follow-up delayed boot fade verification passed with local Chrome/CDP: the boot panel stayed at opacity `0` initially and after 140ms, then reached opacity `1` after the delayed fade. Screenshot evidence was saved to `tmp/loading-screens-playtest/desktop-boot-delayed-fade.png`.
- `npx biome format index.html` was attempted, but Biome ignores `index.html` under the current repo configuration.
- Staging deploy passed: https://space-web-game-woven-moth.netlify.app.

Residual risk:
- The loading overlay may only appear briefly on fast cached transitions; this is expected.
- Browser verification used local headless Chrome/CDP rather than the in-app Browser because that surface was unavailable.
- Backdrop blur support varies by browser, but the darker overlay background still hides stale scene detail as a fallback.

## Next Step

Commit, push, open PR, merge to `main`, close issue #11, and deploy production.

# Boot And Scenario Asset Loading

Date: 2026-06-18

Branch: `codex/issue-11-loading-screens`

Issue: https://github.com/chmurson/space-web-game/issues/11

Shipit state: `.codex/shipit-workflows/codex/issue-11-loading-screens.md`

## Summary

The app now shows a static boot screen before the Vite bundle runs, then preloads the startup scenario's known render assets before constructing the first Three.js scene.

Scenario transitions now go through a small loading guard that can show an in-app DOM overlay, load scenario assets through a render-side manifest/cache, apply loaded body textures to existing meshes, and then switch runtime state.

## Why

The previous texture path started asynchronous `TextureLoader.load` calls inside `createGameScene`. That let Earth or Moon appear as solid fallback bodies before their diffuse textures arrived.

Issue #11 asks for loading to be intentional and owned at the app/scenario boundary. The new path keeps simulation state synchronous and moves render asset readiness into app startup and high-level scenario actions.

## Key Files

- `index.html`: static boot screen and critical pre-bundle styles.
- `src/app/createGameApp.ts`: startup scenario asset preload and boot-screen removal.
- `src/render/scenarioAssets.ts`: tiny manifest, logical asset keys, and promise cache.
- `src/scene/createGameScene.ts`: consumes already-loaded body textures and exposes texture application for existing meshes.
- `src/app/createAppComponents.ts`: transition guard that loads assets, applies them, gates gameplay/input, and controls the loading overlay.
- `src/ui/createScenarioLoadingOverlay.ts` and `src/style.css`: reusable compact loading overlay using shared glass UI tokens.

## Decisions

- Kept the manifest intentionally small: current scenario assets are Earth and Moon diffuse textures only.
- Cached load promises by stable logical asset key (`body.earth.diffuse`, `body.moon.diffuse`) so concurrent and repeat transitions do not duplicate loads.
- `menu-background` preloads Earth only. Tutorial, free roam, saved/debug scenarios, and unknown fallback scenarios preload Earth and Moon.
- Texture load failures resolve to an empty asset entry instead of rejecting, so the app keeps using body colors as the fallback. Failed loads clear their cache entry so later scenario entry can retry.
- No progress bars, asset manager class, dynamic import splitting, or new dependencies were added in this pass.
- The scenario loading overlay blurs and dims the previous scene while the next scenario assets load, so stale visuals read as transitional background instead of the next playable state.
- The initial HTML boot panel fades in after a short delay. The dark boot backdrop remains immediate, so quick starts avoid a spinner flash without reintroducing a white screen.

## Validation

- `npx vitest run --config vite.config.ts tests/render/scenarioAssets.test.ts tests/scene/starfield.test.ts`
- `npx biome lint src/main.ts src/app/createGameApp.ts src/app/createAppComponents.ts src/runtime/highLevelActions/gameHighLevelActionDispatcher.ts src/runtime/highLevelActions/registerHighLevelActions.ts src/render/scenarioAssets.ts src/scene/createGameScene.ts src/ui/createScenarioLoadingOverlay.ts tests/render/scenarioAssets.test.ts tests/scene/starfield.test.ts`
- `git diff --check`
- `npm run build`
- `npm test`
- `coderabbit --base main --agent`
- `npm run deploy:netlify`
- Headless Chrome/CDP browser checks with screenshots:
  - desktop boot screen with `/src/main.ts` paused
  - desktop menu after startup
  - desktop tutorial loading overlay with Moon texture paused
  - desktop tutorial after loading
  - mobile tutorial startup at `390x844`
  - desktop loading overlay blur/dim check with Moon texture paused
  - desktop delayed boot panel fade with `/src/main.ts` paused

Screenshot evidence:

- `tmp/loading-screens-playtest/desktop-boot.png`
- `tmp/loading-screens-playtest/desktop-menu.png`
- `tmp/loading-screens-playtest/desktop-loading-overlay.png`
- `tmp/loading-screens-playtest/desktop-tutorial.png`
- `tmp/loading-screens-playtest/mobile-tutorial.png`
- `tmp/loading-screens-playtest/desktop-loading-overlay-blurred.png`
- `tmp/loading-screens-playtest/desktop-boot-delayed-fade.png`

CodeRabbit final rerun completed with zero findings.

Staging deploy:

- https://space-web-game-woven-moth.netlify.app
- https://6a340bddf2ddbc3faac28bbf--space-web-game-woven-moth.netlify.app

## Known Gaps

- The loading overlay is indeterminate. Progress can wait until the app has enough assets to make progress meaningful.
- Checkpoint restore from an active prompt still uses the existing prompt-specific restore path; the active scenario assets should already be cached before that prompt can appear.

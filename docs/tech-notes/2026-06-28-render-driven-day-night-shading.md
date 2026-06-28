# Render-Driven Day/Night Body Shading

Date: 2026-06-28

Issue: #6 Add render-driven day and night shading for bodies

Branch: `codex/issue-6-day-night-shading`

Shipit state: `.codex/shipit-workflows/codex-issue-6-day-night-shading.md`

## Summary

Earth and Moon body rendering now uses scenario-resolved sunlight direction for day/night shading. The default scenario value is `sunlightDirection: { x: 0, y: -1 }`, meaning light travels across the simulation plane in the direction that reads as bottom-left toward top-right with the current camera; internally the renderer converts that to a normalized scene vector with near-zero X and positive Y/Z pointing back toward the light source.

## Why

The textured bodies needed a clearer terminator without making the night side unreadable or tying visual lighting to gravity/physics. This keeps sunlight as a rendering concern while preserving the existing diffuse texture pipeline.

## Runtime Design

- `src/scenario/scenarioRenderConfig.ts` owns the default and normalization for render-only sunlight direction.
- `src/simulation/types.ts` allows scenarios to provide an optional `render.sunlightDirection` without changing body physics fields.
- `src/runtime/createScenarioRuntimeController.ts` resolves scenario render config for startup, scenario loads, and debug snapshot loads.
- `src/scene/createGameScene.ts` keeps `MeshStandardMaterial` as the body material base, then adds a small shader hook for soft day/night mixing and an Earth-only surface limb tint.
- The Earth atmosphere rim shader shares the same sun direction, so the lit edge stays brighter and the night edge is restrained.
- The existing cloud shell shares the day/night shader hook with a lower night-side strength.

## Boundaries

- Simulation forces, body state, saves, and trajectory prediction do not read the render sun direction.
- No full scattering model, post-processing pass, normal map, night-light texture, or new planet renderer was added.
- HUD and trajectory materials were left unchanged so readability is preserved.

## Validation

- `npx vitest run --config vite.config.ts tests/scenario/scenarioRenderConfig.test.ts tests/scene/starfield.test.ts tests/runtime/runtimeStateTransitions.test.ts tests/app/createInitialAppRuntimeState.test.ts` passed.
- `npm test` passed with 51 Vitest files / 337 assertions plus 16 automation-claim tests after rebasing onto `origin/main` commit `9656087`. An earlier pre-rebase `npm test` run hit one transient automation-claim mutex timeout; rerunning `npm run test:automation-claims` and then `npm test` passed.
- `npm run build` passed, including config validation, TypeScript, and Vite release build.
- `npm run test:gui` passed with 25 Playwright mobile Chromium tests.
- `coderabbit --base main --agent` completed with zero findings after local `main` was fast-forwarded to `origin/main`.
- GUI artifacts inspected:
  - `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-d9652-ch-the-Moon-menu-transition-mobile-chromium/mobile-reach-moon-menu.png`
- Targeted Playwright screenshots inspected:
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/desktop-earth-moon.png`
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/desktop-moon-capture-debug.png`
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/mobile-earth-moon.png`
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/debug-earth-elapsed-0.png`
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/debug-earth-elapsed-6h.png`
  - `.codex/shipit-workflows/codex-issue-6-day-night-shading/screenshots/debug-moon-close.png`

The screenshots showed a soft Earth terminator with readable night-side texture, Earth texture rotation changing the lit regions between elapsed `0h` and `6h`, a readable Moon close-up, and no HUD/trajectory contrast regression. Browser console/page-error capture showed no shader compile or page errors; Chromium emitted only screenshot/readback performance warnings during artifact capture.

## Follow-Ups

None known yet.

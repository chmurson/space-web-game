# Tutorial Trajectory Target Switch

## What Changed

- Trajectory prediction state now records the assist target id it was generated for.
- The prediction runtime refreshes immediately when the active assist target differs from the stored prediction target.
- Trajectory presentation hides target-relative prediction visuals when prediction data and the current target do not match.
- Manual target cycling now requests an immediate trajectory refresh.
- Scenario transitions can explicitly request a trajectory refresh, and the tutorial Reach the Moon transition uses that after repositioning the Moon.
- Spacecraft trail rendering now stays inertial during unbound transfers, then switches to target-relative rendering only once the ship is bound to the active target.
- The debug window now has a `Copy State` action that copies a fuller diagnostic payload without rendering all of it in the visible debug JSON.

## Why It Changed

Issue #51 reported twisted or misplaced tutorial trajectory lines after the assist target switched to the Moon. The root cause was stale target-relative prediction data: old relative points could be rendered against a different target, or against the Moon after the tutorial moved it for phase two.

A follow-up debug snapshot showed the same class of visual confusion in the spacecraft trail during the Reach the Moon transfer. The ship was still unbound to the Moon, but trail rendering used the Moon-relative frame because the Moon was the active trajectory target. That made historical transfer samples move into a target-relative frame before capture, so the trail no longer represented the actual transfer path cleanly.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts`: owns prediction target identity and refresh-on-target-change behavior.
- `src/presentation/trajectoryPresentation.ts`: guards rendering against mismatched target-relative prediction state.
- `src/runtime/frameLoop.ts` and `src/runtime/runtimeStateTransitions.ts`: carry scenario refresh requests back to trajectory prediction.
- `src/scenario/specific-scenarios/tutorial/tutorialSceneRouter.ts`: marks the Moon reposition transition as prediction-invalidating.
- `src/runtime/runtimeActions.ts`: requests refresh after manual target cycling.
- `src/presentation/spacecraftTrail.ts` and `src/presentation/spacecraftPresentation.ts`: keep transfer trails in absolute space until target-bound orbit rendering is active.
- `src/ui/debugPanel.ts` and `src/presentation/hudPresentation.ts`: expose the full debug copy payload, including trajectory prediction points.

## Decisions

- Kept target freshness in prediction runtime rather than adding caller-specific guards.
- Used a narrow scenario transition flag instead of refreshing after every scenario state update, because tutorial onboarding progress can change every frame.
- Kept presentation as a render adapter: it refuses mismatched data, but does not decide when prediction state is valid.
- Reused the existing target-bound trail trim gate as the render-frame gate. Unbound transfers render in absolute simulation space; target-bound orbits render in the active target frame and keep the two-loop trimming behavior.
- Kept the visible debug JSON compact and put complete diagnostic data behind `Copy State`, so long trajectory point arrays do not render in the panel every refresh.

## Validation

- `npx biome check` on touched runtime, presentation, scenario, and test files: passed.
- `git diff --check`: passed.
- `npm run test`: 47 files, 309 tests passed after adding the debug copy coverage.
- `npm run build`: passed; Vite reported the existing large chunk warning.
- Local Chrome smoke on `http://127.0.0.1:5173/?scenario=tutorial`:
  - start screenshot: `/tmp/space-web-game-issue51-tutorial-start.png`
  - target cycle screenshot: `/tmp/space-web-game-issue51-after-target-cycle.png`
  - active tutorial target cycle screenshot: `/tmp/space-web-game-issue51-active-target-cycle.png`
  - copy-state debug screenshot: `/tmp/space-web-game-issue51-copy-state-debug.png`
  - devtools bridge target cycling succeeded from Moon to Earth, then Earth to Moon in active tutorial onboarding.
  - intercepted `Copy State` clipboard payload included `trajectoryPrediction.targetId`, `targetRelativePredictionPoints`, `absolutePredictionPoints`, tutorial scenario state, and assist target.
  - latest console check showed only Vite connection logs.
- `npm run test:gui`: 7 Playwright GUI tests passed.
  - Inspected artifact: `tmp/playwright-results/mobileHudScreenshot-captur-5be36-ial-coach-prompt-transition-mobile-chromium/mobile-tutorial-coach-prompt.png`; it matched the expected tutorial coach prompt state with no visible overlap.
- `coderabbit --base main --agent`: attempted, but CodeRabbit returned a recoverable rate limit with a wait time of 37 minutes and 30 seconds.
- `coderabbit --base main --agent`: attempted again after adding `Copy State`, but CodeRabbit returned a recoverable rate limit with a wait time of 11 minutes and 27 seconds.
- `npm run deploy:netlify`:
  - Woven moth staging URL: `https://space-web-game-woven-moth.netlify.app`
  - Unique deploy URL: `https://6a3ef41d3e7edee72886dfb9--space-web-game-woven-moth.netlify.app`
- After adding debug `Copy State`:
  - `npm run deploy:netlify`
  - Woven moth staging URL: `https://space-web-game-woven-moth.netlify.app`
  - Unique deploy URL: `https://6a3efa263216d3422b808644--space-web-game-woven-moth.netlify.app`
- After fixing transfer trail frame selection:
  - `npx vitest run --config vite.config.ts tests/presentation/spacecraftTrail.test.ts`: 12 tests passed.
  - `npx biome check --write src/presentation/spacecraftTrail.ts src/presentation/spacecraftPresentation.ts tests/presentation/spacecraftTrail.test.ts`: passed and formatted one touched file.
  - `npm run test`: 47 files, 311 tests passed.
  - `npm run build`: passed; Vite reported the existing large chunk warning.
  - `git diff --check`: passed.
  - Playwright replayed the supplied debug checkpoint through `?scenario=debug-snapshot&devtools`, cycled the active target to Moon, advanced to the unbound transfer at about `5h25m`, and captured desktop/mobile evidence:
    - desktop screenshot: `tmp/trail-bug-moon-desktop.png`
    - desktop debug screenshot: `tmp/trail-bug-moon-desktop-debug.png`
    - mobile screenshot: `tmp/trail-bug-moon-mobile.png`
    - mobile debug screenshot: `tmp/trail-bug-moon-mobile-debug.png`
  - Desktop and mobile screenshots showed a nonblank WebGL scene with the trail aligned behind the spacecraft while Moon remained the selected target.
  - Mobile screenshot showed no HUD overlap with the visible trail.
  - Browser console had no app errors. Desktop emitted only Playwright screenshot `ReadPixels` GPU-stall warnings.
  - A follow-up desktop replay zoomed to `viewportSize: 1000` to match the supplied JSON and captured:
    - desktop max-zoom screenshot: `tmp/trail-bug-moon-desktop-viewport1000.png`
    - desktop max-zoom debug screenshot: `tmp/trail-bug-moon-desktop-viewport1000-debug.png`
  - The max-zoom debug replay reported `trail detail: L1/7 system | slices 6 | render 12 Mm | capture 250 km` with `target: Moon`, and the visible trail stayed aligned behind the spacecraft.
  - `npm run deploy:netlify`
  - Woven moth staging URL: `https://space-web-game-woven-moth.netlify.app`
  - Unique deploy URL: `https://6a3f053490d1d357085e1c1e--space-web-game-woven-moth.netlify.app`

## Follow-Ups

- None currently.

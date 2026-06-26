# Mobile Overheating Starfield Investigation

## What Changed

- Starfield layers with opacity at or below `0.02` are now treated as hidden.
- Hidden starfield layers skip geometry generation and rendering for that update.
- Added focused coverage for the mobile/default gameplay viewport where a nearly transparent starfield layer previously stayed active.

## Why It Changed

Issue #44 reported mobile heat even when main-thread frame CPU time looked low. Local profiling supported the idea that sustained GPU/fill work is a more likely contributor than JavaScript frame time alone:

- A `390x844` mobile viewport at DPR `2` creates a `780x1688` WebGL backing canvas, about `1.32M` pixels per frame.
- The default gameplay viewport could keep the second starfield layer visible at about `1.5%` opacity.
- That near-transparent layer was estimated to represent about `61k` points at the sampled mobile/default viewport, despite adding little visible value.
- Local active panning did not materially worsen frame cadence or draw-call rate versus idle gameplay in headless Chromium.

The change removes a visually negligible draw/build path without changing HUD behavior, game state, physics, controls, or scoring.

## Key Files

- `src/scene/starfield.ts`: owns layered starfield opacity and geometry update behavior.
- `tests/scene/starfield.test.ts`: covers the near-transparent mobile/default layer skip.

## Decisions

- Kept the fix in the starfield owner instead of adding a general renderer quality system.
- Used a small fixed opacity cutoff because layers at or below 2% opacity are effectively invisible against the current dark space background.
- Did not change renderer DPR or antialiasing in this pass. Those are likely stronger power levers, but they have visible quality tradeoffs and need real-device comparison.
- Did not change panning behavior because local profiling did not show panning as materially worse than baseline continuous rendering.

## Validation

- `npx vitest run --config vite.config.ts tests/scene/starfield.test.ts`
- `npm test`
- `npx biome check src/scene/starfield.ts tests/scene/starfield.test.ts`
- `git diff --check`
- `npm run build`
- Local Playwright/Chromium mobile-size profiling on the release preview:
  - baseline and active-panning frame cadence were similar
  - canvas backing size was `780x1688`
  - headless Chromium used SwiftShader, so results are useful for relative comparison, not for real iPhone thermals
- Mobile screenshot inspected: `.codex/shipit-workflows/codex/issue-44-mobile-starfield-check.png`
- `npm run deploy:netlify`
  - Shared staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a3dac454391b38818cdee74--fanciful-bunny-d77b4b.netlify.app`
- After committing and merging latest `origin/main` into the branch:
  - `npm install` synced the newly merged Preact dependencies.
  - `npm test`
  - `npm run build`
  - `git diff --check`
  - `npm run deploy:netlify`
    - Shared staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
    - Unique deploy URL: `https://6a3eaa7a0b48d4112cb40736--fanciful-bunny-d77b4b.netlify.app`
- `coderabbit --base main --agent`
  - Attempted, but CodeRabbit returned a recoverable rate limit with a wait time of about 25 minutes.

## Follow-Ups

- Follow-up issue #52 owns the remaining real-device profiling work: `https://github.com/chmurson/space-web-game/issues/52`.
- Capture real on-device GPU/energy evidence with Safari Web Inspector energy/timeline tooling or an equivalent thermal/power trace before making larger renderer-quality changes.
- If heat remains high, compare renderer DPR caps such as mobile `1.5` versus current DPR `2`, with screenshots to judge visual quality.
- Also compare antialias on/off on real hardware before changing the renderer default.

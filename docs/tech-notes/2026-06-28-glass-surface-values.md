# Glass Surface Value Normalization

## What Changed

- Scenario modal and coach prompt panels now use the shared glass panel border, background, shadow, and blur tokens.
- Scenario prompt buttons now use the shared glass control border and background tokens.
- Touch time-warp feedback pills now use the shared glass panel background and shadow for their base material while preserving state-specific accent rings.
- Legacy menu action buttons now use shared glass control/panel tokens for their common border, fallback background, shadow, and blur.

## Why

Issue #86 follows the #83 design audit. Several glass-like UI surfaces still carried local one-off dark backgrounds, borders, blur values, or shadows. Moving matching base material values to existing shared variables keeps future visual tuning centralized without redesigning the components.

## Key Files

- `src/style.css`: root glass tokens and legacy menu action button styling.
- `src/ui/scenario-prompts/scenario-prompts.css`: modal and coach prompt surfaces and prompt buttons.
- `src/ui/touchControls/swipeTimeWarpControl/swipeTimeWarpControl.css`: transient time-warp feedback pill styling.

## Decisions

- Kept semantic local accents for coach cyan focus, restart amber, blocked time warp amber, and v4 rose feedback.
- Avoided new tokens or helper classes; the existing `--ui-glass-*` variables were enough for this pass.
- Left non-surface effects such as dimming backdrops, text emphasis colors, and transient animation colors outside the cleanup scope.

## Validation

- `npm run test:gui` passed after installing dependencies with `npm ci`.
- Inspected generated Playwright screenshots for the mobile mission menu, tutorial coach prompt, in-game controls menu, and time-warp touch control under `tmp/playwright-results/`.
- Added and inspected a targeted local screenshot for the transient time-warp feedback pill variants at `tmp/playwright-results/issue-86-time-warp-feedback-variants.png`.
- `npm run build` passed. Vite emitted the existing large-chunk warning for the app bundle.
- Staging deploy passed with `npm run deploy:netlify`.
- Staging URL: https://fanciful-bunny-d77b4b.netlify.app
- Unique deploy URL: https://6a4119d67340f479ca1d7fde--fanciful-bunny-d77b4b.netlify.app

## Follow-Ups

- None known.

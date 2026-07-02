# Trajectory Horizon Limit Flag

## What Changed

- Default trajectory prediction horizon maximum is now capped at 48 hours.
- The exact URL flag `nohiroznlimit=1` opts into the configured extended maximum of 3072 hours.
- Netlify PR preview output now includes an extended-horizon flagged preview URL.

## Why

Long prediction horizons are expensive enough to affect normal gameplay smoothness. Keeping ordinary sessions capped at two days protects the default experience while preserving an opt-in review/debug path for longer predictions.

## Key Files

- `src/app/createAppConfigContext.ts` owns URL flag parsing and exposes the capped trajectory maximum to runtime, UI controls, and scenario directive limits.
- `config/base.yml` stores the opt-in maximum used when the flag is enabled.
- `.github/workflows/netlify-pr-preview.yml` owns the stable PR preview summary/comment links.

## Decisions

- The flag spelling intentionally stays `nohiroznlimit=1` to match issue #164.
- The cap is applied once in app config so existing runtime controls and scenario directive constraints continue using the same shared maximum.
- The existing Reach the Moon preview URL remains; the horizon flag gets its own labeled preview URL.

## Validation

- `npx vitest run --config vite.config.ts tests/app/createAppConfigContext.test.ts tests/app/createInitialAppRuntimeState.test.ts` passed, including default capped and flagged extended-horizon app config paths.
- `npm test` passed with 58 Vitest files, 438 tests, plus 16 automation-claim tests.
- `npm run build` passed config validation, TypeScript, and Vite release build; Vite reported the existing large chunk warning.
- `npm run test:gui` passed 36 Playwright tests; inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`.

## Follow-Ups

- None known.

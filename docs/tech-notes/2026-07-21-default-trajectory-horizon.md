# Default trajectory prediction horizon

## What changed

- Updated the base trajectory horizon default from `1` hour to `48` hours (`2d`) in `config/base.yml`.
- Left the minimum horizon (`0.5` hours), ordinary maximum horizon (`48` hours), and extended no-limit maximum (`3072` hours) unchanged.

## Why

The default prediction window should show a two-day trajectory without requiring players to increase the horizon manually at the start of a run.

## Key files

- `config/base.yml`: owns the shared game configuration loaded by development and release builds.

## Validation

- Installed dependencies with `npm install` because this worktree was missing local packages.
- `npm run validate:config` passed.
- `npx vitest run --config vite.config.ts tests/app/createAppConfigContext.test.ts tests/app/createInitialAppRuntimeState.test.ts` passed: 2 files / 12 tests.

## Follow-ups

- None known.

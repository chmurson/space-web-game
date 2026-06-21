# Revert Smooth Trajectory Rendering

## What Changed

- Reverted `1107055` with commit `ad8824e`.
- Removed `src/presentation/trajectoryLineSmoothing.ts`.
- Removed `tests/presentation/trajectoryLineSmoothing.test.ts`.
- Removed the previous smooth trajectory tech note.
- Restored `src/presentation/trajectoryPresentation.ts` to render current
  target-relative prediction points directly.
- Removed the trajectory presentation dependency on configured time-warp values.

## Why

The smooth trajectory tip rendering change was isolated as the behavior to roll
back after staging comparisons. This revert keeps the current `main` baseline
and later HUD/workflow changes, while removing only the smoothing-specific
trajectory behavior from `1107055`.

## Key Files

- `src/presentation/trajectoryPresentation.ts` owns prediction line, endpoint
  marker, assisted line, and impact gradient rendering.
- `src/app/createAppComponents.ts` no longer passes control time-warp values into
  trajectory presentation.
- `src/presentation/trajectoryLineSmoothing.ts` was deleted because the direct
  rendering path no longer needs blended/revealed trajectory point helpers.
- `tests/presentation/trajectoryLineSmoothing.test.ts` was deleted with the
  removed helper.

## Decisions

- Use `git revert` so the branch records the rollback explicitly.
- Keep the revert narrow to `1107055` instead of hand-editing unrelated
  trajectory, HUD, or scenario code.
- Preserve direct target-relative prediction rendering as the current baseline.
- Treat a future smoothing attempt as new work that needs a fresh repro and
  screenshot-backed validation.

## Validation

- `npm test`
  - 37 test files passed.
  - 240 tests passed.
- `npm run build`
  - Config validation, TypeScript, and Vite release build passed.
  - Vite reported the existing large chunk warning.
- Browser smoke on local dev server:
  - Free Roam loaded from the main menu.
  - WebGL canvas filled the desktop viewport.
  - WebGL canvas filled the mobile-sized viewport.
  - Earth, spacecraft marker, target label, HUD pills, and trajectory ring were
    visible without obvious overlap.
  - Console had no runtime errors beyond the existing `/favicon.ico` 404.
- Staging deploy:
  - https://space-web-game-woven-moth.netlify.app
  - Unique deploy:
    https://6a37965fe5c272ab24b99474--space-web-game-woven-moth.netlify.app

## Follow-Ups

- If trajectory smoothing returns, add screenshot or browser-level checks that
  cover endpoint alignment and high time-warp refresh behavior.
- Keep the direct rendering path available as the comparison baseline while
  evaluating any future smoothing implementation.

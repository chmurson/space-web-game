# FPS Meter Effective Budget Warnings

## What Changed

- FPS meter warning colors now compare measured CPU/GPU work against the effective observed frame budget.
- Stable 30 FPS caps with low measured work stay in the safe status instead of turning the meter warning/danger color.
- True over-budget measured work still warns at both 60 FPS and 30 FPS effective budgets.

## Why It Changed

Issue #50 reported a mobile screenshot where the browser appeared capped near 30 FPS:

- `FPS 30.0`
- `frame 33.4ms`
- `cpu 5.3ms`
- `gpu n/a`

The previous status logic treated low FPS itself as danger, even when measured work had plenty of room inside the apparent 33.3 ms cadence. That made system or battery-saver frame caps look like app overload.

## Key Files

- `src/ui/hudText.ts`: owns FPS meter text, graph model, and status color decisions.
- `tests/ui/hudText.test.ts`: covers FPS meter status thresholds.

## Decisions

- Kept the fix in the existing FPS meter status helper.
- Kept the 60 Hz frame budget as the minimum budget so 60 FPS warnings are not loosened.
- Used `1000 / smoothedFps` as the effective budget when observed cadence is lower than 60 FPS.
- Removed warning colors based on FPS alone. Low FPS still appears in the meter text and graph; the color now represents measured work pressure.
- When GPU timing is unavailable, the meter continues to use CPU time as the measured work signal.

## Validation

- `npx vitest run --config vite.config.ts tests/ui/hudText.test.ts`
- `npx biome check src/ui/hudText.ts tests/ui/hudText.test.ts`
- `npm test`
- `npm run build`
- `git diff --check`
- `npm run test:gui`
  - Verified the mobile HUD screenshot suite still rendered the expected menu and control states without layout overlap.
- Local Playwright smoke check of the live FPS meter verified active gameplay renders the meter with `data-status="good"`, `gpu n/a`, and readable text.
- `npm run deploy:netlify`
  - Verified the branch-aware staging deploy completed for manual testing.
- `coderabbit --base main --agent`
  - CodeRabbit reviewed the PR and requested replacing transient validation references with stable summaries; this note was updated accordingly.

## Follow-Ups

- Real-device GPU and energy profiling remains owned by issue #52.
- If GPU timing remains unavailable on common target browsers, future work could add a separate "low FPS, low measured CPU" hint. That should stay separate from warning colors so system frame caps are not presented as app overload.

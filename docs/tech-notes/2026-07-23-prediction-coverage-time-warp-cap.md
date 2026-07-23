# Prediction coverage time-warp cap

Date: 2026-07-23

## What changed

Effective time warp is now bounded by the amount of compatible trajectory
prediction coverage that remains. The runtime divides usable coverage by ten
real seconds, snaps that value down to the configured time-warp ladder, and
combines it with the existing scenario and active-control limits. The strictest
limit wins.

The player's requested warp is retained separately from the effective warp.
When a temporary coverage cap relaxes after a compatible worker baseline is
accepted, the requested warp returns automatically. A warp selection made while
capped replaces the saved request.

The PR follow-up also makes manual-turn release request a fresh long-horizon
baseline. Starting a turn still invalidates incompatible accepted coverage and
uses the active-control cap, but returning to idle no longer leaves the runtime
on the synchronous 600-second fallback and its derived x1m limit. Thrust is no
longer required to rebuild the selected one-hour trajectory coverage.

## Why

High time warp could previously consume an accepted trajectory window faster
than the worker could maintain it. A selected long horizon also did not mean the
whole horizon was currently usable: a one-loop bound prediction, an impact,
hard semantic invalidation, or an exhausted rolling window could leave much
less valid coverage.

The coverage-derived rule keeps roughly ten real seconds of prediction runway
without maintaining a second horizon-to-warp table or inferring pressure from
worker request frequency.

## Ownership and key files

- `src/runtime/trajectoryPredictionRuntime.ts` owns usable coverage. Accepted
  rolling windows continue to report their actual remaining horizon, loop, or
  impact duration; synchronous fallback predictions now report their computed
  duration and termination reason too.
- `src/runtime/timeWarpConstraints.ts` owns the formula, ladder snap, strictest
  constraint selection, and coverage diagnostics.
- `src/runtime/navigationTimeWarpController.ts` owns requested-versus-effective
  warp state, temporary cap restoration, and current constraint diagnostics.
- `src/runtime/frameLoop.ts` synchronizes semantic prediction changes before
  stepping physics, then supplies current compatible coverage to the time-warp
  resolver. This prevents one stale high-warp frame after target, assist,
  horizon, reset, or similar semantic changes.
- `src/runtime/simulationStep.ts` combines coverage, scenario, and active-control
  constraints for the frame.
- `src/runtime/timeWarpFeedbackPolicy.ts`, `src/ui/hudText.ts`,
  `src/presentation/hudPresentation.ts`, and `src/devtools/devtoolsBridge.ts`
  expose the coverage reason and requested/effective/cap/remaining values
  through existing assistive and debug feedback.

## Important decisions

- The policy uses `remainingCoverageSeconds / 10` and the existing configured
  ladder. There is no horizon lookup table.
- A compatible accepted window remains authoritative while trim-and-extend work
  is pending. Pending work and request frequency do not lower warp by
  themselves.
- Hard semantic invalidation clears incompatible accepted coverage before the
  simulation step and immediately uses the fresh synchronous near prediction.
- Worker baseline acceptance is enough to restore the request. Progressive
  refinement is not part of this gate.
- Existing active-control and scenario limits retain priority when they are the
  strictest constraint. The existing 320 ms control-release settle remains;
  coverage-only restoration is immediate.
- Ending an active manual turn forces the same immediate far-prediction request
  used when active thrust ends. The turn itself does not retain incompatible
  coverage or bypass the x15s RCS safety cap.
- Devtools time-warp writes now use the same runtime action/controller path so
  they cannot bypass requested/effective tracking.

## Validation

- Biome passed for all 22 changed source and test files.
- TypeScript `tsc --noEmit` passed.
- Vitest passed all 65 files and 647 tests, including focused coverage for the
  ladder formula, horizon/loop/impact bounds, active replacement work, semantic
  invalidation, request restoration and override, existing stricter limits,
  feedback, debug text, touch status, and devtools.
- The release build passed after validating all three game config files. Vite
  reported only the existing advisory about the main bundle exceeding 500 kB.
- Playwright passed all 82 GUI cases. The RCS integration case verified that a
  stored x30m request restores to the accepted one-hour baseline's x4m cap after
  active-control caps clear.
- The generated RCS and tutorial debug replay screenshots were visually
  inspected. The replay showed requested x30m, effective x8m, two hours of
  coverage, an x8m cap, and the `prediction-coverage` reason without clipping or
  overlap.
- Automation claim-helper tests passed 16/16. The separate workflow-prompt test
  remained 2/3 because current `main` lacks its expected rocket-reaction policy;
  that unchanged repository-policy mismatch is outside issue #286.
- `git diff --check` passed.
- PR follow-up validation added a runtime regression for rebuilding accepted
  coverage after turn release and extended the RCS browser case to restore x4m
  without thrust. Biome passed on the three touched executable/test files,
  Vitest passed 65 files and 649 tests, the release build passed, and the
  focused Playwright case passed. Its x15s mobile screenshot was visually
  inspected without clipping or overlap.

## Follow-ups and known gaps

No follow-up is required for issue #286. The policy intentionally does not add
progressive-refinement gates, worker-frequency counters, new warp/horizon
configuration, or a separately persisted requested-warp field.

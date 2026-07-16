# Far Trajectory Refresh Starvation

## What Changed

- Allowed coasting spacecraft and body drift refreshes to check the existing far prediction cooldown.
- Kept far worker requests blocked until that cooldown expires.
- Kept subsequent coasting drift from replacing pending work while an eligible far request is active.
- Treated the transition from active thrust to coasting as a semantic refresh that queues the completed-burn state even when older far work is still running.
- Invalidated pre-burn worker generations at burn completion so an older coasting result cannot briefly appear current after controls return to idle.
- Added a regression for a 48-hour trajectory at x3600 time warp, where the effective far interval is one real second.
- Added a regression for a short burn ending before its active-thrust far request completes.

## Why It Changed

Near prediction refresh reasons prioritize quantized spacecraft and body changes over the timed refresh reason. Each near refresh also resets the shared elapsed timer. At high time warp, drift can therefore produce a near refresh every frame while preventing `timed-refresh` from ever being selected. Because coasting far work previously accepted only the timed reason, the initial far result could remain stale indefinitely despite its configured cooldown having expired.

Burn completion had a related ordering failure. The release frame was classified as spacecraft drift, so an in-flight active-thrust request prevented the final post-burn state from being queued. The in-flight result could then be rejected after controls returned to idle, while the long coasting cooldown blocked a replacement. The next thrust became the first request carrying the previous burn's final velocity, making the far trajectory appear one action behind.

## Key Files and Ownership

- `src/runtime/trajectoryPredictionRuntime.ts` owns near refresh-reason selection, far request eligibility, cooldown enforcement, and worker scheduling.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` covers the starvation case and verifies that drift before cooldown expiry remains coalesced.

## Decisions

- Reuse the far cooldown measured from the last accepted far calculation instead of adding another timer.
- Let `spacecraft-change` and `body-state-change` poll that cooldown while coasting.
- Do not queue a coasting drift snapshot behind an active far request; active thrust and hard semantic refreshes retain their existing pending-request behavior.
- Track only whether the previous prediction input had active translational thrust, and bypass cooldown once when that thrust ends.
- Reuse the existing semantic generation to reject work that began before the completed burn.
- Keep turn-only input out of the burn-completion rule because it does not change coast velocity.
- Preserve the existing horizon/time-warp matrix, active-thrust cadence, hard semantic refreshes, near prediction behavior, and turn-only control behavior.
- Continue recording request-stage cooldown skips when drift arrives before the far interval expires.

## Validation

- Confirmed the new regression failed before the runtime change: the expected second far request was absent after 1.1 seconds.
- Confirmed the completed-burn regression failed before the runtime change with `pendingFar: false` on thrust release, then strengthened it to reject an older coasting result that spans the burn.
- Confirmed the supplied debug snapshot is a bound, highly eccentric Earth orbit with the ship about 173 degrees retrograde; its next burn must lower orbital energy, providing an unambiguous visual reproduction state.
- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts` passed: 29 tests.
- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/presentation/trajectoryPresentation.test.ts tests/ui/hudText.test.ts` passed: 81 tests.
- `npm test` passed: 60 Vitest files with 534 tests and 16 automation-claim tests.
- `npx biome check src/runtime/trajectoryPredictionRuntime.ts tests/runtime/trajectoryPredictionRuntime.test.ts docs/tech-notes/2026-07-15-far-trajectory-refresh-starvation.md` passed for the supported source and test files.
- `npx --no-install tsc --noEmit` passed.
- `npm run build` passed; Vite retained the existing large-chunk warning.
- `npm run test:gui` passed: 57 Playwright tests. Inspected the generated active-thrust and trajectory-horizon screenshots; both matched their expected control states, while the worker-order regression covers the completed-burn trajectory behavior.

## Follow-Ups and Known Gaps

- Default matrix values still require the device/feel tuning tracked by Issue 193.
- This fix does not add screen-space similarity checks, trim-and-extend reuse, or broader frame-budget scheduling.

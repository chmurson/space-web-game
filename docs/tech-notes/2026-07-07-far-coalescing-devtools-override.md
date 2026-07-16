# Far Prediction Coalescing DevTools Override

## What Changed

- Added a first-pass far prediction coalescing cooldown based on trajectory horizon divided by current time warp.
- Added a nullable global DevTools override for the far coalescing minimum interval in seconds.
- Added runtime diagnostics for the effective interval, override value, skipped count, and last skip reason/stage.
- Added a Sampling panel control in the Space Web Game DevTools extension to enable, edit, apply, and disable the override.

## Why It Changed

Issue 193 needs device testing before final per-horizon/time-warp values are known. The override lets testers tune a single global threshold while keeping the default ratio deterministic and testable.

## Key Files

- `src/runtime/trajectoryPredictionRuntime.ts` owns the default coalescing ratio, skip decisions, and diagnostics.
- `src/presentation/trajectoryPresentation.ts` and `src/runtime/frameLoop.ts` pass current time warp into prediction refresh options.
- `src/devtools/devtoolsBridge.ts` exposes the validated override request.
- `extension/space-web-game-devtools/` owns the Sampling panel controls and version bump.
- `tests/runtime/trajectoryPredictionRuntime.test.ts` and `tests/devtools/devtoolsBridge.test.ts` cover cooldown behavior and bridge validation.

## Decisions

- The default cooldown refreshes after roughly 1/24 of the far horizon has elapsed at the current time warp, with a 0.25-second floor.
- With the current buckets, `x5h + 32d` resolves to a 6.4-second minimum interval.
- `null` disables the override and returns to the default matrix; `0` is a valid override that effectively removes the cooldown.
- Horizon and warp values above the largest configured finite bucket reuse that final row or column.
- Hard semantic refreshes still bypass coalescing: initial/manual refresh, target change, horizon change, sampling change, and assist change. Generic control changes do not; active translational thrust keeps its time-warp-aware cooldown, while only the transition from active translational thrust to coasting bypasses it once to schedule the completed-burn state.
- Coalescing only applies after a far trajectory exists for the current target, so high cooldowns cannot suppress the first visible far path.
- Routine spacecraft/body drift can be coalesced.
- Worker-error recovery keeps using the pending request path.

## Validation

- `npx --no-install tsc --noEmit`
- `npx vitest run --config vite.config.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/presentation/trajectoryPresentation.test.ts tests/ui/hudText.test.ts`
- `npm run build`
- `npx biome check --write src/runtime/trajectoryPredictionRuntime.ts src/devtools/devtoolsBridge.ts src/presentation/trajectoryPresentation.ts src/runtime/frameLoop.ts src/app/createAppComponents.ts tests/runtime/trajectoryPredictionRuntime.test.ts tests/devtools/devtoolsBridge.test.ts tests/presentation/trajectoryPresentation.test.ts tests/ui/hudText.test.ts`
- `node --check extension/space-web-game-devtools/panel.js`
- Confirmed `dist/space-web-game-devtools-version.json` reports `{"extensionVersion":"0.1.22"}`.
- Deployed to shared staging: `https://fanciful-bunny-d77b4b.netlify.app`.
- Unique deploy: `https://6a4d02386219e12728956b4a--fanciful-bunny-d77b4b.netlify.app`.

## Follow-Ups

- Use desktop/mobile testing to tune the default ratio buckets and floor.
- Add richer per-bucket tooling only if global override testing proves insufficient.

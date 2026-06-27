# Debug Snapshot Assist Target Mode

## What Changed

Debug snapshot saves now include the active assist target index and target selection mode. Debug snapshot loads carry those optional fields through runtime scenario state and apply them after scenario-load cleanup, so a saved manual Moon target remains manual Moon when restored.

## Why It Changed

Follow-up issue #58 found that debug snapshots could preserve the world state but lose `assistTargetSelectionMode`. With auto-targeting enabled, a replayed debug snapshot could select Earth even when the copied state was manually targeting Moon.

## Key Files

- `src/debugScenarioSnapshot.ts` owns snapshot serialization and runtime-scenario reconstruction.
- `src/scenario/runtimeScenario.ts` carries optional snapshot target state into runtime scenario state.
- `src/runtime/createScenarioRuntimeController.ts` and `src/runtime/runtimeStateTransitions.ts` apply snapshot target state during scenario loads.
- `src/app/createInitialAppRuntimeState.ts` applies snapshot target state for `?scenario=debug-snapshot` startup.

## Decisions

- Kept the fields optional to preserve legacy v1/v2 snapshot compatibility.
- Applied restored target state after transient scenario cleanup because cleanup resets target selection mode.
- Kept normal scenario defaults unchanged when no debug snapshot target state is present.

## Validation

- `npx vitest run --config vite.config.ts tests/debugScenarioSnapshot.test.ts tests/scenario/runtimeScenario.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/runtime/runtimeStateTransitions.test.ts`
- `npx biome check src/debugScenarioSnapshot.ts src/scenario/runtimeScenario.ts src/runtime/runtimeActions.ts src/runtime/createScenarioRuntimeController.ts src/runtime/runtimeStateTransitions.ts src/app/createInitialAppRuntimeState.ts tests/debugScenarioSnapshot.test.ts tests/scenario/runtimeScenario.test.ts tests/app/createInitialAppRuntimeState.test.ts tests/runtime/runtimeStateTransitions.test.ts`
- `git diff --check`
- `npm run test`
- `npm run build`

## Follow-Ups

- #59 can add explicit trail render-frame diagnostics to debug state.
- #60 can add a Playwright replay regression on top of the now-faithful debug snapshot target restore.

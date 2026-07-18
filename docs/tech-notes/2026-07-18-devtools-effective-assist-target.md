# DevTools effective assist target snapshots

Issue: https://github.com/chmurson/space-web-game/issues/263

## What changed

- DevTools snapshot construction now receives `GameQueries.getAssistTarget` from app composition.
- `simulation.assistTarget` is derived from that effective target instead of indexing the body array with `assistTargetIndex`.
- Target-dependent prediction sampling diagnostics use the same effective target body.
- `simulation.assistTargetIndex` remains unchanged as the raw stored/manual selection index.
- Focused snapshot coverage now exercises manual selection, automatic selection that differs from the raw index, and a forced target that differs from both.

## Why

`assistTargetIndex` stores the manual selection, but automatic target discovery and scenario directives can choose a different body. Trajectory prediction already resolves those modes through `GameQueries.getAssistTarget()`. DevTools previously bypassed that ownership boundary, so its target label and current integration-step diagnostic could contradict the trajectory runtime.

## Ownership and decisions

- `src/runtime/gameQueries.ts` remains the sole owner of manual, automatic, and forced target resolution.
- `src/app/createAppComponents.ts` passes the existing effective-target getter into the DevTools bridge.
- `src/devtools/devtoolsBridge.ts` consumes the resolved `Body` for all target-derived snapshot fields while continuing to expose raw runtime state separately.
- The snapshot protocol shape is unchanged, so no DevTools extension package files or manifest version needed modification.

## Validation

- `npx vitest run --config vite.config.ts tests/devtools/devtoolsBridge.test.ts` (13 tests passed)
- `npm test` (552 unit tests, 16 automation claim tests, and 3 automation workflow tests passed)
- `npm run build`
- `npx biome check src/devtools/devtoolsBridge.ts src/app/createAppComponents.ts tests/devtools/devtoolsBridge.test.ts`
- `git diff --check`

## Follow-ups and known gaps

- None. The change intentionally does not alter target-selection behavior or unrelated DevTools diagnostics.

# Trail Render Frame Debug State

## What Changed

- Debug copy-state payloads now include `trail.renderFrame`, `trail.renderTargetId`, and `trail.targetBound`.
- The compact visible debug panel trail-detail line now labels the active trail frame, such as `trail frame: inertial` or `trail frame: target-relative Moon`.
- The active trajectory/assist target line is labeled `assist target` so it is not confused with the trail reference frame.
- Focused tests cover both the target-relative and inertial debug outputs.

## Why

Trail diagnostics could previously show `target: Moon` without saying whether the trail itself was rendered in the Moon-relative frame. During unbound transfers, that distinction matters because the active assist target can be Moon while the trail remains inertial. Labeling the target as `assist target` and the frame as `trail frame` keeps that distinction visible in the compact debug panel.

## Key Files

- `src/presentation/hudPresentation.ts`: assembles visible debug JSON and the fuller copy-state payload.
- `src/ui/hudText.ts`: formats compact readable debug lines.
- `tests/presentation/hudPresentation.test.ts`: verifies debug JSON and copy-state fields.
- `tests/ui/hudText.test.ts`: verifies readable debug text for target-relative and inertial frames.

## Decisions

- Reused the existing capture-bound gate, `targetMetrics.specificEnergy < 0`, because `frameLoop.ts` uses the same condition to render trails target-relative.
- Kept the diagnostic on the existing trail-detail line instead of adding a new panel section.
- Did not add a shared render-frame API for this small debug-only diagnostic.

## Validation

- `npx biome check src/ui/hudText.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts docs/tech-notes/2026-06-27-trail-render-frame-debug-state.md`: passed.
- `npx vitest run --config vite.config.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts`: passed, 2 files and 22 tests.
- `npm run test`: passed, 47 Vitest files, 319 app tests, and 16 automation-claim tests.
- `npm run build`: passed.
- `npm run test:gui`: passed, 15 Playwright GUI tests.
- Inspected the generated mobile top-menu GUI screenshot artifact; it matched the expected state without overlap.
- Targeted Playwright debug-panel check passed on `?scenario=moon-capture-debug`; visible debug text included `assist target: Moon`, `trail frame: inertial`, and unbound energy.
- `git diff --check`: passed.
- `coderabbit --base main --agent`: completed with 0 findings.
- Branch-aware staging deploy completed for the configured non-production target; deploy details are recorded in the PR and issue status comments.

## Follow-Ups

- Issue #60 can assert `trail.renderFrame` when adding the Playwright debug replay regression.

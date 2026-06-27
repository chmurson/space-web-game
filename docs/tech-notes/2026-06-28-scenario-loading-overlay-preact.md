# Scenario Loading Overlay Preact Migration

## What Changed

- Moved scenario loading overlay markup from the imperative adapter into `ScenarioLoadingOverlaySurface`.
- Kept `createScenarioLoadingOverlay` as the public adapter with `setVisible(visible, label?)`.
- Preserved the existing overlay selectors, live status semantics, visible attributes, and delayed hidden state.
- Added a focused Playwright adapter check for label updates, visible state, redundant hide, delayed hide, and canceled hide.

## Why It Changed

Issue #77 continues the Preact DOM UI migration from issue #24. The loading overlay was still a small `innerHTML` surface even though nearby menu surfaces already use typed Preact components.

## Ownership Boundaries

- `src/ui/components/ScenarioLoadingOverlaySurface.tsx` owns the typed overlay DOM structure and accessibility attributes.
- `src/ui/createScenarioLoadingOverlay.ts` owns adapter state, the default label, and the 160 ms delayed hide behavior used by CSS transitions.
- Scenario asset loading and scenario transition behavior remain owned by the app/runtime paths and were not changed.

## Decisions

- Reused the existing `createPreactUiSurface` helper instead of adding a loading-specific renderer.
- Kept the adapter contract unchanged and did not add progress state, generic loading abstractions, or design changes.
- Tested through the public adapter in Playwright because the repo does not currently install a DOM environment for Vitest component rendering.

## Validation

- `npm run build` passed.
- `npm test` passed: 47 Vitest files / 319 tests, plus 16 automation-claim tests.
- `npm run test:gui -- tests/gui/scenarioLoadingOverlay.spec.ts` passed.
- `npm run test:gui` passed: 16 mobile Chromium tests.
- `coderabbit --base main --agent` initially found one valid redundant-hide issue; after the fix, a rerun completed with 0 findings.
- Mobile GUI screenshot artifacts were visually inspected through `/tmp/issue-77-gui-contact-sheet.png`; the expected menu/control states rendered without obvious overlap, clipping, or blank output.

## Follow-Ups

- None planned for this issue.

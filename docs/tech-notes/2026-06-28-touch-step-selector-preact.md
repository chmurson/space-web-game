# Touch Step Selector Preact Migration

## What Changed

- The shared touch step selector view now renders its value/current markup through typed Preact components.
- `createStepSelectorControlView` remains the rendering boundary used by `createStepSelectorControl`.
- The root `.touch-step-selector` element still owns animation classes and `--touch-step-selector-drag-progress`.
- Step value rows still use the existing `.touch-step-selector-value-*`, hidden, and disabled CSS classes.

## Why

Issue #96 is part of the broader Preact UI migration. The time warp and trajectory horizon touch controls both depend on this shared vertical selector, so migrating the common view first keeps their wrappers on the existing presenter and gesture contract while moving the shared markup to Preact.

## Key Files

- `src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx` owns the Preact-rendered selector markup and root class/custom-property updates.
- `src/ui/touchControls/stepSelectorControl/createStepSelectorControl.ts` continues to own gesture/session behavior, runtime snapshots, release commit handling, and wrapper-facing control methods.
- `src/ui/touchControls/stepSelectorControl/stepSelectorControlPresenter.ts` continues to own the render-state contract consumed by the view.
- `src/ui/touchControls/stepSelectorControl/stepSelectorControl.css` continues to own the visual and animation hooks preserved by the migration.

## Decisions

- Kept the existing view factory API instead of adding a generic touch-control Preact surface abstraction.
- Rendered Preact children into the existing root element so touch ownership, `setVisible`, and wrapper positioning stay unchanged.
- Kept the root labeled and exposed it as a non-focusable ARIA group so the existing touch-only interaction does not imply unsupported keyboard behavior.
- Preserved the render ordering from `presentStepSelectorControl`: decrease previews render above current and increase previews render below current.
- Preserved hidden and blocked steps through the same CSS classes rather than changing step semantics.
- Did not migrate the time warp or trajectory horizon wrappers; later wrapper migrations can assume the shared step selector markup is already Preact-rendered.

## Validation

- `npx biome check --write src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx docs/tech-notes/2026-06-28-touch-step-selector-preact.md` passed for the TSX file.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npm test` passed: 47 Vitest files, 319 Vitest tests, and 16 automation-claim tests.
- `npm run test:gui` passed: 20 Playwright mobile GUI tests.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`; the selector remained visible, aligned, and unobtrusive after the Preact migration.
- `coderabbit --base main --agent` initially reported one minor accessibility finding; the root selector is now a non-focusable labeled ARIA group, and the final CodeRabbit pass completed with zero findings.

## Follow-Ups

- Complete the dependent time warp and trajectory horizon wrapper migrations tracked by the broader Preact migration work.

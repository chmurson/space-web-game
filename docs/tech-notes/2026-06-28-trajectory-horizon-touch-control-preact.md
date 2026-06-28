# Trajectory Horizon Touch Control Preact Boundary

## What Changed

- Moved the shared touch step selector value stack into a typed Preact render boundary.
- Kept `createStepSelectorControlView` as the stable factory used by both time warp and trajectory horizon controls.
- Kept `createTrajectoryHorizonControl` as the trajectory-specific adapter that maps selector directions to trajectory horizon actions and labels.
- Added direct GUI screenshot coverage for the trajectory horizon reveal panel.

## Why It Changed

Issue #99 migrates the trajectory prediction horizon touch-control UI toward Preact without changing prediction horizon behavior. The trajectory control has no unique value markup; it composes the shared step selector, so the smallest compatible migration is to make that shared selector boundary Preact-rendered and keep the trajectory adapter focused on domain actions.

## Key Files And Boundaries

- `src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx` owns the typed Preact value-stack markup and preserves the existing root element, class hooks, hidden/disabled step classes, and `--touch-step-selector-drag-progress` custom property.
- `src/ui/touchControls/stepSelectorControl/createStepSelectorControl.ts` remains the gesture/model/runtime owner.
- `src/ui/touchControls/trajectoryHorizonControl/createTrajectoryHorizonControl.ts` remains the trajectory horizon adapter for formatting and action mapping.
- `src/runtime/trajectoryHorizonControlPolicy.ts` remains the owner for horizon values, bounds, and preview commitability.
- `src/ui/touchControls/createTouchControls.ts` remains the reveal-panel, side placement, visibility, and gesture-session integration owner.

## Decisions

- Preserved the stable `.touch-step-selector` DOM root outside Preact because gesture code mutates its display and transient animation classes directly.
- Rendered only the selector value stack through Preact, which avoids duplicating trajectory-specific selector markup and keeps time warp using the same shared boundary.
- Added a GUI screenshot for the trajectory reveal state because the trajectory control is hidden by default and the existing time-warp screenshot only covered the other shared selector consumer.
- Did not change trajectory policy, values, formatting, time-warp behavior, reveal tabs, docks, selectors, or CSS visual design.

## Validation

- `npx biome check src/ui/touchControls/stepSelectorControl/stepSelectorControlView.tsx tests/gui/mobileHudScreenshot.spec.ts docs/tech-notes/2026-06-28-trajectory-horizon-touch-control-preact.md` passed.
- `npm run build` passed; Vite reported the existing large chunk warning.
- `npm test` passed: 47 Vitest files / 319 tests plus 16 automation claim tests. An earlier run hit one transient stale-mutex automation-claim timeout, and the rerun passed.
- `npm run test:gui` passed: 21 mobile Chromium checks.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-6fc5d--touch-control-after-reveal-mobile-chromium/mobile-trajectory-horizon-control.png`; the revealed trajectory horizon selector stayed on the right edge, showed the expected cyan `30m` / `1h` / `2h` / `4h` stack, and did not overlap HUD or bottom controls.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`; the shared time-warp selector still rendered correctly.
- `coderabbit --base main --agent` initially found one valid root-sync memoization issue; after the fix, the rerun completed with 0 findings.
- `npm run deploy:netlify` passed and deployed the branch to staging: `https://fanciful-bunny-d77b4b.netlify.app`.

## Follow-Ups

- Issue #96 still tracks the broader shared step-selector migration context. This issue includes the minimal shared boundary required for the trajectory horizon control and should be reconciled with any parallel #96 branch before merging both.

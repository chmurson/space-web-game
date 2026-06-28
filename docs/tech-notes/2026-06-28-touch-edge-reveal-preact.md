# Touch Edge Reveal Preact Shell

## What changed

- Migrated the touch edge reveal control shell to a typed Preact-rendered view.
- Kept the existing imperative `EdgeRevealControl` API, gesture handling, state synchronization, and hosted control ownership in `edgeRevealControl.ts`.
- Added browser coverage for the shell contract, click toggle, tab swipe open, ignored click after swipe, and content swipe close.

## Why it changed

Issue #93 is part of the touch-control Preact migration. The edge reveal shell creates the shared tab/content structure for all mobile touch drawers, so migrating this shell gives later hosted control migrations a Preact-owned wrapper without changing drawer behavior.

## Key files and ownership

- `src/ui/touchControls/edgeRevealControlView.tsx` owns the static Preact shell markup, preserved classes, data attributes, and initial ARIA attributes.
- `src/ui/touchControls/edgeRevealControl.ts` still owns the public control contract, open/available state, placement class updates, CSS custom property sync, and swipe/click event behavior.
- `tests/gui/edgeRevealControl.spec.ts` covers the browser-visible contract and gesture interactions through the public factory.

## Decisions

- Render the shell once and keep dynamic state imperative. The existing controller already owns state transitions and CSS hooks, and making the drawer reactive would increase scope without changing behavior.
- Append hosted content after the Preact shell renders. Hosted controls remain outside this migration slice, matching the issue non-goal.
- Preserve selector and attribute names exactly so CSS, prompts, body presentation, and GUI tests keep their existing hooks.

## Validation

- `npx biome check src/ui/touchControls/edgeRevealControl.ts src/ui/touchControls/edgeRevealControlView.tsx tests/gui/edgeRevealControl.spec.ts`
- `npm run build`
- `npm test`
- `npm run test:gui -- tests/gui/edgeRevealControl.spec.ts`
- `npm run test:gui`
- Inspected the generated touch-control screenshot artifacts:
  - `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png`
- `coderabbit --base main --agent` reported the stale validation placeholder in this note; fixed here.

## Follow-ups

- None.

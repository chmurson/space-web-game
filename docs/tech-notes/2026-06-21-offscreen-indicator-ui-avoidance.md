# Offscreen Indicator UI Avoidance

## What Changed

- Added a placement helper for offscreen body indicators that picks the directional viewport edge from the target direction.
- Measured active HUD, menu, dialog, debug, prompt, and touch-control surfaces as blocker rectangles.
- Clamped indicators along their chosen edge when a blocker would overlap them, instead of hiding them under UI controls.
- Added previous-side hysteresis so an indicator does not flip to the other side of a blocked region until its projected coordinate has moved about two thirds through that region.
- Moved the mobile stacked/two-line indicator decision to use corrected placement after UI blocker avoidance, rather than the original unblocked position.
- Added focused tests for blocked-edge clamping and edge switching.

## Why

Offscreen indicators were below HUD/touch UI in the stacking order and could be placed under controls or drawers. The new placement keeps the directional edge behavior, but moves the indicator along that edge to the nearest visible slot.

## Key Files

- `src/presentation/bodyPresentation.ts` owns DOM blocker measurement and wires resolved coordinates into body indicator rendering.
- `src/presentation/offscreenIndicatorPlacement.ts` owns pure edge selection and blocker-interval avoidance.
- `tests/presentation/offscreenIndicatorPlacement.test.ts` covers the placement math.

## Decisions

- Kept the fix in screen-space placement math instead of raising indicator z-index above controls, because the issue asks indicators to avoid active controls rather than draw over them.
- Used runtime `getBoundingClientRect()` measurements so dynamic surfaces such as opened touch drawers and debug panels are handled without a separate layout registry.
- The placement helper returns the chosen edge so the DOM presenter can remember the previous edge and stabilize same-edge blocker avoidance on later frames.
- The blocked-region switch threshold is `2 / 3`: a label that was above/left of a blocker stays there until its projected position crosses two thirds into the blocked interval; a label that was below/right uses the mirrored one-third threshold before switching back.
- Mobile stacked layout is decided from a blocker-corrected provisional placement, then the final placement is recalculated with the stacked dimensions. One correction pass handles threshold changes without adding a broader layout solver.

## Validation

- `npm test -- tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npm test`
- `npx biome check --write src/presentation/bodyPresentation.ts src/presentation/offscreenIndicatorPlacement.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npx biome check src/presentation/bodyPresentation.ts src/presentation/offscreenIndicatorPlacement.ts tests/presentation/offscreenIndicatorPlacement.test.ts`
- `npx biome lint src tests scripts`
  - Reported existing `lint/complexity/noImportantStyles` warnings in `src/style.css`.
- `npx biome check src tests scripts`
  - Failed on unrelated existing repo-wide import-order/formatting diagnostics plus the existing `src/style.css` `!important` warnings; not changed for this task.
- `npm run build`
- `coderabbit --base main --agent`
  - Initial pass found one weak test assertion; fixed with an exact coordinate expectation.
  - Final passes after hysteresis and corrected stack-threshold changes reported zero findings.
- Headless Chrome visual/geometry checks against `http://127.0.0.1:5173/`:
  - Desktop `1280x720`, `?scenario=earth-moon`: Moon indicator visible with no measured overlap against HUD blockers.
  - Mobile-touch `390x844`, `?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=left&touchWarpSide=right`: Moon indicator visible with no overlap against touch tabs.
  - Mobile-touch target drawer open: Moon indicator moved above the opened drawer content with no measured overlap.
  - Mobile-touch target and warp drawers open, `?scenario=earth-moon&touchBurnSide=right&touchTargetSide=left&touchTrajectorySide=left&touchWarpSide=left`: visible indicator measured zero overlaps against active blockers.
  - Follow-up mobile-touch target and warp drawers open after corrected stack threshold: visible indicator had `mobileStack: true` from corrected placement and measured zero overlaps against active blockers.
- `npm run deploy:netlify`
  - Shared staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Latest unique deploy URL: `https://6a38c8a03457d348b68b384d--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- None currently known.

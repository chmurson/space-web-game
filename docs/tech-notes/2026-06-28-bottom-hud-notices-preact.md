# Bottom HUD Notices Preact Surface

## What Changed

- Moved the bottom HUD notice DOM for fuel depletion, camera unlock, and target recommendation into `src/ui/overlayUI/createBottomHudNoticesSurface.tsx`.
- Updated `createOverlayUi` to create that Preact surface and keep returning the same notice element refs to existing presenters.
- Added a Playwright DOM contract test for the rendered notice classes, accessibility attributes, visibility attributes, and target recommendation controls.

## Why

Issue #78 continues the Preact UI migration by moving low-frequency bottom HUD notice markup out of imperative `innerHTML` construction before tackling higher-churn HUD surfaces.

## Ownership Boundaries

- `createBottomHudNoticesSurface.tsx` owns static markup for `.bottom-pill-area`, `.fuel-depleted-notice`, `.hud-notice-transient`, and `.target-recommendation-notice`.
- `createOverlayUi.ts` still owns aggregate HUD assembly and exposes `OverlayUiRefs`.
- `createTargetRecommendationNotice.ts` remains the presenter owner for recommendation model state, data variant changes, button behavior, and transient hide timing.
- Scenario replay pills, telemetry, touch controls, debug UI, labels, indicators, callouts, and heading target visuals remain outside this migration slice.

## Decisions

- Render `.bottom-pill-area` as the Preact surface root so the migrated notices remain direct children for existing CSS and blocker selectors.
- Keep the presenter imperative. Moving presenter state into Preact would broaden the issue and risk changing existing contracts.
- Keep the Preact host as `display: contents`, matching existing surface adapter usage and avoiding an extra layout box around the fixed HUD area.

## Validation

Planned before handoff:

- `npm test`
- `npm run build`
- `npm run test:gui` with screenshot inspection under `tmp/playwright-results/`
- `coderabbit --base main --agent`
- `npm run deploy:netlify`

## Follow-Ups

- Telemetry and other HUD surfaces are intentionally deferred to their own migration slices.

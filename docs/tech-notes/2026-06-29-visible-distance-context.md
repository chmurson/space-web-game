# Visible Distance Context

Issue: https://github.com/chmurson/space-web-game/issues/47
Branch: `codex/issue-47-visible-distance-context`

## What Changed

- Added a shared distance-context presenter helper for active body altitude and compact orbit context.
- Added current altitude to the target/orbit telemetry pill.
- Reused the existing in-world body label layer as a visible-only anchored tooltip for the active target/orbit body.
- Kept existing offscreen indicator behavior: offscreen indicators still own offscreen body direction and distance, while the anchored tooltip only appears through the visible-body label path.

## Why

Offscreen indicators already gave players distance context before a body entered view, but that context disappeared once the body was visible. The new target/orbit pill keeps altitude always available, and the anchored body tooltip gives the same context at the visible body without adding a larger HUD panel.

## Key Files

- `src/presentation/bodyDistanceContext.ts` owns altitude, Pe, and Ap label formatting.
- `src/presentation/hudPresentation.ts` syncs target pill title, ARIA label, target name, and altitude.
- `src/presentation/bodyPresentation.ts` upgrades the active body's visible label into a distance tooltip.
- `src/runtime/frameLoop.ts` passes only the derived active body context into body presentation.
- `src/ui/components/HudTelemetrySurface.tsx` and `src/ui/overlayUI/createOverlayUi.ts` expose the target altitude DOM ref.
- `src/style.css` keeps the pill and anchored tooltip compact on desktop and mobile.

## Decisions

- Current altitude uses `CaptureMetrics.surfaceDistance`, so the readout is body-surface altitude rather than center-to-center range.
- Bound orbit context uses current osculating two-body Pe/Ap estimates for the active body. Unbound flyby context uses the existing predicted closest approach when it is available and omits Ap.
- Pe/Ap trajectory markers are intentionally not included in this pass; they need placement/crowding rules beyond the small HUD and tooltip change.

## Validation

- `npm run build`: passed. Vite emitted the existing large chunk warning.
- `npm test`: passed, 53 Vitest files with 349 tests plus 16 automation-claim node tests.
- `npm run test:gui`: passed, 25 Playwright tests.
- `coderabbit --base main --agent`: first run completed with two findings. The valid in-scope helper finding was fixed. The other finding targeted `tests/server/reachMoonRunReceipts.test.ts`, which this branch does not touch, so it remains outside issue #47 scope. A rerun after the fix hit the CodeRabbit rate limit.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-37d0d-tor-side-panel-after-reveal-mobile-chromium/mobile-target-selector.png`: target pill collapsed to glyph plus `alt 400 km` without top-bar overlap.
- Inspected `tmp/playwright-results/tutorialTrailDebugReplay-r-a4f42-ate-from-a-fixed-checkpoint-mobile-chromium/tutorial-trail-debug-replay.png`: Moon remained offscreen with its existing offscreen indicator while the target pill showed altitude.
- Captured and inspected `tmp/playwright-results/issue-47-visible-target-tooltip.png`: visible Earth showed `Earth · alt 400 km · Pe 400 km · Ap 400 km`, Earth offscreen indicator stayed hidden, and the Moon offscreen indicator stayed visible.

## Follow-ups

- Add Pe/Ap trajectory markers in a separate issue only if marker placement can stay readable without fighting HUD, touch controls, or trajectory lines.

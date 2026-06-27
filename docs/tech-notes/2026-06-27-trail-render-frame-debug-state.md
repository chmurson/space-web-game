# Trail Render Frame Debug State

## What Changed

- Debug copy-state payloads now include `trail.renderFrame`, `trail.renderTargetId`, and `trail.targetBound`.
- The compact visible debug panel trail-detail line now includes the active trail frame, such as `frame inertial` or `frame target-relative Moon`.
- Focused tests cover both the target-relative and inertial debug outputs.

## Why

Trail diagnostics could previously show `target: Moon` without saying whether the trail itself was rendered in the Moon-relative frame. During unbound transfers, that distinction matters because the active assist target can be Moon while the trail remains inertial.

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

- `npx biome check src/presentation/hudPresentation.ts src/ui/hudText.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts docs/tech-notes/2026-06-27-trail-render-frame-debug-state.md`: passed.
- `npx vitest run --config vite.config.ts tests/ui/hudText.test.ts tests/presentation/hudPresentation.test.ts`: passed.
- `npm run test`: passed, 47 files and 319 tests.
- `npm run build`: passed.
- `npm run test:gui`: passed, 11 Playwright GUI tests.
- Inspected GUI artifact: `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`; matched the expected mobile top-menu state without overlap.
- Targeted Playwright debug-panel check: `tmp/issue-59-debug-panel-release.png`; visible debug text included `frame target-relative Earth` on the trail-detail line and remained readable.
- `coderabbit --base main --agent`: completed with 0 findings.
- Staging deploy: https://space-web-game-woven-moth.netlify.app
- Unique deploy: https://6a402eb24d98cb39a60876ef--space-web-game-woven-moth.netlify.app

## Follow-Ups

- Issue #61 can use these fields to further clarify target-versus-trail wording if more debug panel refinement is needed.
- Issue #60 can assert `trail.renderFrame` when adding the Playwright debug replay regression.

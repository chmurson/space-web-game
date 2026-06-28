# Touch Thrust Control Preact Markup

## What Changed

- Migrated the thrust control's primary track, thumb, and label markup from an imperative `innerHTML` string to a typed Preact component rendered into the existing `.touch-thrust-control` root.
- Renamed the implementation file to `src/ui/touchControls/thrustControl.tsx` so the markup can use the repo's Preact JSX setup.

## Why It Changed

Issue #94 is part of the touch-control Preact migration. The thrust control still had string-built DOM for its main visual surface even though the surrounding UI is moving toward typed Preact-rendered markup.

## Ownership Boundaries

- `src/ui/touchControls/thrustControl.tsx` owns the thrust control root element, Preact-rendered static child markup, gesture sessions, timers, haptics, label visibility, and CSS class/custom-property updates.
- `src/ui/touchControls/touchInteractionModel.ts` remains the behavior/model boundary for thrust visibility, latch state, engaged state, thumb offset, and haptic pulse decisions.
- `src/ui/touchControls/createTouchControls.ts` continues to own shell/reveal composition and virtual keyboard routing.
- `src/ui/touchControls/thrustControl.css` remains the visual design owner for the track, thumb, label, pending fade, docked state, and engaged state.

## Key Decisions

- Kept the existing `.touch-thrust-control` root and rendered Preact children into it, avoiding an extra wrapper that could affect docked or floating layout.
- Left high-frequency gesture updates in the existing imperative path: classes, label text, inline custom properties, and thumb hit testing still use stable DOM refs after the Preact markup is created.
- Did not change thrust hold timing, right-zone hit radius, label copy, haptic behavior, gesture session transitions, `setMainThrust`, or `onUiStateChange` semantics.

## Validation

- `npm test`: passed 47 Vitest files / 319 tests and 16 automation-claim node tests.
- `npm run build`: passed config validation, TypeScript, and Vite release build; Vite reported the existing large chunk warning.
- `npm run test:gui`: passed 20 Playwright GUI tests.
- GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png` shows the docked thrust track/thumb in the expected right-side reveal position with no HUD overlap.
- `npx biome check src/ui/touchControls/thrustControl.tsx docs/tech-notes/2026-06-28-touch-thrust-control-preact.md`: passed for the TSX file; the markdown file is ignored by Biome.
- `coderabbit --base main --agent`: attempted, but CodeRabbit returned a recoverable service rate limit before producing findings.
- `npm run deploy:netlify`: passed for the shared non-main staging target at `https://fanciful-bunny-d77b4b.netlify.app`; unique deploy `https://6a41005aff0f540c331e561c--fanciful-bunny-d77b4b.netlify.app`.

## Follow-Ups

- None known.

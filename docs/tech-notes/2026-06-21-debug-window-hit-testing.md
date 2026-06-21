# Debug Window Hit Testing

## What Changed

- Moved the default desktop debug window from the bottom-left corner to the bottom-right corner.
- Kept the existing mobile debug window placement near the top of the screen.
- Added touch event propagation suppression to the debug panel alongside the existing pointer, mouse, click, and wheel suppression.
- Marked debug toolbar and JSON fold buttons as direct touch manipulation targets.
- Added touch-safe `pointerup` activation for debug controls and the bottom in-game controls menu, while preserving mouse and keyboard click behavior.
- Added focused debug-panel unit tests that verify pointer/touch containment and guard against duplicate synthetic-click activation after a touch tap.

## Why

The desktop debug window used a higher z-index than the HUD and occupied the same bottom-left area as the in-game controls menu. With debug open, clicks intended for the bottom controls or the nested UI settings button could hit debug JSON content instead. Touch interactions inside the debug panel also needed the same isolation as pointer and mouse events so debug controls do not compete with gameplay or HUD listeners.

Follow-up mobile testing showed no remaining visual collision in Chrome DevTools mobile emulation, but DevTools mouse-style clicks are not the same path as a real finger tap. The controls now activate from non-mouse `pointerup` directly, so a touch tap does not depend on the browser later synthesizing a `click`.

## Key Files

- `src/style.css` owns the debug panel placement and touch-action CSS.
- `src/ui/tapSafeButtonHandler.ts` owns shared touch-safe button activation for HUD/debug DOM controls.
- `src/ui/debugPanel.ts` owns debug panel event isolation.
- `src/ui/createInGameControlsMenu.ts` owns the bottom controls menu touch-safe button activation.
- `tests/ui/debugPanel.test.ts` covers the debug panel's event containment behavior.

## Decisions

- The fix moves only the desktop default placement; mobile already keeps the debug panel away from the bottom controls.
- The debug panel remains above HUD layers so its own controls and JSON content stay interactable when it is open.
- Event containment uses `stopPropagation()` only, preserving normal default behavior such as panel scrolling and button activation.
- Touch activation uses non-mouse `pointerup` and suppresses the next synthetic click for the same tap, avoiding both missed taps and double activation.

## Validation

- `npx vitest run --config vite.config.ts tests/ui/debugPanel.test.ts`
- `npx biome check src/ui/debugPanel.ts tests/ui/debugPanel.test.ts`
- `git diff --check`
- `npm test`
- `npm run build`
- Browser desktop check at `http://127.0.0.1:5173/`: with debug open, the bottom in-game controls button hit-tests to the HUD button instead of debug JSON.
- Browser desktop interaction check: opened bottom controls, opened `UI settings`, clicked the debug size button once, and closed the debug window.
- Browser mobile viewport check at `390x844`: medium debug window remains near the top and does not cover the bottom in-game controls button.
- Chrome DevTools mobile emulation at `390x844`: the `UI settings` button is the top hit target across its center and edges.
- Chrome DevTools touch-pointer check: dispatching non-mouse `pointerup` opens `UI settings`; dispatching non-mouse `pointerup` changes debug size once and ignores the following synthetic click; dispatching non-mouse `pointerup` closes the debug window.
- Netlify staging deploy: `https://space-web-game-woven-moth.netlify.app` (`https://6a384be35e379fb3ac250954--space-web-game-woven-moth.netlify.app`)
- Chrome DevTools screenshot review: captured mobile debug-open and controls-open states to confirm the debug panel does not visually cover the bottom controls menu.

## Follow-Ups

- None currently known.

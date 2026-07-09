# Desktop HUD Overlay Scale

## What Changed

Desktop non-game DOM HUD and overlay clusters now use a shared `--desktop-hud-overlay-scale` CSS token set to `1.5` for pointer/hover desktop viewports wider than the mobile breakpoint.

The scale applies to the top menu, telemetry strip, in-game controls menu, bottom HUD pills/notices, scenario loading panel, scenario prompts, UI settings dialog panel, debug panel, and FPS meter. Mobile/touch UI remains on the default `1` scale.

## Why It Changed

Issue #217 reported that desktop HUD and overlay UI felt too small and visually disconnected from the game surface on larger screens. A centralized token keeps the change scoped to DOM UI and avoids touching the Three.js canvas, camera, simulation, body labels, offscreen indicators, or trajectory rendering.

## Key Files

- `src/style.css`: owns the desktop HUD/overlay scale token and the high-level DOM overlay selector list.
- `docs/tech-notes/2026-07-09-desktop-hud-overlay-scale.md`: records the implementation decision and validation.

## Decisions

- Used CSS `zoom` on high-level DOM overlay clusters so existing pixel-based component internals scale together without multiplying individual selectors.
- Kept the media query desktop-only with `min-width: 721px`, `hover: hover`, and `pointer: fine` so the shipped mobile/touch layout remains unchanged.
- Left game-world DOM markers and WebGL rendering out of the selector list.

## Validation

- `npm run build` passed after installing missing worktree dependencies with `npm ci`.
- `npm run test:gui` passed: 48 Playwright GUI tests.
- Inspected generated GUI screenshots:
  - `tmp/playwright-results/desktopNotifications-shows-cef3c-t-bottom-notices-on-desktop-mobile-chromium/desktop-camera-mode-notice.png`
  - `tmp/playwright-results/desktopTargetSelector-open-af22a-metry-button-and-T-shortcut-mobile-chromium/desktop-target-selector-open.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-c8a0e-pened-from-in-game-controls-mobile-chromium/mobile-ui-settings-dialog.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-dc18f--touch-control-after-reveal-mobile-chromium/mobile-thrust-control.png`
  - `tmp/playwright-results/mobileHudScreenshot-captur-51097--touch-control-after-reveal-mobile-chromium/mobile-time-warp-control.png`
- Captured and inspected desktop smoke screenshots:
  - `tmp/manual-checks/issue-217-desktop-ui-scale/desktop-scenario-prompt.png`
  - `tmp/manual-checks/issue-217-desktop-ui-scale/desktop-controls-menu-and-notice.png`
  - `tmp/manual-checks/issue-217-desktop-ui-scale/desktop-ui-settings-dialog.png`
- The desktop smoke script confirmed the scale token was `1.5` and measured the prompt, top HUD, in-game controls, bottom notice, and dialog inside a 1280x720 viewport.

## Follow-Ups

None currently known.

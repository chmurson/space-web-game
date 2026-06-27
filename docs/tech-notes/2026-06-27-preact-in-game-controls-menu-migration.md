# Preact In-Game Controls Menu Migration

## What Changed

- Moved the in-game controls menu markup out of `innerHTML` in `src/ui/createInGameControlsMenu.ts` and into `src/ui/components/InGameControlsMenuSurface.tsx`.
- Kept `createInGameControlsMenu` as the public adapter returning `element`, `close`, and `syncState`.
- Preserved the existing popover selectors, `data-in-game-action` values, camera locked/free-roam switch state, trajectory prediction horizon stepper state, outside-click close, Escape close, and UI settings entry point.
- Added Playwright coverage for the adapter behavior and a mobile GUI screenshot for the open controls menu over the gameplay HUD.

## Why It Changed

This is the next focused slice under #24 after the main menu, crash menu, and top menu migrations. The in-game controls menu is a low-frequency DOM UI surface where players change camera lock/free-roam behavior, open UI settings, and adjust the trajectory prediction horizon.

## Key Files

- `src/ui/components/InGameControlsMenuSurface.tsx` owns the typed Preact-rendered controls menu DOM, labels, ARIA attributes, disabled state, and button callbacks.
- `src/ui/createInGameControlsMenu.ts` owns the adapter contract, state snapshot comparison, runtime action dispatch, document-level outside/Escape listeners, and focus restoration after Escape.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the migrated adapter behavior and the open controls-menu screenshot state.

## Decisions

- Kept the UI settings dialog migration out of this slice because it depends on shared imperative dialog and segmented-control helpers.
- Did not add a generic Preact root, store, menu DSL, dialog abstraction, or focus manager. The existing `createPreactUiSurface` helper is enough for this contained surface.
- Preserved the old factory's low-frequency update boundary: `syncState` computes the view model but only re-renders the Preact surface when camera or trajectory display state changes.

## Validation

- `npx biome check src/ui/createInGameControlsMenu.ts src/ui/components/InGameControlsMenuSurface.tsx tests/gui/mobileHudScreenshot.spec.ts` passed.
- `npm run test` passed: 47 files, 314 tests.
- `npm run test:gui` passed: 13 mobile Chromium tests.
- `npm run build` passed with the existing Vite chunk-size warning.
- `git diff --check` passed.
- `npm audit --omit=dev` passed with 0 production vulnerabilities.
- GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-144e3-menu-open-over-gameplay-HUD-mobile-chromium/mobile-in-game-controls-menu.png`.
- Local preview Playwright smoke passed for desktop and mobile:
  - Desktop verified opening the menu, toggling camera from centered to free-roam, increasing trajectory horizon from `1h` to `2h`, opening UI settings, and Escape focus restoration.
  - Mobile verified the menu opened, showed trajectory controls, and did not overlap the Mission Brief pill.
  - Smoke screenshots inspected:
    - `tmp/playwright-results/manual-desktop-in-game-controls-menu.png`
    - `tmp/playwright-results/manual-mobile-in-game-controls-menu.png`
- CodeRabbit initial review found one valid accessibility issue: the controls toggle button label still said `Open in-game controls` while open. Fixed by making the accessible label state-aware and adding test coverage. A post-fix CodeRabbit rerun hit a rate limit and produced no clean review result.
- `npm run deploy:netlify` passed:
  - Staging URL: `https://fanciful-bunny-d77b4b.netlify.app`
  - Unique deploy URL: `https://6a3fe039093995b7633b1adf--fanciful-bunny-d77b4b.netlify.app`

## Follow-Ups

- Continue #24 with another contained DOM UI surface, likely the UI settings dialog, after this slice lands.

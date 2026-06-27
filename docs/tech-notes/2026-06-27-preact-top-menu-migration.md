# Preact Top Menu Migration

## What Changed

- Moved top menu markup out of `innerHTML` in `src/ui/createTopMenu.ts` and into the typed Preact component `src/ui/components/TopMenuSurface.tsx`.
- Kept `createTopMenu` as the public adapter returning `element`, `close`, and `syncState`.
- Preserved the existing top menu selectors, `data-menu-action` values, ARIA menu roles, debug/FPS checkbox state, confirmation labels, outside-click close, Escape close, roving arrow-key focus, and button focus restoration.
- Added Playwright coverage for the migrated top menu adapter behavior and a mobile GUI screenshot for the open top menu over the gameplay HUD.

## Why It Changed

Issue #56 is the next small follow-up slice under the #24 Preact UI migration umbrella. The top menu was still building its primary markup through string HTML, while main and crash menus had already moved to typed Preact surfaces.

## Key Files

- `src/ui/components/TopMenuSurface.tsx` owns the Preact-rendered top menu DOM, labels, ARIA attributes, disabled load snapshot state, and action callbacks.
- `src/ui/createTopMenu.ts` owns menu state, runtime action dispatch, confirmation state, document-level outside/Escape listeners, roving focus, and the adapter contract consumed by app composition.
- `src/ui/createPreactUiSurface.ts` remains the shared Preact host/render helper. The top menu reuses it and moves its host to the start of `.top-bar` so the existing HUD placement is preserved.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the browser-level top menu behavior and the open-menu screenshot state.

## Decisions

- Did not introduce a generic menu DSL, app-wide Preact root, shared focus manager, or modal/menu framework. The top menu has specific ARIA menu and checkbox behavior, and the smallest maintainable path is a dedicated component plus the existing adapter.
- Did not reuse `MenuSurfacePrimitives` for the top menu. Those primitives fit modal menu panels and action stacks; the top menu needs its existing dropdown sections and `role=menuitemcheckbox` semantics.
- Kept snapshot load availability tied to the same moments as before: refreshed on open and after save/load actions.

## Validation

- `npx biome check src/ui/createTopMenu.ts src/ui/components/TopMenuSurface.tsx tests/gui/mobileHudScreenshot.spec.ts` passed.
- `npm run test` passed: 47 files, 314 tests.
- `npm run test:gui -- --grep "top menu"` passed: 2 mobile Chromium tests.
- `npm run test:gui` passed: 11 mobile Chromium tests.
- `npm run build` passed.
- Chrome DevTools browser smoke passed on `http://127.0.0.1:4173/?reachmoon=1`: opened the top menu during gameplay, verified first-item focus, ArrowDown focus movement, disabled Load debug snapshot state, and Escape close with button focus restored.
- Inspected GUI screenshot: `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`.
- CodeRabbit initial review completed with one finding: arrow-key roving focus included disabled buttons and could get stuck on disabled Load debug snapshot. Fixed by filtering disabled menu items out of the focus list and adding Playwright coverage for skipping disabled Load debug snapshot.
- A post-fix CodeRabbit rerun did not produce output for several minutes after setup and was stopped; no clean post-fix CodeRabbit result was available from that rerun.
- `npm run deploy:netlify` passed and deployed the branch to shared staging:
  - Staging URL: `https://fanciful-bunny-d77b4b.netlify.app` (temporary; may no longer show this branch after later staging deploys)
  - Unique deploy URL: `https://6a3f9676ca43d6c7eedfe9dc--fanciful-bunny-d77b4b.netlify.app` (temporary; may be unavailable after Netlify retention expires)

## Follow-Ups

- Continue #24 with another contained DOM UI surface after review, likely the in-game controls menu or UI settings dialog.

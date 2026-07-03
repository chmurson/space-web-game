# Recent Debug Snapshot Slots

## What Changed

- Added a persistent recent debug snapshot list beside the existing active debug snapshot storage path.
- Saving a debug snapshot still writes the existing localStorage key, and now also prepends a recent entry.
- The recent list keeps the newest 10 entries and drops older entries.
- The top-menu Debug section separates `Load last debug snapshot` from a `Load debug snapshot` picker flow.
- The main menu `Load Game` action now opens a load section with `Load last game`, `Load any game`, and `Back`; `Load any game` opens the same single-select recent snapshot picker pattern.

## Why

Issue #170 asked for the first small slice of a debug snapshot manager: save multiple snapshots in the browser and restore a selected one without changing the existing `?scenario=debug-snapshot` compatibility path.

## Key Files

- `src/debugScenarioSnapshot.ts` owns active snapshot storage plus the persistent recent list and selected-load helper.
- `src/ui/createTopMenu.ts` syncs recent snapshot menu state and reuses the existing `loadDebugSnapshot` action after selected-load writes the active slot.
- `src/ui/components/TopMenuSurface.tsx` renders the last-load action plus the picker/back subflow.
- `src/ui/createMainMenu.ts` syncs the same recent snapshot state for the main menu load flow.
- `src/ui/components/MainMenuSurface.tsx` renders the main-menu load section and single-select picker section.
- `src/style.css` owns the minimal top-menu selector styling.
- `tests/debugScenarioSnapshot.test.ts` covers list capacity, ordering, generated labels, refresh hydration, and selected-load behavior.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the top-menu picker adapter path.

## Decisions

- Recent entries persist in localStorage so the picker remains populated after page refresh.
- Selected-load writes the chosen entry into the existing active snapshot localStorage key, then uses the current runtime load path.
- The owner-requested label changes are UI-only; the active localStorage key and runtime load action names stay unchanged.
- No import, export, or thumbnail support was added.

## Validation

- Targeted unit test passed: `npx vitest run --config vite.config.ts tests/debugScenarioSnapshot.test.ts`.
- Targeted GUI flow check passed: `npx playwright test tests/gui/mobileHudScreenshot.spec.ts --project=mobile-chromium --grep "main menu load state|top menu adapter"`.
- Full test suite passed: `npm run test`.
- Release build passed: `npm run build`.
- GUI suite passed: `npm run test:gui`.
- Post-fix targeted top-menu checks passed: `npx playwright test tests/gui/mobileHudScreenshot.spec.ts --project=mobile-chromium --grep "top menu adapter|captures the mobile top menu open"`.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`; the top-menu main section shows the last-load and picker-entry actions without overlap, and the picker stays hidden until opened.
- Local `coderabbit --base main --agent` connected but stalled during analysis and was interrupted.

## Follow-Ups

- None for this slice.

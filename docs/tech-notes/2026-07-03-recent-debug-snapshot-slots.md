# Recent Debug Snapshot Slots

## What Changed

- Added a current-session recent debug snapshot list beside the existing active debug snapshot storage path.
- Saving a debug snapshot still writes the existing localStorage key, and now also prepends an in-memory recent entry.
- The recent list keeps the newest 10 entries and drops older in-memory entries.
- The top-menu Debug section now includes a compact recent snapshot selector and a load-selected action.

## Why

Issue #170 asked for the first small slice of a debug snapshot manager: save multiple snapshots during one browser session and restore a selected one without changing the existing `?scenario=debug-snapshot` compatibility path.

## Key Files

- `src/debugScenarioSnapshot.ts` owns active snapshot storage plus the in-memory recent list and selected-load helper.
- `src/ui/createTopMenu.ts` syncs recent snapshot menu state and reuses the existing `loadDebugSnapshot` action after selected-load writes the active slot.
- `src/ui/components/TopMenuSurface.tsx` renders the recent snapshot selector.
- `src/style.css` owns the minimal top-menu selector styling.
- `tests/debugScenarioSnapshot.test.ts` covers list capacity, ordering, generated labels, and selected-load behavior.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the top-menu picker adapter path.

## Decisions

- Recent entries are intentionally not persisted across reloads.
- Selected-load writes the chosen entry into the existing active snapshot localStorage key, then uses the current runtime load path.
- No rename, import, export, or thumbnail support was added.

## Validation

- Targeted unit test passed: `npx vitest run --config vite.config.ts tests/debugScenarioSnapshot.test.ts`.
- Full test suite passed: `npm run test`.
- Release build passed: `npm run build`.
- GUI suite passed: `npm run test:gui`.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-open.png`; the recent selector fit the menu without overlap.
- Local `coderabbit --base main --agent` connected but stalled during analysis and was interrupted.

## Follow-Ups

- None for this slice.

# Named and persistent debug snapshot saves

## What changed

- Saving a debug snapshot from the top menu now opens a compact save panel with an editable text input.
- The input starts with the same scenario, phase, and elapsed-time label that previously named entries automatically.
- Custom names are trimmed before storage; blank names fall back to the generated suggestion.
- The ten most recent debug snapshot entries, including their names and captured states, are persisted in browser local storage instead of module memory.
- The main-menu and in-game recent-snapshot selectors now retain their entries after a page refresh.
- Existing browsers with only the legacy active snapshot slot expose that snapshot as a recent choice without requiring a migration action or a new save.
- The debug save keyboard shortcut opens the same naming panel as the top-menu action.
- `?scenario=last-debug-snapshot` now names the active-snapshot startup route explicitly.
- The previously shipped `?scenario=debug-snapshot` route remains a compatibility alias, while new copy and status text use the clearer name.
- A recent snapshot's stable entry ID can be supplied as the `scenario` value to load that exact browser-local save.
- The DevTools extension lists recent snapshot names and timestamps with a **Copy URL** action. Copied links preserve other query parameters, such as `devtools=1`.
- Each DevTools recent-snapshot row also has an **Open URL** action that navigates the inspected game tab to the exact URL while keeping DevTools attached.
- Gameplay shortcuts and physical keyboard controls are ignored while an input, textarea, select, or contenteditable element owns keyboard focus, so editing a snapshot name cannot toggle or steer the game.

## Why

Automatically generated labels are useful defaults but do not describe the intent of a debug checkpoint. More importantly, the recent-snapshot list previously existed only for the lifetime of the loaded JavaScript module. A refresh left the active snapshot loadable while making “Load any game” appear empty. Persisting the bounded list fixes that contradiction and lets custom names remain useful across sessions.

## Key files and ownership

- `src/debugScenarioSnapshot.ts` owns active-snapshot compatibility, recent-entry validation, naming fallback, local-storage persistence, ordering, the ten-entry cap, and selected-entry activation.
- `src/runtime/runtimeActions.ts` creates a snapshot from the current runtime state, exposes its suggested label, saves a supplied name, and reports success or failure through the existing debug status.
- `src/ui/createTopMenu.ts` owns save-panel state, focus, and callbacks; `src/ui/components/TopMenuSurface.tsx` renders the native text input and actions.
- `src/app/createAppComponents.ts` routes the existing save shortcut to the same visible naming flow.
- `src/scenario/runtimeScenario.ts` resolves the active-snapshot URL alias and exact persisted entry IDs.
- `src/devtools/devtoolsBridge.ts` exposes lightweight recent-entry link metadata without serializing saved simulation state.
- `extension/space-web-game-devtools/panel.html`, `panel.css`, and `panel.js` render, copy, and open recent-entry URLs.
- `src/input/bindKeyboardShortcuts.ts` owns the editable-target guard before both manual-control recording and shortcut resolution; `tests/input/bindKeyboardShortcuts.test.ts` covers event-target and focused-element paths.
- The extension panel now renders and handles Open beside Copy URL; `manifest.json` advances to version `0.1.24`.
- `tests/debugScenarioSnapshot.test.ts` covers names, persistence, compatibility fallback, ordering, limits, and loads.
- `tests/scenario/runtimeScenario.test.ts` and `tests/devtools/devtoolsBridge.test.ts` cover URL routing and the metadata-only bridge contract.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the save-panel adapter, a real page-refresh regression, and the rendered mobile state.

## Decisions

- Kept the existing `space-web-game.debugScenarioSnapshot.v1` active slot unchanged so startup and direct “Load last” behavior remain compatible.
- Added one versioned local-storage key for the recent list instead of introducing a storage service or dependency.
- Read the bounded history on demand. Ten entries are small enough that a second in-memory cache would add invalidation behavior without practical benefit.
- Derived entry IDs from `savedAt` and add a collision suffix only when necessary.
- Reused the existing menu panel, field, focus, and glass-surface styling rather than adding a separate dialog system.
- Kept custom names on recent entries rather than changing the snapshot payload versions, since naming is save-list metadata and not simulation state.
- Uses entry IDs rather than custom names in URLs because names may repeat or change independently of the saved state.
- Exact-entry loading activates the selected entry through the same storage path as the existing recent-snapshot menus. Missing or pruned IDs retain the existing unknown-scenario fallback.
- Kept recent snapshot data in the existing DevTools snapshot response and reused the panel's clipboard helper; no content script, new bridge command, or dependency was needed.
- Copied URLs are intentionally browser-profile-local because they reference local storage rather than embedding the full snapshot payload.
- Open uses the existing inspected-page evaluation channel and `window.location.assign`, so navigation stays in the game tab instead of replacing the DevTools panel or opening a detached tab.
- Editable-target suppression belongs in the one shared shortcut binding rather than individual shortcut handlers. Keyup remains active so a physical key pressed before focus changed cannot become stuck.

## Validation

- Focused snapshot, scenario-routing, DevTools bridge, initial-runtime, and keyboard-binding Vitest runs passed.
- Focused Playwright coverage passed for named refresh persistence, top-menu adapter behavior, the mobile save panel, the renamed latest-snapshot replay, and editable-input shortcut suppression.
- `npm test`: passed 557 unit tests, 16 automation-claim tests, and 3 automation-workflow tests.
- `npm run test:gui`: passed all 65 mobile Chromium GUI tests.
- `npm run build`: passed; Vite reported the existing large-chunk warning.
- The generated `dist/space-web-game-devtools-version.json` matched extension manifest version `0.1.24`.
- Targeted Biome checks for touched TypeScript and tests, the extension panel JavaScript syntax check, and `git diff --check` passed.
- Inspected `tmp/playwright-results/mobileHudScreenshot-captur-666fd-menu-open-over-gameplay-HUD-mobile-chromium/mobile-top-menu-snapshot-save.png`; the focused field and actions matched the expected compact top-menu state without obscuring the central playfield.
- The first follow-up GUI run exposed a test-only overlap caused by enabling the visible debug panel before opening the save form. Debug shortcut suppression moved to focused unit coverage, the real-game regression retained camera/reset/manual-control characters, and the subsequent clean full-suite run passed all 65 tests.
- Direct DevTools-panel screenshot capture was unavailable because no in-app browser backend was connected; the panel render/copy contract is covered by bridge tests and a JavaScript syntax check.

## Follow-ups and known gaps

- Snapshot history and copied snapshot URLs remain deliberately local to one browser profile and capped at ten entries.

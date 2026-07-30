# Selected debug snapshot export

Issue: https://github.com/chmurson/space-web-game/issues/322

Shipit state:
`.codex/shipit-workflows/automation/issue-322-export-selected-debug-snapshot.md`

## What changed

The main menu's **Load any game** view now offers **Export** beside **Load**.
Export downloads the currently selected recent entry as the canonical portable
debug snapshot JSON, then records that entry's local `lastExportedAt` time and
refreshes its visible details without leaving the view.

The action is disabled with no selected entry. Successful initiation is
announced through an accessible status message. If native download initiation
throws, an accessible alert explains that the download could not be started and
the export timestamp is not changed.

## Why

Recent snapshots can represent different scenarios and moments even when the
active slot or newest entry is something else. Export must therefore follow the
explicit picker selection so users can move the intended checkpoint between
browsers without changing what the game will load.

## Ownership and key files

- `src/debugScenarioSnapshot.ts` continues to own canonical serialization,
  sanitized filenames, native browser download initiation, and persisted
  recent-entry metadata mutations. This change reuses those APIs unchanged.
- `src/ui/createMainMenu.ts` owns the selected-entry export sequence, status,
  and in-place recent-entry refresh.
- `src/ui/components/MainMenuSurface.tsx` owns the disabled state, sibling Load
  and Export actions, and accessible status/alert markup.
- `src/style.css` keeps both actions equal within the existing shared glass row
  and uses the established success/error accent colors for status text.
- `tests/gui/mobileHudScreenshot.spec.ts` covers the exact selection, download
  filename and Blob payload, metadata update, unchanged ordering/selection and
  active slot, native initiation failure, and mobile/desktop visual states.

## Decisions

- Download initiation completes before `markRecentDebugScenarioSnapshotExported`
  runs, so an initiation failure cannot create a false export timestamp.
- Metadata persistence failure is reported separately after a download starts;
  the already-initiated browser download cannot be rolled back.
- The adapter downloads `selectedSnapshot.snapshot`, never the active slot or a
  fresh newest-entry lookup, preserving the user's explicit choice.
- Refresh replaces the in-memory recent-entry data after persistence but leaves
  `selectedRecentSnapshotId` untouched. The storage mutation already preserves
  entry identity, name, order, count, and snapshot payload.
- Load and Export are sibling secondary menu actions. No import placeholder,
  top-menu action, snapshot-manager abstraction, or new transport API was added.
- Existing portable helpers remain the only source of the canonical JSON shape
  and descriptive sanitized filename.

## Validation

- Focused Playwright main-menu coverage passes 5/5 for empty, selected,
  successful export, failed initiation, and `1024x720` desktop states.
- Full product Vitest passes 775/775 tests across 73 files.
- Automation claim tests pass 16/16 and engineer workflow tests pass 7/7.
- The release build passes config validation, TypeScript, and Vite production
  bundling.
- Focused Biome checks pass for changed TypeScript/TSX and test files; the full
  stylesheet still reports its three pre-existing `!important` warnings.
- `git diff --check` passes.
- The complete GUI suite passes 97/98. Its sole failure is the existing Reach
  the Moon leaderboard assertion that expects accessible text `Time 7h30m`;
  the shipped formatter and accessibility tree expose `Time 07h30m`. A focused
  `--last-failed` rerun reproduced that unrelated mismatch.
- Generated mobile success/failure and mobile/desktop selected-details
  screenshots were visually inspected. Actions, details, statuses, and Back fit
  the `390x844` and `1024x720` viewports without overlap or clipping.
- Inspected artifacts:
  - `tmp/playwright-results/mobileHudScreenshot-export-9d37a--and-refreshes-its-metadata-mobile-chromium/mobile-main-menu-snapshot-exported.png`
  - `tmp/playwright-results/mobileHudScreenshot-report-90f33-without-recording-an-export-mobile-chromium/mobile-main-menu-snapshot-export-failed.png`
  - `tmp/playwright-results/mobileHudScreenshot-shows--84c9a--snapshot-details-on-mobile-mobile-chromium/mobile-main-menu-snapshot-details.png`
  - `tmp/playwright-results/mobileHudScreenshot-keeps--56707-ils-within-the-desktop-menu-mobile-chromium/desktop-main-menu-snapshot-details.png`
- An interactive local-browser smoke created a named Free Roam snapshot,
  exported it from **Load any game**, and confirmed that selection remained,
  the view stayed open, the Last exported row appeared, and success was
  announced. The focused Playwright test separately captured the native
  download and verified its filename and canonical JSON payload.

## Follow-ups and known gaps

- File import remains owned by issue #323.
- Live runtime capture remains outside this flow.
- Browsers report native download initiation, not whether the user ultimately
  keeps or deletes the downloaded file.

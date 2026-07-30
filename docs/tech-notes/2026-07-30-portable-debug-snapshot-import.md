# Portable debug snapshot import

Date: 2026-07-30

Issue: https://github.com/chmurson/space-web-game/issues/323

Shipit state:
`.codex/shipit-workflows/automation/issue-323-import-portable-debug-snapshot.md`

## What changed

The main menu's **Load any game** view now exposes **Import** through a native
single-file input. A selected JSON file is read and validated through the
shared portable snapshot parser. A supported snapshot is persisted as the
newest recent entry with local `importedAt` metadata, selected in the picker,
and accompanied by the accessible status `Snapshot imported. Select Load to
start.`.

Import does not write the active snapshot slot or start a game. The existing
**Load** action remains the only path that copies the selected recent payload
to the active slot and starts it.

## Why

Portable snapshots need to move into another browser without coupling file
selection to game startup. Keeping import and load as separate actions lets a
user inspect the selected snapshot details and explicitly decide when to
replace the active game.

## Ownership and decisions

- `src/debugScenarioSnapshot.ts` remains the sole owner of compatibility,
  recent-entry insertion, `importedAt`, unique IDs, newest-first ordering, the
  ten-entry cap, persistence, and active-slot isolation.
- `src/ui/createMainMenu.ts` sequences native file reading, shared parsing, the
  existing imported-entry mutation, selection, and accessible outcome state.
- `src/ui/components/MainMenuSurface.tsx` owns the hidden native file input,
  visible **Import** trigger, separate **Load** action, and inline status/alert.
- `src/style.css` keeps the two actions compact in the existing recent-snapshot
  glass row and uses the established success/error colors.
- Invalid JSON, unsupported versions, malformed payloads, file-read failures,
  and storage failures return before selection changes. The shared parser's
  category-specific messages are shown directly.
- Import remains enabled when the recent list is empty. Resetting the input
  value after selection allows retrying the same file after an error.
- Version 3 is the only version accepted by the shared #319 boundary. Its
  supported legacy-shaped payloads, including snapshots without runtime
  scenario metadata and the retained `cameraView` compatibility field, use
  the same import path. Versions 1 and 2 remain intentionally unsupported.
- No File System Access API, export control, cloud path, JSON editor, auto-load
  behavior, dependency, or generic snapshot manager was added.

## Validation

- Focused portable/recent-snapshot Vitest passed: 53/53.
- Full product Vitest passed: 775/775 across 73 files.
- Automation claim tests passed: 16/16.
- Engineer workflow tests passed: 7/7.
- Release build passed, including config validation, TypeScript, and Vite.
- Dedicated import Playwright coverage passed: 3/3. The combined import and
  existing mobile/desktop snapshot-detail slice passed 5/5.
- The exact full `npm run test:gui` run passed 98/99. Its sole failure is the
  documented unrelated leaderboard assertion that expects accessible text
  `Time 7h30m`; the shipped formatter and rendered accessibility tree expose
  `Time 07h30m`. The transient Time Warp fling miss seen in the first full run
  passed both its isolated rerun and the final full run.
- The generated
  `tmp/playwright-results/debugSnapshotImport-import-596b9-nd-loads-it-only-after-Load-mobile-chromium/mobile-debug-snapshot-import-success.png`
  and
  `tmp/playwright-results/debugSnapshotImport-keeps--0271d-e-imported-state-on-desktop-mobile-chromium/desktop-debug-snapshot-import-success.png`
  artifacts were visually inspected at 390x844 and 1024x720. Selector details,
  the **Import** and **Load** actions, status, and **Back** fit without clipping
  or overlap and preserve the canvas-first glass hierarchy.
- Biome passed for changed executable and GUI files with only the three
  existing `!important` warnings elsewhere in `src/style.css`;
  `git diff --check` passed.

## Follow-ups and known gaps

- Native browser file reading exposes a failure boundary but cannot explain an
  operating-system or browser-specific read failure beyond the clear retryable
  inline error.
- Two imports initiated in very quick succession complete in browser read
  order. Each valid file remains preserved as a newest recent entry, while the
  last completion owns the visible selection/status.
- The ordinary PR preview workflow owns staging; no manual or production
  deployment is part of this change.

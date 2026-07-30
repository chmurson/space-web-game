# Current runtime snapshot export

Shipit state:
`.codex/shipit-workflows/automation/issue-321-export-current-runtime-state.md`

## What changed

- Added a `Snapshot` section to the existing in-game top menu with one
  `Export current state` action.
- Added a runtime action that captures through `createSnapshotFromState` when
  the button is pressed, initiates the shared portable JSON download, and then
  inserts the same capture as the newest recent entry with `lastExportedAt`.
- Added persistent in-menu success and error feedback. Download-initiation
  failure leaves the recent list unchanged; a successful download followed by
  a local-storage failure is reported separately.
- Added focused runtime and top-menu adapter coverage plus mobile, compact
  mobile, and fine-pointer desktop browser interaction/screenshot coverage.

## Why

The existing named debug save flow stores snapshots locally, but it does not
produce a portable file captured from the current running frame. Issue #321
requires a direct in-game export that remains recoverable through the existing
main-menu recent-snapshot flow without introducing another snapshot schema or
manager.

## Ownership and key files

- `src/runtime/runtimeActions.ts` owns live runtime capture and the sequencing
  of portable download before recent-entry insertion.
- `src/debugScenarioSnapshot.ts` remains the unchanged owner of snapshot
  cloning, portable serialization and filenames, native download initiation,
  and recent-entry metadata/storage.
- `src/ui/createTopMenu.ts` adapts the runtime result into menu-local accessible
  status and refreshes recent-snapshot availability.
- `src/ui/components/TopMenuSurface.tsx` owns the new menu section and semantic
  status/alert output.
- `src/style.css` adds only status text treatment while reusing the existing
  menu section and shared glass surface.

## Important decisions

- Capture happens inside the export runtime action, not when the menu opens, so
  the payload reflects live state at the moment of activation.
- Native download initiation is attempted before storage insertion. A blocked
  download therefore cannot create an entry falsely marked as exported.
- The exported recent entry does not replace the active debug snapshot slot;
  existing save, last-load, exact recent-load, naming, ordering, and capacity
  policies remain owned by the existing helpers.
- The menu remains open after export so touch, pointer, keyboard, and assistive
  technology users receive visible feedback. Closing the menu clears the
  transient status.
- No new CSS positioning or responsive branch was added. The section inherits
  the existing safe-area-aware top bar and compact menu sizing.

## Validation

- Focused runtime tests: 30/30 passed, including click-time capture, portable
  filename/payload, newest recent insertion, `lastExportedAt`, active-slot
  preservation, and download-initiation failure.
- Focused Playwright checks: 5/5 passed for adapter focus/keyboard behavior,
  mobile success plus main-menu availability, compact-mobile failure, and
  fine-pointer desktop success.
- Visually inspected generated screenshots at 390x844, 320x568, and 1024x720.
  The menu stayed within each viewport with readable success/error status and
  no HUD, touch-dock, or safe-area overlap.
- Full product tests passed: 777/777 across 73 files, plus 16/16 automation
  claim tests and 7/7 engineer-workflow tests.
- Release configuration validation, TypeScript compilation, and the Vite
  production build passed.
- Full `npm run test:gui` completed at 96/99. Every new export path passed. The
  three baseline failures are two stale version-1 recent-snapshot fixtures
  already corrected independently on #322/#323 branches and the documented
  leaderboard `7h30m` versus `07h30m` accessible-name mismatch.
- Changed-file Biome checks and `git diff --check` passed; Biome reported only
  three pre-existing unsafe `!important` warnings outside the edited CSS.

## Follow-ups and known gaps

- Browsers expose download initiation, not whether the user ultimately keeps
  the file.
- A successful download cannot be rolled back if local recent-entry storage
  subsequently fails; the menu reports that split outcome and leaves existing
  entries intact.
- Main-menu selected export and import remain independently owned by #322 and
  #323 and are not duplicated here.

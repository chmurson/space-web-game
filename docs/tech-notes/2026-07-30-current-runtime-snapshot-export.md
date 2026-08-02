# Current runtime snapshot export

Shipit state:
`.codex/shipit-workflows/automation/issue-321-export-current-runtime-state.md`

## What changed

- Added export actions to both existing in-game debug-snapshot submenus and
  removed the standalone top-level `Snapshot` section.
- `Save debug snapshot` now offers `Save & export`. It captures through
  `createSnapshotFromState` once, saves the named snapshot as the active and
  recent entry, downloads that exact capture, and marks the same recent entry
  with `lastExportedAt`.
- `Load debug snapshot` now offers `Export` for the selected recent entry. It
  shares Load's enabled state, leaves selection and the active slot unchanged,
  and updates only the selected entry's `lastExportedAt` after download starts.
- Added persistent in-menu success and error feedback. A blocked combined
  download leaves the saved entry unmarked as exported; a successful download
  followed by local metadata failure is reported separately.
- Added focused runtime and top-menu adapter coverage plus mobile, compact
  mobile, and fine-pointer desktop browser interaction/screenshot coverage.

## Why

The existing named debug save flow stores snapshots locally, but it does not
produce a portable file captured from the current running frame. Issue #321
requires a direct in-game export that remains recoverable through the existing
main-menu recent-snapshot flow without introducing another snapshot schema or
manager. Maintainer follow-up on PR #345 requested that export live beside the
save/load controls instead of occupying its own top-level menu section.

## Ownership and key files

- `src/runtime/runtimeActions.ts` owns the single live capture and the combined
  save, portable download, and exported-metadata sequence.
- `src/debugScenarioSnapshot.ts` remains the unchanged owner of snapshot
  cloning, portable serialization and filenames, native download initiation,
  and recent-entry metadata/storage. Named writes now return the created entry
  so the combined action can mark that exact item without inserting a duplicate.
- `src/ui/createTopMenu.ts` adapts combined-save outcomes, exports the selected
  recent entry from Load, and refreshes menu-local state and accessible status.
- `src/ui/components/TopMenuSurface.tsx` owns the sibling Save/Save & export and
  Load/Export controls plus semantic status/alert output.
- `src/style.css` adds only status text treatment while reusing the existing
  menu section and shared glass surface.

## Important decisions

- Capture happens inside the export runtime action, not when the menu opens, so
  the payload reflects live state at the moment of activation.
- Save & export writes one named active/recent snapshot, attempts the download,
  then marks that same recent entry exported. A blocked download therefore
  leaves a valid saved snapshot without a false export timestamp.
- Load-side Export downloads `selectedSnapshot.snapshot`, not the active slot
  or a fresh runtime capture. Its metadata mutation preserves identity, name,
  order, count, payload, selection, and active-slot state.
- The menu remains open after export so touch, pointer, keyboard, and assistive
  technology users receive visible feedback. Closing the menu clears the
  transient status.
- No new CSS positioning or responsive branch was added. The submenus inherit
  the existing safe-area-aware top bar and compact menu sizing.

## Validation

- Focused runtime/storage tests passed 81/81, including one-capture combined
  save/export, named active/recent persistence, exact downloaded payload,
  `lastExportedAt`, blocked download, failed save, and failed metadata update.
- Focused Playwright checks passed 6/6 for adapter focus/keyboard and shared
  disabled rules, mobile and fine-pointer combined export, selection-bound Load
  export, and compact-mobile failure.
- Visually inspected generated screenshots at 390x844, 320x568, and 1024x720.
  Both submenu action sets and their success/error feedback stayed within the
  viewport without HUD, touch-dock, or safe-area overlap.
- Full product tests passed 779/779 across 73 files, plus 16/16 automation claim
  tests and 7/7 engineer-workflow tests.
- Release configuration validation, TypeScript compilation, and the Vite
  production build passed with only the existing large-chunk warning.
- Full `npm run test:gui` completed at 97/100. Every new export path passed. The
  three baseline failures are two stale version-1 recent-snapshot fixtures
  already corrected independently on #322/#323 branches and the documented
  leaderboard `7h30m` versus `07h30m` accessible-name mismatch.
- Changed-file Biome checks and `git diff --check` passed.

## Follow-ups and known gaps

- Browsers expose download initiation, not whether the user ultimately keeps
  the file.
- A successful download cannot be rolled back if local recent-entry storage
  subsequently fails; the menu reports that split outcome and leaves existing
  entries intact.
- Main-menu selected export and import remain independently owned by #322 and
  #323. This follow-up adds only the explicitly requested top-menu Load export.

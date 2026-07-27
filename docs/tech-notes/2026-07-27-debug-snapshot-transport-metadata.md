# Debug snapshot transport metadata

Issue: https://github.com/chmurson/space-web-game/issues/320

Shipit state:
`.codex/shipit-workflows/automation/issue-320-debug-snapshot-metadata.md`

## What changed

Recent debug snapshot entries can now persist optional local `importedAt` and
`lastExportedAt` timestamps. Three storage mutations support the later menu
features:

- insert an imported snapshot as the newest recent entry;
- mark an existing recent entry as exported without moving or renaming it;
- insert a newly captured snapshot as the newest recent entry and mark it
  exported immediately.

All insertion paths reuse the existing unique-ID generation, newest-first
ordering, local-storage key, and ten-entry cap.

## Why

Portable snapshot files must contain only the supported
`DebugScenarioSnapshot` payload. Import and export times describe local browser
activity, so they belong to the recent-entry record instead of the file that
moves between browsers.

## Ownership and decisions

- `src/debugScenarioSnapshot.ts` owns the entry metadata and mutation APIs.
- `tests/debugScenarioSnapshot.test.ts` owns compatibility, ordering,
  capacity, persistence, active-slot isolation, and storage-failure coverage.
- Existing stored entries remain valid because both timestamps are optional.
- Insert mutations return the new entry, allowing later import UI to select it
  without a second identity lookup. Storage failures return `null`.
- Export marking returns `false` for a missing entry or storage failure and
  writes only after the target entry is found.
- Import/export insertion does not change the active snapshot slot. The
  existing explicit recent-entry load path remains responsible for doing that.
- Storage read failures stop mutations before a write, preventing an
  unavailable recent list from being replaced with a partial reconstruction.
- Active snapshot writes treat recent-list insertion as best-effort, so a
  recent-list read or write failure cannot block the primary active-slot write.

## Validation

- Focused Biome check for the implementation and tests passed.
- Focused Vitest snapshot suite: 24 tests passed.
- Release build passed, including config validation and TypeScript checking.
- Full product Vitest suite: 70 files and 722 tests passed.
- Automation claim tests: 16 passed.
- Automation workflow tests: 4 passed.
- `git diff --check` passed.
- GUI validation was not run because this storage-only slice changes no UI,
  layout, interaction, or visual state.

## Follow-ups and known gaps

- Issue #319 owns portable JSON validation, serialization, filenames, and
  download initiation.
- Issues #321 through #324 own the menu and runtime user experiences that will
  consume these storage mutations.
- This change deliberately adds no UI, file transport, or live runtime capture.

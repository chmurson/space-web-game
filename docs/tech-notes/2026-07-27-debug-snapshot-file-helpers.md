# Debug snapshot portable-file helpers

Date: 2026-07-27

Issue: https://github.com/chmurson/space-web-game/issues/319

Shipit state:
`.codex/shipit-workflows/automation/issue-319-debug-snapshot-file-helpers.md`

## What changed

- Added one reusable debug-snapshot validation result that accepts only the
  current version 3 while distinguishing unsupported versions from malformed
  payloads.
- Added JSON parsing with a separate invalid-JSON result and changed the active
  and recent stored-snapshot paths to reuse the same compatibility boundary.
- Added portable serialization that strips local import/export timestamps,
  descriptive sanitized `.json` filenames, and a browser download helper built
  from `Blob`, an object URL, and a temporary anchor.
- Added focused tests for compatibility, parsing, storage filtering,
  serialization, filenames, and browser download initiation and cleanup.

## Why

Debug snapshots need one compatibility boundary before file import/export UI is
added. Keeping the boundary in the existing snapshot module prevents stored and
portable snapshots from drifting into separate schemas or version policies.

## Ownership and decisions

- `src/debugScenarioSnapshot.ts` continues to own the snapshot schema,
  current-version validation, local-storage loading, and the new portable-file
  helpers.
- Versions 1 and 2 were removed from the schema and their migration branches
  after PR review confirmed that legacy debug snapshot files do not need to be
  preserved. Portable parsing, active storage, and recent storage now reject
  those versions through the same unsupported-version result.
- Validation checks the canonical required simulation payload deeply enough to
  reject unusable bodies or spacecraft while leaving optional current-version
  fields compatible with snapshots that omitted them.
- Portable serialization accepts only the canonical snapshot payload and
  removes root-level `importedAt` and `lastExportedAt`; recent-entry identity,
  names, and transport timestamps remain outside that payload.
- Filenames use `space-web-game`, the runtime scenario ID when present, and the
  snapshot's `savedAt` value. Unsafe separators and non-ASCII filename marks are
  normalized into portable hyphenated segments.
- The download helper uses ordinary browser APIs and revokes its object URL
  after the temporary anchor is clicked. No manager, UI, server, or File System
  Access API was introduced.

## Validation

- Focused Biome check passed for the implementation and test files.
- Focused Vitest passed: 28/28 debug snapshot tests.
- Release build passed, including config validation and TypeScript.
- Full product Vitest passed: 726/726 tests across 70 files.
- Automation claim tests passed: 16/16.
- Engineer workflow tests passed: 4/4.
- Targeted Playwright checks passed: 5/5 current-snapshot storage, main-menu,
  crash-menu, top-menu, and tutorial replay scenarios.
- `git diff --check` passed.
- Full GUI validation was not run because no UI, visual, responsive, or
  gameplay interaction behavior changed.

## Follow-ups and known gaps

- Issue #319 intentionally does not add import/export controls or mutate recent
  snapshot metadata. Those remain owned by separate slices of umbrella #316.
- Validation reports the first incompatible field. A future import UI can show
  the result's stable error category and message without handling exceptions.
- Existing version-1 and version-2 snapshot files and stored entries are
  intentionally unsupported; version 3 is the only accepted snapshot schema.

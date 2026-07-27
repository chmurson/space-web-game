# Debug snapshot portable-file helpers

Date: 2026-07-27

Issue: https://github.com/chmurson/space-web-game/issues/319

Shipit state:
`.codex/shipit-workflows/automation/issue-319-debug-snapshot-file-helpers.md`

## What changed

- Added one reusable debug-snapshot validation result that accepts versions 1,
  2, and 3 while distinguishing unsupported versions from malformed payloads.
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
  supported versions, local-storage loading, and the new portable-file helpers.
- Validation checks the canonical required simulation payload deeply enough to
  reject unusable bodies or spacecraft while leaving version-specific optional
  fields backward compatible.
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
- Focused Vitest passed: 30/30 debug snapshot tests.
- Release build passed, including config validation and TypeScript.
- Full product Vitest passed: 728/728 tests across 70 files.
- Automation claim tests passed: 16/16.
- Engineer workflow tests passed: 4/4.
- `git diff --check` passed.
- GUI validation was not run because no UI, visual, responsive, or gameplay
  interaction behavior changed.

## Follow-ups and known gaps

- Issue #319 intentionally does not add import/export controls or mutate recent
  snapshot metadata. Those remain owned by separate slices of umbrella #316.
- Validation reports the first incompatible field. A future import UI can show
  the result's stable error category and message without handling exceptions.

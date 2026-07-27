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
- Hardened version-3 validation so optional camera, targeting, pin, and runtime
  session fields are accepted only when their full nested shape is safe to use.
  Supported snapshots without a runtime session now receive a v3-accurate
  fallback scenario ID instead of a legacy-labelled one.
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
- Validation checks the canonical required simulation payload and every
  optional current-version field. Optional fields may still be omitted, but
  provided runtime sessions must include valid prompt UI, JSON-compatible state,
  and a complete clone-safe checkpoint when one exists.
- Snapshots without `runtimeScenario` remain supported and create the fallback
  session `debug-snapshot-without-runtime-scenario`; snapshots with a runtime
  session continue to clone it before scenario creation.
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
- Focused Vitest passed: 49/49 debug snapshot tests.
- Release build passed, including config validation and TypeScript.
- Full product Vitest passed: 747/747 tests across 70 files.
- Automation claim tests passed: 16/16.
- Engineer workflow tests passed: 4/4.
- The earlier implementation pass ran 5/5 targeted Playwright checks for
  current-snapshot storage, main-menu, crash-menu, top-menu, and tutorial replay
  scenarios. They were not rerun for this non-UI validation-only follow-up.
- `git diff --check` passed.
- Full GUI validation was not run because no UI, visual, responsive, or
  gameplay interaction behavior changed.

## Follow-ups and known gaps

- Issue #319 intentionally does not add import/export controls or mutate recent
  snapshot metadata. Those remain owned by separate slices of umbrella #316.
- Validation reports the first incompatible field. A future import UI can show
  the result's stable error category and message without handling exceptions.
- Runtime session state is intentionally limited to finite JSON-compatible
  values, matching the portable snapshot contract and preventing unsupported
  values or cyclic structures from reaching `structuredClone`.
- Existing version-1 and version-2 snapshot files and stored entries are
  intentionally unsupported; version 3 is the only accepted snapshot schema.

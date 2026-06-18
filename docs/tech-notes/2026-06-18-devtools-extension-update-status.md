# DevTools Extension Update Status

## What Changed

- The Space Game DevTools panel now shows whether the installed unpacked
  extension is up to date with the inspected app.
- Vite serves and emits `/space-web-game-devtools-version.json`, generated from
  `extension/space-web-game-devtools/manifest.json`.
- The extension version was bumped to `0.1.1`.

## Why It Changed

Unpacked Chrome extensions do not update themselves automatically. The panel now
gives a clear status so users know when they need to reload the extension in
`chrome://extensions`.

## Key Files

- `vite.config.ts` owns the app-published expected extension version file.
- `extension/space-web-game-devtools/panel.*` owns the visible status pill and
  comparison logic.
- `extension/space-web-game-devtools/manifest.json` remains the source of truth
  for the extension version.

## Implementation Decisions

- The panel evaluates a same-origin request inside the inspected page, avoiding
  broad Chrome extension host permissions.
- Version comparison is limited to numeric dotted versions, matching the current
  manifest version format.
- Older installed copies need one manual reload before they can show this new
  checker.
- An `ahead of app` state is possible when a local extension has been updated
  before the inspected app deployment; no user action is needed in that case.

## Validation

- `npm test -- tests/devtools/devtoolsBridge.test.ts`: passed.
- `npm run build`: passed and emitted
  `dist/space-web-game-devtools-version.json`.
- `git diff --check`: passed.
- Browser smoke check with mocked Chrome extension APIs confirmed:
  - `Ext v0.1.1: up to date`
  - `Ext v0.1.0: update to v0.1.1`
- `coderabbit --base main --agent` returned one minor README finding, which
  was fixed, but the command kept heartbeating and was stopped before a clean
  completion.

## Follow-Up

- None.

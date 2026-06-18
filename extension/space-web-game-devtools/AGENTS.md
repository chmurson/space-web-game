# Space Web Game DevTools Extension Notes

## Scope

These instructions apply to files under `extension/space-web-game-devtools/`.

## Versioning

- `manifest.json` is the installed extension version source of truth.
- Bump `manifest.json` `version` whenever changing files that ship as part of the installed extension package, including panel HTML, CSS, JavaScript, manifest fields, icons, or other runtime assets.
- Do not skip the version bump for small UI copy, styling, or behavior changes; unpacked extension users need a clear signal that they should reload.
- Documentation-only edits may leave the version unchanged when they do not alter the installed extension package or user-visible extension behavior.
- After bumping the manifest version, confirm the app-published version endpoint still reports the same version via the Vite-generated `/space-web-game-devtools-version.json` asset.

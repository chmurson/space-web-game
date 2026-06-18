# Shipit State

Task: DevTools extension update status
Branch: main
Current Mode: review
Status: completed

## Checklist

- [x] Brainstorm handoff complete
- [x] Design handoff complete
- [x] Implementation task slices created or explicitly waived
- [x] Implementation complete
- [x] Cleanup complete
- [x] Review complete
- [x] Validation passed
- [x] Artifacts/docs updated
- [x] PR opened/updated (not applicable; yeet was not requested)

## Artifacts

- Brainstorm: inline
- Design: inline
- Task slices: inline
- Implementation: inline
- Cleanup: inline
- Review: inline

## Decisions

- Use the inspected page context to fetch a generated same-origin version file, avoiding new extension host permissions.
- Compare the installed unpacked extension manifest version with the app-published expected extension version.
- Bump the DevTools extension version so future installed copies can detect when they are behind.

## Open Questions

- none

## Validation

- [x] `npm test -- tests/devtools/devtoolsBridge.test.ts`
- [x] `npm run build`
- [x] `git diff --check`
- [x] Browser smoke check with mocked Chrome extension APIs
- [x] `coderabbit --base main --agent` partially completed; one finding fixed, command stopped after repeated heartbeats.
- [x] Production deploy not applicable; no commit was requested or created.

## Next Step

Complete.

## Brainstorm Handoff

Goal: make it clear in `extension/space-web-game-devtools` whether the installed DevTools extension is current.

User-facing behavior:
- The DevTools panel header shows the installed extension version and whether it is current.
- If the inspected app expects a newer extension version, the panel says the extension is outdated and asks the user to reload the unpacked extension.
- If the app cannot publish version information, the panel says it cannot check instead of guessing.

Non-goals:
- No Chrome Web Store integration.
- No background worker or remote API.
- No auto-update workflow for unpacked extensions.

## Design Handoff

Scope:
- `vite.config.ts`: generate and serve a small `space-web-game-devtools-version.json` file from the extension manifest version.
- `extension/space-web-game-devtools/panel.html`: add a compact version status near the existing connection status.
- `extension/space-web-game-devtools/panel.js`: read installed manifest version, fetch expected version through the inspected page, and render current/outdated/unavailable states.
- `extension/space-web-game-devtools/panel.css`: style the version pill with existing status colors.
- `extension/space-web-game-devtools/manifest.json`: bump extension version for this user-visible panel feature.
- README/tech note: document what the status means.

Task slices:
- Add app-published expected extension version.
- Add panel comparison UI.
- Update docs and validation.

Risks:
- Previously installed old extensions cannot display this checker until they are manually reloaded once.
- Version comparison only supports numeric dotted manifest versions, which matches Chrome extension version rules used here.

## Implementation Handoff

Changed files:
- `vite.config.ts`
- `extension/space-web-game-devtools/manifest.json`
- `extension/space-web-game-devtools/panel.html`
- `extension/space-web-game-devtools/panel.js`
- `extension/space-web-game-devtools/panel.css`
- `extension/space-web-game-devtools/README.md`
- `docs/tech-notes/2026-06-18-devtools-extension-update-status.md`

Completed slices:
- Added a generated app-published expected extension version endpoint.
- Added the panel header comparison UI.
- Documented the status behavior and the one-time reload limitation for older installed copies.

Behavior implemented:
- Installed extension version comes from `chrome.runtime.getManifest().version`.
- Expected extension version comes from `/space-web-game-devtools-version.json`.
- Header states are `up to date`, `update to v...`, `ahead of app`, and `cannot check`.

Deviations:
- Used a synchronous same-origin XHR inside the inspected page eval so the existing DevTools eval callback can return a plain value.

Known gaps:
- Old installed extensions that predate this feature cannot report update status until reloaded once.

## Cleanup Notes

Cleanup performed:
- Shortened visible panel status labels from `Extension ...` to `Ext ...` so they fit better in narrow DevTools panels.
- Let header actions wrap, then verified the narrow panel header with browser automation.
- Added manifest-version validation in the Vite plugin so the generated JSON cannot silently omit the version.

Cleanup intentionally skipped:
- No new shared JS module for panel helpers; the logic is used only by this small extension panel.
- No Chrome host permissions or background worker; the inspected page same-origin eval covers the requirement with less surface area.

## Review Notes

CodeRabbit:
- `coderabbit --base main --agent` started and returned one minor finding: README documented `up to date`, `update to v...`, and `cannot check`, but omitted `ahead of app`.
- Finding was valid and fixed in `extension/space-web-game-devtools/README.md`; the tech note was also updated.
- After that, CodeRabbit kept heartbeating without cleanly completing and was stopped. Automated review is therefore partial.

Ponytail review lens:
- Kept version source of truth as the existing extension manifest.
- Used one generated static JSON asset instead of an API, background worker, dependency, or Chrome Web Store integration.
- Kept comparison logic local to `panel.js`; no abstraction is justified yet.

Self-review:
- Header status states cover current, outdated, ahead, unavailable, and initial checking.
- The app-published version file is generated in both Vite dev middleware and production build output.
- The panel avoids broad extension host permissions by evaluating the same-origin request in the inspected page.
- The README and tech note document the one-time limitation for old installed copies.

Solution retrospect:
- A bridge request would be less code, but it would only work when the runtime bridge is enabled. The generated same-origin file is a better fit because the update status can work independently of bridge availability.
- Synchronous XHR inside DevTools eval is intentionally narrow and only runs on panel load/Refresh; replacing it with a broader async protocol is not worth the extra moving parts here.

Requirement coverage:
- The extension panel now gives clear up-to-date/outdated status.
- The outdated state tells users to update from the installed version to the app-expected version.
- The README documents how to interpret each state.

Residual risk:
- Existing installed versions older than this change cannot show the checker until manually reloaded once.
- The browser smoke check used mocked Chrome extension APIs rather than a fully loaded unpacked extension.

Validation results:
- `npm test -- tests/devtools/devtoolsBridge.test.ts`: passed, 8 tests.
- `npm run build`: passed and emitted `dist/space-web-game-devtools-version.json`.
- `git diff --check`: passed.
- Browser smoke check with mocked Chrome extension APIs confirmed `Ext v0.1.1: up to date` and `Ext v0.1.0: update to v0.1.1`.

Follow-up issues:
- None proposed.

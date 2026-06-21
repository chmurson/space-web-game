# Debug JSON Folding

## What Changed

- Replaced the debug panel JSON string-highlighting path with DOM token rendering.
- Added inline fold buttons for first-level JSON fields whose values are non-null objects.
- Kept primitive first-level fields, nested object fields, and `null` values unbuttoned.
- Preserved raw `JSON.stringify(payload, null, 2)` output for `Copy JSON`.
- Added focused tests for top-level-only folding, live-update persistence, and stale collapsed-key cleanup.

## Why

The debug JSON can become long enough that the panel is hard to scan, especially on mobile. Folding only first-level object fields keeps the control surface small while making large blocks such as `captureMetrics` and `browserGc` easier to collapse during live inspection.

## Key Files

- `src/ui/debugPanel.ts` owns JSON DOM rendering, fold-button behavior, collapsed-key state, and copy payload preservation.
- `src/style.css` owns the compact inline fold-button styling.
- `tests/ui/debugPanel.test.ts` covers the public debug panel behavior through a small fake DOM.

## Decisions

- Collapse state is keyed by first-level field name so it survives the frame loop's frequent debug JSON refreshes.
- Rendering uses the serialized JSON payload as the source of truth by parsing the current `JSON.stringify` output before drawing tokens.
- Arrays are foldable when they are first-level field values because they are non-primitive JSON containers.
- Collapsed object values render as `{ ... }` and collapsed arrays render as `[ ... ]`; the clipboard still receives full raw JSON.

## Validation

- `npx vitest run --config vite.config.ts tests/ui/debugPanel.test.ts`
- `npx biome check src/ui/debugPanel.ts tests/ui/debugPanel.test.ts`
- `git diff --check`
- `npm test` (38 files, 243 tests)
- `npm run build`
- Browser desktop check at `http://127.0.0.1:5173/?debug=1`: Free Roam debug panel shows fold controls only for `captureMetrics` and `browserGc`; collapsing `captureMetrics` persists during live JSON updates.
- Browser emulated-mobile check at `390x844`: debug panel remains within the viewport, fold buttons are visible in the JSON section, and `captureMetrics` collapses to `{ ... }`.
- Netlify staging deploy: `https://space-web-game-woven-moth.netlify.app` (`https://6a37f5089be617a3d422d166--space-web-game-woven-moth.netlify.app`)

## Follow-Ups

- None currently known.

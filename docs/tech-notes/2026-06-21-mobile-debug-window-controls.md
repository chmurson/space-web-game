# Mobile Debug Window Controls

## What Changed

- Added a debug-window toolbar with `Copy JSON`, size cycling, and `Close` controls.
- Kept `medium` as the current mobile height, added `small` at half that height, and added `big` as a full-viewport mobile view.
- Moved the mobile debug window from the bottom of the viewport to the upper play area.
- Rendered the debug JSON with lightweight syntax coloring while preserving raw JSON for clipboard copy.
- Routed the close button through the existing `toggleDebugMode` runtime action so persisted debug settings and menu state stay synchronized.

## Why

The mobile debug window was hard to manage because it sat low on the screen, had no direct close affordance, and showed large uncolored JSON in the same block as compact debug text. The new toolbar makes common debug actions reachable on mobile while the size toggle lets the panel stay compact during play or expand when inspecting state.

## Key Files

- `src/ui/debugPanel.ts` owns the debug panel DOM, size state, copy behavior, close handler, and JSON highlighting.
- `src/app/createAppComponents.ts` wires the panel close action into the existing runtime action dispatcher.
- `src/style.css` owns the debug panel toolbar, colorized JSON tokens, and responsive size/placement rules.

## Decisions

- The size selector is a single cycling button instead of a segmented control to keep the mobile toolbar compact.
- `Copy JSON` copies the raw `JSON.stringify` output, not the colorized markup.
- The close behavior toggles debug mode instead of hiding the element locally because the frame loop controls debug-panel visibility every frame.

## Validation

- `git diff --check`
- `npm test` (37 files, 240 tests)
- `npm run build`
- Browser mobile viewport check at `http://127.0.0.1:5173/?debug=1`: main-menu debug panel is suppressed, free-roam debug panel opens near the top, and `medium` / `small` / `big` measure as 30vh / 15vh / full viewport.
- Browser screenshot review for mobile `medium`, `small`, and `big` states.
- Browser close-button check: `Close` hides the panel through the runtime debug toggle.
- Browser copy-button check with a stubbed clipboard: `Copy JSON` passes raw JSON without colorization markup and shows `Copied`.
- Netlify staging deploy: `https://space-web-game-woven-moth.netlify.app`

## Follow-Ups

- None currently known.

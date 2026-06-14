# Space Web Game DevTools extension

Chrome DevTools panel for inspecting and safely controlling the runtime state of
Space Web Game.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this directory: `extension/space-web-game-devtools`.
5. Open Space Web Game.
6. Open Chrome DevTools and select the **Space Game** panel.

## Bridge availability

The app exposes `window.__SPACE_WEB_GAME_DEVTOOLS__` automatically in Vite dev
mode. Deployed builds keep the bridge disabled unless either:

- the page URL includes `?devtools=1`, or
- localStorage contains `space-web-game.devtools = "1"`.

The panel talks to the bridge with `chrome.devtools.inspectedWindow.eval`, so no
content script is needed for the MVP.

## Raw snapshot view

The raw snapshot starts collapsed, matching the original panel layout. Open
**Raw snapshot** to see the compact syntax-highlighted preview, use **Full
height** to expand it across the whole DevTools panel, **Esc** to close it, and
**Copy JSON** to copy the unformatted underlying JSON text.

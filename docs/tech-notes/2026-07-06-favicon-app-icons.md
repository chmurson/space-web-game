# Cross-device favicon and app icons

## What changed

- Added static favicon and app icon assets under `public/`.
- Linked desktop, Apple touch, Safari pinned-tab, and web app manifest metadata from `index.html`.
- Added `site.webmanifest` with install-surface icon metadata only; no service worker or PWA behavior was added.

## Why it changed

Issue #188 asked for browser/device icons that match the game instead of using a missing or generic favicon. The icon adapts the existing Reach the Moon highscore/menu orbit mark: a central moon/dot plus a tilted orbit path on the shipped dark space background.

## Key files

- `public/favicon.svg` is the source icon used by modern browsers.
- `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icon-192.png`, and `public/icon-512.png` are generated from the SVG for browser and installed-app surfaces.
- `public/safari-pinned-tab.svg` is a monochrome mask version of the same mark.
- `public/site.webmanifest` owns the install-surface metadata.
- `index.html` owns the document metadata links.

## Decisions

- Kept the asset set intentionally small: SVG favicon, ICO fallback, Apple touch icon, two manifest PNG sizes, and a Safari mask icon.
- Did not add install prompts, a service worker, or runtime app behavior.
- Kept all in-app menu, highscore, and Reach Moon copy unchanged.

## Validation

- Confirm generated raster assets have the expected dimensions and file types.
- Confirm build output includes the icon assets and metadata references resolve.
- Run `npm run build`.
- Run `git diff --check`.

## Follow-ups

- None known.

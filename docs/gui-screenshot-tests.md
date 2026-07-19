# GUI Screenshot Tests

Run the mobile GUI screenshot harness with:

```sh
npm run test:gui
```

The current paths boot the app at `/?reachmoon=1`, use a `390x844` mobile
Chromium viewport, hide the WebGL canvas and world-overlay elements with
test-only CSS, and capture visible HUD/menu states. They cover the main menu,
Reach the Moon menu/prompt states, and playable in-game touch controls such as
time warp, target selection, and thrust reveal panels. Playwright writes the
PNGs under `tmp/playwright-results/` and attaches them to the test result.

Add new paths under `tests/gui/` when another HUD/menu state needs browser
screenshot coverage. Keep DOM assertions minimal: they should prove the path
was reached, while the screenshot remains the main verification artifact.

## Mobile command dock variants

The Flight command-dock comparison is intentionally repeatable through URL
feature flags. Each axis stays local to the dock component and can be combined
with the others:

- `mobileDockDensity=compact|spacious`
- `mobileFlightPanel=glass|sheet`
- `mobileDockEmphasis=subtle|strong`
- `mobileDockItems=flight|full`
- `mobileDockSafeArea=standard|roomy`

Omitted or invalid values fall back to `compact`, `glass`, `subtle`, and
`standard`; the item set falls back to `flight`. `mobileDockItems=full` is a
review-only state showing Flight, Nav, Mission, Ship, and Settings together.
Only Flight is functional, and the normal/default game does not expose empty
future tabs. These defaults are a comparison starting point, not the final
selected mobile treatment.

`tests/gui/mobileCommandDock.spec.ts` captures a collapsed 320px treatment, an
open anchored-glass treatment at 390px with a simulated 24px bottom safe area,
and an open spacious sheet treatment at 430px with a simulated 34px bottom safe
area. It also captures the five-item review state at compact 320px and spacious
430px widths, with Flight selected in the spacious capture. The safe-area
simulation overrides the dock's local
`--mobile-command-dock-safe-bottom` test hook; production continues to use
`env(safe-area-inset-bottom)`.

If Playwright reports a missing browser locally, install the browser once:

```sh
npx playwright install chromium
```

GitHub Actions also has a manual `GUI Screenshots` workflow for this harness.
When started with `workflow_dispatch`, it installs Playwright Chromium, runs
`npm run test:gui`, and uploads `tmp/playwright-results/` as the
`mobile-gui-screenshots` artifact for human inspection. It does not run
automatically on pushes or pull requests, and it does not use committed
screenshot baselines or pixel comparisons.

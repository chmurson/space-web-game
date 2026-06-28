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

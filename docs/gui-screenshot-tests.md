# GUI Screenshot Tests

Run the mobile GUI screenshot harness with:

```sh
npm run test:gui
```

The first committed path boots the app at `/?reachmoon=1`, uses a `390x844`
mobile Chromium viewport, waits for the main menu, hides the WebGL canvas and
world-overlay elements with test-only CSS, and captures the visible UI.
Playwright writes the artifact under `tmp/playwright-results/` and attaches it
to the test result.

This harness intentionally starts with one stable mobile menu path. Add new
paths under `tests/gui/` when another HUD/menu state needs browser screenshot
coverage. Keep DOM assertions minimal: they should prove the path was reached,
while the screenshot remains the main verification artifact.

If Playwright reports a missing browser locally, install the browser once:

```sh
npx playwright install chromium
```

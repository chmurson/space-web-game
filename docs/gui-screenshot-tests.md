# GUI Screenshot Tests

Run the mobile GUI screenshot harness with:

```sh
npm run test:gui
```

The current paths boot the app at `/?reachmoon=1`, use a `390x844` mobile
Chromium viewport, hide the WebGL canvas and world-overlay elements with
test-only CSS, and capture visible HUD/menu states. They cover the main menu;
selected recent debug snapshot details, import, and export at mobile and
`1024x720` desktop sizes; successful and failed mobile status states; Reach the
Moon menu/prompt states; and playable in-game touch controls such as Time Warp,
target selection, Trajectory horizon, and thrust controls.
Playwright writes the PNGs under `tmp/playwright-results/` and attaches them
to the test result.

Add new paths under `tests/gui/` when another HUD/menu state needs browser
screenshot coverage. Keep DOM assertions minimal: they should prove the path
was reached, while the screenshot remains the main verification artifact.

## Mobile command dock

The shipped mobile command dock always uses the selected compact sizing,
subtle open-state emphasis, standard safe-area spacing, and five-item layout.
Flight, Info, and Nav are enabled; Ship and Settings remain disabled until
their panels are implemented. Nav owns the mobile Time Warp, camera, Target,
and Trajectory controls. Target and Trajectory availability is independent,
and no gameplay control uses an edge reveal tab. There are no runtime
comparison selectors.

`tests/gui/mobileCommandDock.spec.ts` captures the collapsed dock at 320px and
open Nav states at 320px, 390px, and 430px with simulated 24px and 34px bottom
safe areas. It also captures automatic, recommended/manual, and forced Target
states plus normal, capped, and unavailable Trajectory states. Focused checks
verify that all five items fit, future items stay disabled, dock touches do not
start camera or heading input, outgoing gestures are cancelled, the
surrounding playfield remains interactive, and the desktop layout is
unchanged. The safe-area simulation overrides the dock's local
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

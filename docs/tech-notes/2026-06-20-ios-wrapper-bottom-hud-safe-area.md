# iOS Wrapper Bottom HUD Safe-Area Tuning

## What Changed

- Tuned the bottom HUD spacing around the iOS wrapper's reported safe-area behavior.
- Centralized the bottom HUD offset through `--bottom-safe-area-inset` and `--bottom-hud-edge-gap` on `#app`.
- Centralized the bottom-left controls' horizontal safe-area adjustment through `--left-safe-area-inset`.
- Reused those variables for the bottom pill area and the in-game controls menu so their spacing stays aligned.
- Increased the mobile HUD edge gap to match the current iOS wrapper presentation.

## Why

The iOS wrapper reports a bottom safe area that can make HUD elements sit higher than desired when the app uses the full `env(safe-area-inset-bottom)` value. The current layout intentionally uses a reduced derived inset for the bottom HUD so the UI sits closer to the visual bottom while still accounting for the wrapper environment.

This is tuned for the current iOS wrapper first. Mobile Safari, installed PWA mode, Android browsers, and other WebViews can report different viewport and safe-area values, so those environments should be checked separately before generalizing the spacing.

## Key Values

- `--bottom-safe-area-inset`: derived from `env(safe-area-inset-bottom, 0px)` and currently scaled down for the iOS wrapper.
- `--left-safe-area-inset`: derived from the larger of the left safe area and half the bottom safe area so the bottom-left control avoids the wrapper gesture area.
- `--bottom-hud-edge-gap`: extra design spacing added after the safe-area-derived inset.
- Mobile `--bottom-hud-edge-gap`: the mobile-specific extra bottom spacing under `@media (max-width: 720px)`.

## Key Files

- `src/ui/overlayUI/overlayUIStyles.css` owns the bottom HUD safe-area variables and bottom pill / in-game controls offsets.
- `index.html` enables `viewport-fit=cover`, which allows `env(safe-area-inset-bottom)` to report device or wrapper safe-area values.

## Follow-Ups

- Test the same layout in mobile Safari, installed PWA mode, and at least one non-iOS-wrapper device before treating these values as universal.
- If those environments need different offsets, prefer adding an explicit shell/display-mode class or data attribute instead of overfitting the shared mobile media query.

# Desktop camera pan settings

Date: 2026-07-25

Issue: [#313](https://github.com/chmurson/space-web-game/issues/313)

Shipit state:
`.codex/shipit-workflows/automation/issue-313-desktop-camera-pan-settings.md`

## What changed

- Replaced the persisted `desktopEdgePanEnabled` boolean in the current user
  settings model with `desktopCameraPanMode`, whose accepted values are
  `wheel`, `drag`, and `edge`.
- Added the independent persisted `desktopWheelPanSpeed` setting with
  `slow`, `normal`, and `fast` values.
- Replaced the desktop edge-pan switch with a native radio group labelled
  `Pan camera` and exactly three mutually exclusive choices.
- Kept the existing stepped `desktopEdgePanSpeed` control for edge mode and
  added the same stepped control pattern for wheel/trackpad speed.
- After merging current `main`, kept these controls in the dedicated desktop
  `Camera settings` pane while preserving `main`'s removal of retired mobile
  settings and target-heading planning.

## Why

Issue #313 establishes the storage and settings-surface contract for the
desktop camera modes planned by parent issue
[#303](https://github.com/chmurson/space-web-game/issues/303). Keeping mode
selection and speed persistence in this slice lets the follow-up input work use
one validated settings model without combining UI migration and pointer-event
routing in the same change.

## Ownership boundaries

- `src/userSettingsStorage.ts` owns the persisted union, defaults, and
  allow-list parsing.
- `src/ui/createUiSettingsDialog.ts` owns UI adapter state, speed stepping, and
  conditional control visibility.
- `src/ui/components/UiSettingsDialogSurface.tsx` owns the native radio markup,
  copy, and settings-row composition.
- `src/style.css` extends the existing dialog-row treatment to native radio
  options.
- `src/app/createAppComponents.ts` persists adapter changes and keeps the
  existing edge-pan runtime enabled only when the selected mode is `edge`.

## Important decisions

- Missing, legacy-only, and invalid mode data resolves to `wheel`.
  `desktopEdgePanEnabled` is deliberately not read or migrated.
- Invalid wheel speed resolves to `normal`, independently of edge-pan speed.
- Wheel speed is stored and exposed to the UI but is not connected to pointer
  input in this issue.
- Existing left-drag input remains untouched. Existing edge panning retains its
  speed and runtime gates, with its former boolean enablement replaced only by
  `desktopCameraPanMode === 'edge'`.
- The conflict resolution takes current `main` as authoritative for its
  dedicated Camera pane and removed settings; it ports only this feature's
  radio and speed controls onto that surface.
- This issue does not change mobile/touch gestures.
- The implementation follows `DESIGN.md`; no design-system divergence needed a
  design-document update.

## Validation

- Focused user-settings and app-context/runtime-state Vitest coverage.
- UI adapter Playwright coverage for native radio structure, all three modes,
  independent speed stepping, conditional controls, persistence callbacks,
  fine-pointer visibility, exclusion of retired mobile settings, and dialog
  focus behavior.
- Keyboard navigation coverage uses native radio `ArrowRight` behavior.
- Desktop camera settings screenshots cover wheel and edge conditional states
  at 480 × 720 and were visually inspected for copy, selection, spacing, focus
  affordance, and viewport fit.
- Targeted Biome and diff checks pass, as do the release build, 674 product
  tests, 16 automation-claim tests, and 4 automation-workflow tests.
- The focused camera-pan GUI checks pass 2/2. The final full GUI run passes
  85/86; its sole failure is the unchanged leaderboard expectation
  `Time 7h30m` against the rendered `Time 07h30m`, which reproduces in
  isolation and is outside this feature diff.

## Follow-up and merge boundary

[#314](https://github.com/chmurson/space-web-game/issues/314) owns wheel event
routing, per-mode drag behavior, the wheel-speed runtime mapping, and the
right-button drag fallback. This settings slice intentionally does not make
wheel/trackpad panning operational. Do not merge a player-visible default-wheel
settings surface before #314 is integrated.

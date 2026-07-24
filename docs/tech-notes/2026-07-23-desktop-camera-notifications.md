# Desktop camera notifications

Date: 2026-07-23

Issue: [#295](https://github.com/chmurson/space-web-game/issues/295)

Shipit state:
`.codex/shipit-workflows/automation/issue-295-desktop-camera-tooltips.md`

## What changed

- Desktop `C` feedback now says `Camera following` and identifies either the
  spacecraft or `Current target · <target name>`.
- Desktop `Shift+C` feedback keeps `Camera centered` and identifies the centered
  subject with the same spacecraft/current-target wording.
- Changing the active target in the desktop Target panel now emits the
  appropriate `Camera following` notice.
- Mobile camera and target-selection feedback remains unchanged.

## Why

Following preserves the player's relative camera pan, while recentering clears
that pan. Calling both actions “centered” hid that meaningful difference, and a
desktop Target-panel change could move the followed subject without confirming
the resulting camera context.

## Ownership and decisions

- `src/app/createAppComponents.ts` continues to own keyboard/UI action
  composition and transient-notice creation. Camera state and camera movement
  remain owned by `src/runtime/runtimeActions.ts`.
- The existing transient HUD notice surface is reused without styling or layout
  changes.
- Target-panel feedback is emitted only when a successful desktop panel action
  changes the active target. Switching target-selection mode without changing
  the target does not create a misleading camera notice.
- The desktop fine-pointer media query gates all new feedback, preserving mobile
  behavior.

## Validation

- Targeted Biome and `git diff --check` passed.
- Release config validation, TypeScript, and Vite build passed.
- Product Vitest passed: 65 files, 649 tests.
- Automation claim tests passed: 16 tests.
- Focused desktop camera Playwright coverage passed, including generated
  following/current-target and centered/current-target screenshots.
- Full Playwright passed 81 of 82 tests. The unrelated desktop precise-yaw test
  continued to observe `-0.25` instead of `-1/49` on an isolated rerun; this
  branch has no diff in its input code or test.
- Live browser playtesting confirmed desktop `C`, Target-panel Earth-to-Moon
  selection, and `Shift+C` copy and presentation.
- The existing automation-workflow prompt wording test remains 2 of 3; its
  missing exact policy sentence is unchanged from `origin/main`.

## Follow-ups and known gaps

- The pre-existing precise-yaw GUI regression and automation-workflow wording
  regression remain outside issue #295.

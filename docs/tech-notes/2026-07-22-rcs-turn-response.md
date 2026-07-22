# RCS Turn Response Curve

Shipit state: `.codex/shipit-workflows/automation/issue-282-rcs-turn-response.md`

## What changed

- Manual RCS turn input now ignores the center `1 / 8` of normalized travel.
- The remaining travel is remapped to `0–1` and squared, producing gentler low-deflection turning and a steeper response near full travel.
- Full left and right input still resolve to `-1` and `1`, preserving the existing maximum requested yaw rate.
- Keyboard, accessible RCS slider keys, and touch RCS drag all pass through the same manual turn response.

## Why

The prior proportional response made small analog corrections too strong and had no center dead zone. The shared response curve gives mobile RCS input more control near center without changing maximum turning performance or creating separate behavior for each supported manual input method.

## Key files and ownership

- `src/input/keyboardInput.ts` owns manual keyboard and virtual control composition. It applies the response after combining inputs but before exposing `ControlInput.turn` to the runtime.
- `tests/input/keyboardInput.test.ts` covers the dead-zone boundary, quadratic midpoint, signed response, full-deflection maximum, and combined digital/analog controls through the existing public input API.
- `tests/gui/turnPlanningInput.spec.ts` verifies full and precise desktop turn input through the browser/runtime integration.

## Decisions

- Applied the curve only to manual RCS input. Target-heading plans, orbital assists, and autopilot turns keep their existing response.
- Used a quadratic power curve as the requested exponential response. After removing the dead zone, normalized travel `x` produces `x²` turn input.
- Kept the response private to the existing input module rather than adding a new exported helper or configuration surface.
- Kept slider geometry proportional to physical travel so the thumb continues to show the player's actual deflection while runtime turn speed receives the shaped value.
- Inputs at exactly `1 / 8` resolve to neutral, matching the acceptance criterion that input within 12.5% produces no turn.

## Validation

- Focused Vitest input coverage passed: 9 tests.
- Focused Playwright RCS/turn-input coverage passed: 6 tests.
- Product Vitest suite passed: 63 files / 597 tests.
- Automation claim suite passed: 16 tests.
- Release config validation, TypeScript compilation, and Vite build passed. Vite emitted the existing large-chunk warning.
- Full Playwright suite passed: 79 tests.
- Focused Biome checks and `git diff --check` passed before documentation.
- Visually inspected `tmp/playwright-results/mobileHudScreenshot-captur-36847-d-thrust-controls-in-Flight-mobile-chromium/mobile-rcs-yaw-actual-turn-feedback.png`; the mobile control, far-travel state, and actual-turn feedback matched the expected unchanged UI.
- The complete `npm test` command remains 2/3 in `scripts/engineerWorkflowPrompt.test.mjs` because current `main` does not contain one policy sentence expected by the unchanged automation-workflow test. This branch does not modify either failing file.

## Follow-ups and known gaps

- The `1 / 8` threshold and quadratic exponent are intentionally fixed initial tuning values. Any tuning should follow playtesting and remain scoped to manual RCS response.
- No product follow-up is currently required.

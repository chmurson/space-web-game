# RCS turning time-warp cap

Shipit state: `.codex/shipit-workflows/automation/issue-281-rcs-timewarp-cap.md`

## What changed

Manual RCS turning now temporarily caps effective time warp at 15x, displayed
by the shipped time-warp ladder as x15s. Linear thrust and non-manual navigation
continue to use the existing 100x ceiling, whose highest configured ladder value
is 60x (x1m). When thrust and manual RCS overlap, thrust takes priority and the
effective cap is 60x (x1m).

Releasing the controls retains the existing 320 ms idle delay and restores the
player's pre-control time-warp selection. The restoration controller now accepts
the active control ceiling instead of only an active/inactive flag, so it can
move between the RCS and thrust caps without discarding that selection.

## Why

The corrected RCS ceiling remains separate from the existing thrust safety
behavior. It is intentionally temporary and isolated so it can be adjusted or
removed without changing input producers, physics, or the time-warp ladder.

## Ownership and decisions

- `src/runtime/simulationStep.ts` distinguishes effective manual RCS turning
  from thrust and automated turning, selects the active ceiling, and keeps the
  scenario limit higher priority.
- `src/runtime/navigationTimeWarpController.ts` owns temporary cap transitions,
  overlap priority, delayed restoration, and explicit user warp selections.
- `tests/runtime/` covers the x1m thrust cap, x15s RCS cap, overlap priority,
  idle behavior, feedback, and changing-cap restoration.
- `tests/gui/rcsTimeWarpCap.spec.ts` exercises keyboard RCS and thrust against a
  running game and captures the x15s state.
- No settings, UI copy, turn response, angular physics, autopilot behavior, or
  time-warp options were changed.

## Validation

- Final overlap-contract follow-up: focused runtime/action Vitest 53/53 passed.
- Final overlap-contract follow-up: release build, config validation, and TypeScript
  passed; Vite emitted only the existing large-chunk advisory.
- Final overlap-contract follow-up: focused Playwright passed 1/1, covering
  RCS-only x15s, RCS/thrust x1m, thrust-only x1m, and delayed restoration.
- The x15s screenshot was inspected at
  `tmp/playwright-results/rcsTimeWarpCap-caps-manual-88770-rust-only-keeps-the-x1m-cap-mobile-chromium/manual-rcs-x15s.png`
  and matched the expected active RCS state.
- Final overlap-contract follow-up: focused Biome and `git diff --check` passed.
- Original feature validation: full product Vitest 603/603 passed.
- Automation claim tests: 16 tests passed.
- Focused Playwright: the RCS/thrust/restoration scenario passed. The full
  Playwright run passed 79 of 80 tests; the existing isolated fling-animation
  test missed one intermediate timing sample and passed its immediate focused
  retry.
- The unchanged automation-workflow suite remains 2/3 because current `main`
  lacks one sentence expected by its regression test; this branch does not
  modify that policy or test.
- The in-app browser backend exposed no available browser connection, so the
  successful Playwright interaction and screenshot supplied browser validation.

## Follow-ups and known gaps

- `temporaryMaxRcsTurnWarp` is the single 15x policy constant. Removing the
  special case later should not require input, physics, or UI changes.
- The configured ladder currently contains exactly 15x. If a future ladder
  omits it, the existing constraint helper selects the highest value below it.

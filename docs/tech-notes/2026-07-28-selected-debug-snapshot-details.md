# Selected debug snapshot details

## What changed

The main menu's **Load any game** view now shows a semantic detail list for the
selected recent debug snapshot:

- formatted elapsed game time;
- a friendly known scenario name plus its scenario ID;
- the creation timestamp;
- the local import timestamp when present;
- the local last-export timestamp when present.

Changing the selector immediately refreshes the list. With no recent entries,
the selector and **Load** button remain disabled and no detail list is shown.
The existing explicit **Load** and **Back** actions are unchanged.

## Why

Recent snapshot names and selector timestamps are not always enough to
distinguish similar saves. Issue #324 requires enough current, legacy, and
transport context to identify a snapshot before a later load or export action.

## Ownership and key files

- `src/ui/components/recentSnapshotFormatting.ts` owns detail formatting and
  the small row model consumed by the menu.
- `src/ui/components/MainMenuSurface.tsx` owns selected-entry lookup and the
  accessible `<dl>` markup.
- `src/style.css` keeps the details inside the existing shared glass row and
  adjusts only the taller desktop snapshot panel position.
- `tests/ui/recentSnapshotFormatting.test.ts` covers current, unknown, legacy,
  invalid, malformed current-scenario, and optional-metadata formatting through
  the public detail-row API.
- `tests/gui/mobileHudScreenshot.spec.ts` covers selection changes, the empty
  state, semantic markup, and mobile/desktop screenshots.

## Decisions

- Existing `formatCompactElapsed` behavior is reused for game time instead of
  introducing another duration format.
- Known scenario IDs use the shipped scenario names; unknown current IDs stay
  visible as `Scenario ID: ...`.
- Snapshots without runtime scenario metadata use an explicit versioned legacy
  fallback rather than an empty value.
- Current-version snapshots with a blank or missing scenario ID use
  `Scenario ID unavailable (version ...)` instead of being mislabeled legacy.
- Detail timestamps use one full English date-and-time format, while the
  existing compact selector label remains unchanged.
- Optional rows are omitted rather than filled with placeholder text.
- Granular timestamp, game-time, and scenario formatters stay internal; tests
  verify their behavior through `getRecentSnapshotDetails`.
- Detail terms share the existing recent-snapshot label color and weight while
  retaining their component-specific size, spacing, and uppercase treatment.
- A definition list with a polite live region communicates both label/value
  semantics and selection-driven updates.
- No snapshot schema, storage API, selection state, or loading path changed.

## Validation

- Focused recent-snapshot formatting tests pass (4/4).
- Full product Vitest passes (724/724 across 71 files).
- Automation claim tests pass (16/16).
- Automation workflow tests pass (4/4).
- The release build, config validation, TypeScript, and Vite build pass.
- Biome check passes for changed executable/test files with only three existing
  `!important` warnings elsewhere in `src/style.css`; `git diff --check`
  passes.
- The focused mobile/desktop Playwright coverage passes (2/2).
- The required full `npm run test:gui` run passes 92/93. Its only failure is
  the pre-existing leaderboard assertion that expects accessible text
  `Time 7h30m`; the shipped formatter and rendered accessibility tree expose
  `Time 07h30m`. A focused rerun reproduced that unrelated mismatch.
- The generated `mobile-main-menu-snapshot-details.png` and
  `desktop-main-menu-snapshot-details.png` artifacts were visually inspected.
  All five rows fit without clipping or scrolling and preserve the intended
  canvas-first glass hierarchy at `390x844` and `1024x720`.
- An interactive browser smoke verified the initial disabled empty state, a
  real Free Roam snapshot's current scenario details, Back navigation, and the
  existing explicit Load path.

## Follow-ups and known gaps

- The friendly scenario-name table must be extended when a new shipped
  scenario ID should receive a product-specific display name. Unknown IDs
  remain usable through the explicit ID fallback.
- Import and export actions remain owned by issues #323 and #322.

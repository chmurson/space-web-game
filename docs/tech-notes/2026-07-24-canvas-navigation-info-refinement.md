# Canvas navigation and Info HUD refinement

Date: 2026-07-24
Issue: [#277](https://github.com/chmurson/space-web-game/issues/277)
Pull request: [#289](https://github.com/chmurson/space-web-game/pull/289)

## What changed

- Selected Info rows once again produce live persistent readouts while Info is
  closed. Desktop uses a bounded, vertically scrollable right rail; mobile uses
  a bounded, vertically scrollable top-right rail below the safe-area-aware
  telemetry. The visible readouts reuse the top telemetry pill surface, size,
  and typography; mobile lets the interaction wrapper hug the natural pill
  height for a compact stack. The desktop Info button is text-only because the
  rail itself communicates the selected entries.
- The Info panel presents the first row as an always-selected, immutable active
  target. Its status icon reuses the Target pill/selector glyph and follows
  automatic, pinned, or locked target mode. The derived selection is omitted
  from persistent readouts because the top Target pill already
  exposes its telemetry. `Select all` is removed; `Clear`, `Shift+I`, stored
  player ownership, scenario ownership, and combined Pe/Ap selection continue
  to use the existing pin model.
- Body labels now contain only the body name. They appear for three seconds
  after viewport entry and remain visible for small bodies using 6px entry and
  8px exit apparent-radius thresholds. Selection and targeting do not alter
  this presentation.
- Selected Pe/Ap markers contain only `Pe` or `Ap`; their native title and
  CSS-generated numeric tooltip are removed. The combined persistent readout
  owns their numeric altitudes.
- Every body offscreen indicator is hollow and visually unlabeled. The active
  target keeps stronger cyan emphasis without becoming filled. The spacecraft
  indicator remains solid white and highest priority but is also visually
  unlabeled.
- Body labels, orbit markers, and offscreen placement treat a visible readout
  rail as occupied HUD space. Desktop rail bounds shrink-wrap their visible
  cards until the safe-area-aware maximum height, so empty space below a short
  rail does not become a canvas blocker.
- `DESIGN.md` now describes the restored readouts and the separation between
  target state, Info selection, and canvas visibility.

## Why

The moving playfield should identify locations without duplicating numeric
telemetry. Players can still keep a small set of live distances visible, but
those values now live in stable HUD readouts instead of body labels, marker
tooltips, or edge indicators.

## Ownership and key files

- `src/runtime/infoPins.ts` and `src/runtime/runtimeActions.ts` remain the sole
  owners of selection identity, player mutation, scenario immutability, and
  combined Pe/Ap compatibility. No rail-only state or persistence was added.
- `src/presentation/infoHudPresentation.ts` owns target-first ordering,
  live physical values, and accessible distance context.
- `src/ui/createInfoHud.tsx` and `src/ui/infoHud.css` own the shared Info rows,
  dynamic target-status affordance, desktop/mobile readouts, ownership
  controls, and panel-open suppression.
- `src/ui/touchControls/mobileCommandDock.tsx` owns the mobile rail host and
  Info-open suppression; the fixed rail no longer reserves dock layout space.
- `src/presentation/bodyPresentation/bodyLabelVisibility.ts` owns the
  per-body viewport-entry timer and apparent-size hysteresis.
- `src/presentation/bodyPresentation/updateBodyLabels.ts` owns name-only label
  positioning, accessibility, interaction state, and rail avoidance.
- `src/presentation/bodyPresentation/updateOffscreenIndicators.ts` owns the
  unlabeled body/spacecraft hierarchy, target emphasis, placement priority,
  and rail blocking.
- `src/presentation/trajectoryPresentation.ts` owns selected Pe/Ap marker
  visibility, label-only content, scenario immutability, accessibility, and
  rail avoidance.

## Decisions

- Target changes never mutate Info selections. Body selections stay attached
  to body IDs, while the atomic Pe/Ap selection follows the active target's
  current prediction.
- The active-target row derives checked/disabled presentation without adding
  an Info pin. If the target changes, the previous body falls back to its
  stored player/scenario selection and the new target becomes derived-selected.
- Persistent readouts are derived directly from the ordered Info view. A
  player-owned readout invokes the existing toggle action; a scenario-owned
  readout is disabled and visibly identified.
- The existing `.telemetry-pill` class owns persistent-readout visuals. The
  rail button is only an interaction wrapper, avoiding both duplicated surface
  CSS and a component abstraction for a purely visual primitive.
- The Target pill and rail readouts share `.telemetry-pill-secondary`.
  Body/point names remain primary, while every distance and separator is
  smaller and muted, including unavailable Pe/Ap dashes.
- Body rail readouts reuse the same colored `target-body-sphere` as the Info
  row and Target pill. The combined Pe/Ap readout remains text-only.
- Mobile mirrors the desktop rail direction at the top right, with a
  half-viewport maximum height and vertical overflow. Reusing the existing
  dock host avoids a second portal or readout state path.
- The user-tuned mobile rail starts at
  `max(48px, safe-area-inset-top + 52px)`, keeps the shared `6px` item gap,
  and uses natural-height interaction wrappers.
- Desktop uses `max-height` rather than simultaneous `top` and `bottom`
  constraints. This retains scrolling for a long rail without stretching a
  short rail's collision rectangle to the bottom of the viewport.
- Removing the Info button badge also removes its unused selected-count
  presentation field and calculation; pin ownership and selection state remain
  unchanged.
- Initial scenario presentation counts as viewport entry. The three-second
  interval restarts only after an offscreen-to-onscreen transition.
- The small-body state enters at an apparent radius of 6 CSS pixels and exits
  only above 8 pixels.
- Missing or stale apsis data remains `—`. Selection may therefore show one
  available canvas marker while the combined readout still shows both fields.
- Existing direct body/label/marker selection and empty-canvas gesture
  boundaries were not changed.

## Validation

- Focused presentation/runtime/input coverage: 6 files and 57 tests passed.
- Product Vitest suite: 67 files and 638 tests passed.
- Automation claim suite: 16 tests passed.
- `npm run build`: passed, including config validation, TypeScript, and the
  release Vite build. The existing large-chunk advisory remains.
- `npm run test:gui`: all 85 Playwright tests passed.
- Follow-up threshold adjustment: the focused visibility unit test, TypeScript
  check, and all 3 canvas-navigation GUI tests passed.
- Dynamic target-icon follow-up: 6 focused unit tests, TypeScript, all 4 Info
  GUI tests, and targeted Biome checks passed.
- Derived active-target selection follow-up: all 4 Info presentation tests,
  TypeScript, all 4 Info GUI tests, and targeted Biome checks passed.
- Telemetry-pill rail follow-up: TypeScript, all 4 Info GUI tests, targeted
  Biome checks, and exact computed-style comparisons against the top Target
  pill passed.
- Info count removal follow-up: all 4 Info presentation tests, TypeScript, all
  4 Info GUI tests, targeted Biome checks, and `git diff --check` passed.
- Primary/secondary telemetry follow-up: TypeScript, all 4 Info GUI tests,
  targeted Biome checks, and computed-style comparisons passed for the Target
  altitude and every body/Pe/Ap rail value, including `—`.
- Body-sphere follow-up: TypeScript, all 4 Info GUI tests, targeted Biome
  checks, and matching row/readout color assertions passed.
- Mobile top-right rail follow-up: TypeScript, targeted Biome checks, all 7
  relevant Info/canvas-navigation GUI tests, geometry assertions, and
  original-resolution screenshot inspection passed.
- Compact mobile rail tuning: TypeScript, all 4 Info GUI tests, targeted Biome
  checks, compact-height/top-offset assertions, and original-resolution
  screenshot inspection passed.
- Desktop rail-boundary follow-up: TypeScript, all 7 relevant Info/canvas GUI
  tests, a shrink-wrap regression assertion, targeted Biome checks, and
  original-resolution rail/offscreen screenshot inspection passed.
- Targeted Biome checks passed with only the three unchanged
  `noImportantStyles` warnings in `src/style.css`; `git diff --check` passed.
- `npm test` reaches the pre-existing automation workflow prompt mismatch
  after all product and claim tests pass: the branch policy uses equivalent
  automation-reaction wording but does not contain the test's exact sentence.
  This repository-automation issue is unrelated to the HUD/canvas change.

## Visual inspection

The following generated PNGs were inspected at original resolution:

- Desktop Info with the amber manual-target icon:
  `tmp/playwright-results/infoHud-desktop-Info-creat-7d4ca-while-its-popover-is-closed-mobile-chromium/desktop-info-manual-target-icon.png`
- Desktop Info open, with the dynamic target-status icon and no duplicate rail:
  `tmp/playwright-results/infoHud-desktop-Info-creat-7d4ca-while-its-popover-is-closed-mobile-chromium/desktop-info-popover-selected.png`
- Desktop closed Info with the right-side readout rail:
  `tmp/playwright-results/infoHud-desktop-Info-creat-7d4ca-while-its-popover-is-closed-mobile-chromium/desktop-info-readout-rail.png`
- Desktop selected readouts with unlabeled hollow body arrows and a solid
  unlabeled spacecraft arrow:
  `tmp/playwright-results/canvasNavigationInfo-keeps-be378-creen-arrows-stay-unlabeled-mobile-chromium/desktop-selected-readouts-unlabeled-offscreen.png`
- Mobile Info open with the rail suppressed:
  `tmp/playwright-results/infoHud-mobile-Info-keeps-compact-readouts-at-the-top-right-mobile-chromium/mobile-info-panel-selected.png`
- Mobile vertical readouts at the top right:
  `tmp/playwright-results/infoHud-mobile-Info-keeps-compact-readouts-at-the-top-right-mobile-chromium/mobile-info-readout-rail.png`
- Mobile scenario-owned Moon readout with its body sphere:
  `tmp/playwright-results/infoHud-scenario-owned-pin-82249--checked-immutable-switches-mobile-chromium/mobile-scenario-body-readout.png`
- Mobile combined apsides readout with a label-only available Pe marker and an
  unavailable Ap value:
  `tmp/playwright-results/canvasNavigationInfo-shows-678ae-ers-with-one-mobile-readout-mobile-chromium/mobile-selected-apsides-readout-and-markers.png`

The captures match the intended hierarchy: the active-target row stays selected
as the target changes, its icon follows the shared automatic/manual status
language, and its distance is not duplicated in the rail. Other numeric
distance disclosure stays inside Info/readouts, the center playfield remains
open, rails do not overlap the tested controls or navigation cues, and
Info-open states do not duplicate the selected values.

The regenerated desktop and mobile rail captures also confirm that visible
readouts now match the top telemetry pills without their former card border or
heavier rail-only typography. Desktop and mobile interaction wrappers both hug
their visible pill content.

The regenerated desktop open-panel and closed-rail captures show the Info
button as text-only in both states. Its former count badge is absent while the
rail continues to expose the selected Moon and Pe/Ap readouts.

The latest desktop and mobile rail captures show Moon, Pe, and Ap as primary
labels, while each distance, separator, and unavailable dash uses the smaller,
muted Target-altitude treatment.

The regenerated desktop rail and mobile scenario readout also confirm body
readouts carry the matching sphere without adding an icon to Pe/Ap.

The latest mobile rail captures confirm the readouts now sit below the top
telemetry at the right safe margin, leave the bottom dock and Flight controls
unobstructed, and keep the visible playfield available outside the bounded
scroll region. The compact follow-up confirms the natural-height wrappers and
closer top offset preserve that separation while removing the former excess
vertical whitespace.

The latest desktop captures confirm the rail ends immediately below its last
readout. Canvas labels and indicators can therefore use the rest of the right
edge while long readout sets still scroll within the safe viewport height.

## Follow-ups and known gaps

- The existing release bundle-size advisory is unchanged.
- The unrelated automation workflow prompt wording assertion remains outside
  this UI-focused change.
- No requested HUD or canvas behavior is intentionally deferred.

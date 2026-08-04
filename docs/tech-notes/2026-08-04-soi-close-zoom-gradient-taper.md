# SOI Close-Zoom Gradient Taper

## What Changed

- Started the shared sphere-of-influence gradient taper at 100 times the active
  minimum viewport, rather than 10 times.
- Kept the existing shader gradient profile, field opacity, colour treatment,
  screen-space 1px border, and maximum-zoom widths for all four hidden SOI
  variants.

## Why

The previous taper began too close to the minimum viewport. At normal desktop
close-up zoom levels, the screen-compensated gradient could still occupy much
of the view. The longer, smooth taper makes that transition compact earlier
without introducing a different visual shape between zoom levels.

## Key Files and Ownership

- `src/scene/sphereOfInfluenceVisual.ts` owns SOI field width scaling from the
  active camera viewport.
- `tests/scene/sphereOfInfluenceVisual.test.ts` verifies the unchanged wide
  width, the smooth midpoint, compact desktop close-up width, and exact
  maximum-zoom endpoints.

## Validation

- Focused rendering tests cover the updated viewport scaling behavior.
- The SOI browser capture covers all four maximum-zoom variants on mobile and
  the `soi=1` compact close-up treatment at a 1440 × 900 desktop viewport.

## Follow-Ups

- Visually review the SOI edge at desktop and mobile close zoom once browser
  dependencies are available.

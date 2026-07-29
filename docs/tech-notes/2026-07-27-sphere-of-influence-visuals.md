# Sphere-of-Influence Visual Variants

## What Changed

- Added classical gravitational sphere-of-influence radii to the built-in Earth and Moon bodies.
- Added one hidden soft-field WebGL treatment with four screen-space border
  widths selected by an exact URL flag:
  - `soi=1`: 1 pixel border.
  - `soi=2`: 2 pixel border.
  - `soi=3`: 3 pixel border.
  - `soi=4`: 4 pixel border.
- Kept all SOI rendering absent when the flag is missing or invalid.
- Increased the general camera maximum from 2,500 to 4,000 million metres and the Earth-Moon scenario maximum from 1,000 to 4,000 million metres.

## Why

The experiment needs several comparable border weights for the preferred
soft-field treatment before one becomes part of the normal game surface.
Earth’s full SOI also needs more camera context than the previous Earth-Moon
scenario limit provided, especially in a portrait viewport.

The physical radius uses the classical patched-conic approximation:

`r = a × (m / M)^(2/5)`

With the simulation’s mass and orbit constants, this gives an Earth SOI of about 924,638 km relative to the Sun and a Moon SOI of about 66,169 km relative to Earth. NASA describes the same approximation and rounds the regions to roughly 1 million km for Earth and 66,000 km for the Moon in [Dynamical Behavior of Earth-Moon Trajectories](https://ntrs.nasa.gov/api/citations/19660021054/downloads/19660021054.pdf).

## Key Files and Ownership

- `src/simulation/sphereOfInfluence.ts` owns the physical radius calculation.
- `src/simulation/scenarios/earthMoon.ts` assigns Earth and Moon SOI radii from their primary-body relationships.
- `src/config/featureFlags.ts` owns the exact `soi=1..4` mapping.
- `src/scene/sphereOfInfluenceVisual.ts` owns the shared Three.js field
  construction and its four border widths.
- `src/scene/createGameScene.ts` creates flagged SOI scene objects and keeps them absent by default.
- `src/presentation/bodyPresentation.ts` keeps SOI visuals positioned and hidden with their bodies.
- `src/domain/viewportPresets.ts` and `config/base.yml` own the expanded camera limits.
- `tests/gui/sphereOfInfluenceVisual.spec.ts` captures all four widths at the
  portrait system viewport plus near-zoom checks for the thinnest and thickest
  options.

## Decisions

- The scene shows the SOI cross-section in the orbital plane rather than a literal transparent 3D shell. The simulation is planar, and the fixed camera can sit inside Earth’s true SOI; a full shell would cover the view instead of communicating a useful boundary.
- SOI objects are separate from body meshes. They follow body translation but do not inherit Earth spin, Moon tidal orientation, or cloud rotation.
- Body color remains the visual identity, lightly mixed toward white for contrast against the starfield.
- The field shader derives the radial screen-pixel scale per fragment, so the
  selected border width remains stable while zooming just like a trajectory
  line.
- All four variants preserve the original soft-field fragment-shader gradient;
  only border width changes.
- No player-facing control or copy was added. The four URL values are a review surface, not a shipped setting.
- The 4× Earth-Moon limit was selected after portrait testing showed that a 2× limit still clipped Earth’s full SOI.

## Validation

- `npm test` passed all 75 Vitest files and 782 tests, plus 16
  automation-claim tests and 7 automation-workflow tests.
- Focused SOI/config/camera tests passed 13 tests, including exact flag mapping,
  shared field structure, preserved gradient source, shader-derived screen-space
  width, and disabled-by-default behavior.
- `npm run build` passed config validation, TypeScript compilation, and the
  release Vite build. Vite emitted the repository’s existing large-chunk
  warning.
- The focused SOI GUI test passed and produced six 390 × 844 screenshots: all
  four widths at the 4,000 system viewport plus near-zoom captures for 1 and 4
  pixels. All six artifacts were visually inspected; the progression is
  distinct, the field gradient remains present, the edge is continuous, and
  the near/far pairs retain their selected thickness.
- The full 96-test GUI run passed 92 tests, including the changed tutorial
  replay. A mobile target-framing failure passed on isolated rerun. Three
  failures remain in untouched debug-snapshot-detail and highscore screenshot
  areas; the leaderboard case is the existing `7h30m` versus `07h30m`
  accessibility-name mismatch.

## Follow-Ups

- Choose one of the four border widths before removing the feature flag or
  adding any player-facing explanation.
- If future scenarios add bodies, provide each body’s SOI radius from its appropriate primary-body relationship.

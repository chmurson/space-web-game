# Sphere-of-Influence Visual Variants

## What Changed

- Added classical gravitational sphere-of-influence radii to the built-in Earth
  and Moon bodies.
- Added one hidden soft-field WebGL treatment selected by exact URL flags.
  `soi=1` is the approved base; `soi=2` through `soi=5` keep the same 1px
  screen-space border and progressively increase only the near-edge field
  strength:
  - `soi=1`: base gradient strength (`1×`).
  - `soi=2`: `1.5×` near-edge gradient strength.
  - `soi=3`: `2×` near-edge gradient strength.
  - `soi=4`: `2.5×` near-edge gradient strength.
  - `soi=5`: `3×` near-edge gradient strength.
- Kept all SOI rendering absent when the flag is missing or invalid.
- Increased the general camera maximum from 2,500 to 4,000 million metres and
  the Earth-Moon scenario maximum from 1,000 to 4,000 million metres.

## Why

The experiment needs a clear comparison of the body-colored field intensity
close to the SOI edge before one treatment becomes part of the normal game
surface. The selected `soi=1` rendering remains the unchanged baseline, while
four stronger values make the visual decision isolated and measurable.

Earth’s full SOI also needs more camera context than the previous Earth-Moon
scenario limit provided, especially in a portrait viewport.

The physical radius uses the classical patched-conic approximation:

`r = a × (m / M)^(2/5)`

With the simulation’s mass and orbit constants, this gives an Earth SOI of about
924,638 km relative to the Sun and a Moon SOI of about 66,169 km relative to
Earth. NASA describes the same approximation and rounds the regions to roughly
1 million km for Earth and 66,000 km for the Moon in
[Dynamical Behavior of Earth-Moon Trajectories](https://ntrs.nasa.gov/api/citations/19660021054/downloads/19660021054.pdf).

## Key Files and Ownership

- `src/simulation/sphereOfInfluence.ts` owns the physical radius calculation.
- `src/simulation/scenarios/earthMoon.ts` assigns Earth and Moon SOI radii from
  their primary-body relationships.
- `src/config/featureFlags.ts` owns the exact `soi=1..5` mapping.
- `src/scene/sphereOfInfluenceVisual.ts` owns the shared Three.js field,
  screen-space border, and near-edge strength uniform.
- `src/scene/createGameScene.ts` creates flagged SOI scene objects and keeps
  them absent by default.
- `src/presentation/bodyPresentation.ts` keeps SOI visuals positioned and
  hidden with their bodies.
- `src/domain/viewportPresets.ts` and `config/base.yml` own the expanded camera
  limits.
- `tests/gui/sphereOfInfluenceVisual.spec.ts` captures all five strengths at the
  portrait system viewport plus near-zoom checks for the base and strongest
  options.

## Decisions

- The scene shows the SOI cross-section in the orbital plane rather than a
  literal transparent 3D shell. The simulation is planar, and the fixed camera
  can sit inside Earth’s true SOI; a full shell would cover the view instead of
  communicating a useful boundary.
- SOI objects are separate from body meshes. They follow body translation but
  do not inherit Earth spin, Moon tidal orientation, or cloud rotation.
- Body color remains the visual identity, lightly mixed toward white for
  contrast against the starfield.
- The field shader derives the radial screen-pixel scale per fragment, so the
  1px border remains stable while zooming just like a trajectory line.
- Every option uses the exact base geometry and shader path. A single uniform
  multiplies only the outer-field term by `1`, `1.5`, `2`, `2.5`, or `3`; the
  interior gradient, border, color, and blend mode stay fixed.
- The `0.5×` increments make the five-way comparison monotonic while keeping the
  strongest field below the existing border opacity.
- No player-facing control or copy was added. The five URL values are a review
  surface, not a shipped setting.
- The 4× Earth-Moon limit was selected after portrait testing showed that a 2×
  limit still clipped Earth’s full SOI.

## Validation

- `npm test` passed all 75 Vitest files and 782 tests, plus 16
  automation-claim tests and 7 automation-workflow tests.
- The focused SOI/config run passed 11 tests, including exact `soi=1..5`
  mapping, shared field structure, the unchanged `1×` base, five strength
  uniforms, the common 1px border, and disabled-by-default behavior.
- `npm run build` passed config validation, TypeScript compilation, and the
  release Vite build. Vite emitted the repository’s existing large-chunk
  warning.
- The focused SOI GUI test passed and produced seven 390 × 844 screenshots:
  all five strengths at the 4,000 system viewport plus near-zoom captures for
  the base and strongest options. All seven artifacts were visually inspected;
  near-edge intensity increases monotonically, the border remains continuous
  and visually uniform, and neither near-zoom image clips the circular edge.
- The full 97-test GUI run passed 94 tests, including the changed SOI capture.
  The same three failures recorded before this follow-up remain in untouched
  debug-snapshot-detail and highscore screenshot areas; the leaderboard case is
  the existing `7h30m` versus `07h30m` accessibility-name mismatch.
- Biome and `git diff --check` passed for the changed source and tests.

## Follow-Ups

- Choose one of the five near-edge gradient strengths before removing the
  feature flag or adding any player-facing explanation.
- If future scenarios add bodies, provide each body’s SOI radius from its
  appropriate primary-body relationship.

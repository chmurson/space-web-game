# Sphere-of-Influence Visual Variants

## What Changed

- Added classical gravitational sphere-of-influence radii to the built-in Earth
  and Moon bodies.
- Added one hidden soft-field WebGL treatment selected by exact URL flags. All
  four options use the previously selected `soi=2` near-edge strength, current
  former-`soi=5` constant-perceived-width gradient, and the same 1px
  screen-space border. They remain identical through wide and middle zoom, then
  differ only in the final local-zoom taper. At maximum zoom-in they retain:
  - `soi=1`: `25%` of the former `soi=5` edge-gradient width.
  - `soi=2`: `15%` of the former `soi=5` edge-gradient width.
  - `soi=3`: `10%` of the former `soi=5` edge-gradient width.
  - `soi=4`: `5%` of the former `soi=5` edge-gradient width.
- Kept all SOI rendering absent when the flag is missing or invalid.
- Increased the general camera maximum from 2,500 to 4,000 million metres and
  the Earth-Moon scenario maximum from 1,000 to 4,000 million metres.

## Why

After the near-edge intensity comparison, the maintainer selected its second
variant, then selected the fully compensated former `soi=5` gradient-width
behavior. The current experiment preserves that choice until the camera becomes
very local and compares four substantially thinner maximum-zoom endpoints so
the gradient does not become a thick colored wall.

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
- `src/config/featureFlags.ts` owns the exact `soi=1..4` maximum-zoom thinness
  mapping.
- `src/scene/sphereOfInfluenceVisual.ts` owns the shared Three.js field,
  selected near-edge strength, screen-space border, former-`soi=5` base width,
  and local-zoom taper.
- `src/render/sceneUpdates.ts` updates the gradient-width uniform whenever the
  camera viewport is updated.
- `src/runtime/runtimeActions.ts` provides the active scenario's minimum and
  maximum viewports as the shared taper anchors.
- `src/scene/createGameScene.ts` creates flagged SOI scene objects and keeps
  them absent by default.
- `src/presentation/bodyPresentation.ts` keeps SOI visuals positioned and
  hidden with their bodies.
- `src/domain/viewportPresets.ts` and `config/base.yml` own the expanded camera
  limits.
- `tests/gui/sphereOfInfluenceVisual.spec.ts` captures all four variants at the
  portrait system viewport, a shared middle framing, and maximum zoom-in.

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
- Every option uses the exact same geometry, selected `1.5×` near-edge
  strength, interior gradient, 1px true border, color, blend mode, and lifecycle.
- All variants use the former `soi=5` base formula, scaling world-space gradient
  width by the current-to-maximum viewport ratio so its perceived width stays
  constant. They remain identical until the active viewport reaches ten times
  its minimum, then a smooth local-zoom taper reaches the selected 25%, 15%,
  10%, or 5% endpoint exactly at maximum zoom-in.
- The active camera minimum anchors the transition, so scenario-specific zoom
  limits do not require an SOI-specific viewport constant.
- One width-scale uniform keeps the comparison in the existing shader and
  avoids separate meshes, materials, or camera-specific variants.
- No player-facing control or copy was added. The four URL values are a review
  surface, not a shipped setting.
- The 4× Earth-Moon limit was selected after portrait testing showed that a 2×
  limit still clipped Earth’s full SOI.

## Validation

- `npm test` passed all 75 Vitest files and 784 tests, plus 16
  automation-claim tests and 7 automation-workflow tests.
- The focused SOI/config/camera and camera-consuming presentation run passed 37
  tests across 5 files, verifying exact `soi=1..4` mapping, current `soi=5` as
  the shared base, unchanged middle-zoom width, all four maximum-zoom
  endpoints, the common 1px border, camera-bound updates, and
  disabled-by-default behavior.
- `npm run build` passed config validation, TypeScript compilation, and the
  release Vite build. Vite emitted the repository’s existing large-chunk
  warning.
- The focused SOI GUI test passed and produced twelve 390 × 844 screenshots:
  all four variants at wide, edge-centered middle, and actual maximum zoom-in.
  All twelve were visually inspected; wide and middle states match, while the
  maximum-zoom wall narrows monotonically across the 25%, 15%, 10%, and 5%
  endpoints and the true border remains continuous and uniform.
- The full GUI run passed 94 of 97 tests, including the changed SOI test. The
  same three unrelated baseline failures remain in the two debug-snapshot-detail
  assertions and the highscore `7h30m` versus `07h30m` accessibility name.

## Follow-Ups

- Choose one of the four maximum-zoom thinness variants before removing the
  feature flag or adding any player-facing explanation.
- If future scenarios add bodies, provide each body’s SOI radius from its
  appropriate primary-body relationship.

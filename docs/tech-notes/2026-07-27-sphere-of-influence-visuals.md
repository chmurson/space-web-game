# Sphere-of-Influence Visual Variants

## What Changed

- Added classical gravitational sphere-of-influence radii to the built-in Earth
  and Moon bodies.
- Added one hidden soft-field WebGL treatment selected by exact URL flags. All
  five options use the previously selected `soi=2` near-edge strength and the
  same 1px screen-space border. They differ only in how the gradient's perceived
  width responds to zoom:
  - `soi=1`: current world-space behavior (`0%` compensation).
  - `soi=2`: perceived-width growth is `25%` weaker.
  - `soi=3`: perceived-width growth is `50%` weaker.
  - `soi=4`: perceived-width growth is `75%` weaker.
  - `soi=5`: perceived width remains constant (`100%` compensation).
- Kept all SOI rendering absent when the flag is missing or invalid.
- Increased the general camera maximum from 2,500 to 4,000 million metres and
  the Earth-Moon scenario maximum from 1,000 to 4,000 million metres.

## Why

After the near-edge intensity comparison, the maintainer selected its second
variant. The next experiment isolates how much the visible gradient band should
grow while zooming in, ranging from the existing world-space behavior to a
trajectory-like constant screen-space width.

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
- `src/config/featureFlags.ts` owns the exact `soi=1..5` zoom-compensation
  mapping.
- `src/scene/sphereOfInfluenceVisual.ts` owns the shared Three.js field,
  selected near-edge strength, screen-space border, and gradient-width scaling.
- `src/render/sceneUpdates.ts` updates the gradient-width uniform whenever the
  camera viewport is updated.
- `src/runtime/runtimeActions.ts` provides the active scenario's maximum
  viewport as the common comparison anchor.
- `src/scene/createGameScene.ts` creates flagged SOI scene objects and keeps
  them absent by default.
- `src/presentation/bodyPresentation.ts` keeps SOI visuals positioned and
  hidden with their bodies.
- `src/domain/viewportPresets.ts` and `config/base.yml` own the expanded camera
  limits.
- `tests/gui/sphereOfInfluenceVisual.spec.ts` captures all five variants at the
  portrait system viewport and at the same nearer zoom.

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
  strength, interior gradient, border, color, blend mode, and lifecycle.
- All variants match at the active scenario's maximum viewport. For zoom
  compensation `c`, current viewport `v`, and maximum viewport `m`, the shader
  scales the world-space gradient width by `(1 - c) + c × v / m`. This reduces
  the extra perceived-width growth by exactly `c`; at `c = 1`, world-space
  width shrinks in proportion to the viewport and screen-space width is
  constant.
- One width-scale uniform keeps the comparison in the existing shader and
  avoids separate meshes, materials, or camera-specific variants.
- No player-facing control or copy was added. The five URL values are a review
  surface, not a shipped setting.
- The 4× Earth-Moon limit was selected after portrait testing showed that a 2×
  limit still clipped Earth’s full SOI.

## Validation

- `npm test` passed all 75 Vitest files and 784 tests, plus 16
  automation-claim tests and 7 automation-workflow tests.
- The focused SOI/config/camera run passed 15 tests across 3 files, verifying
  exact `soi=1..5` mapping, the selected shared field, each compensation value,
  the common 1px border, camera-to-shader updates, and disabled-by-default
  behavior. The two camera-consuming presentation suites passed another 22
  tests.
- `npm run build` passed config validation, TypeScript compilation, and the
  release Vite build. Vite emitted the repository’s existing large-chunk
  warning.
- The focused SOI GUI test passed and produced ten 390 × 844 screenshots: all five
  variants at the 4,000 maximum viewport and after the same three zoom-in
  actions. All ten were visually inspected; the far-zoom field is shared, the
  near-zoom width narrows monotonically from `soi=1` to `soi=5`, and the border
  remains continuous and uniform.
- The full GUI run passed 94 of 97 tests, including the changed SOI test. The
  same three unrelated baseline failures remain in the two debug-snapshot-detail
  assertions and the highscore `7h30m` versus `07h30m` accessibility name.

## Follow-Ups

- Choose one of the five zoom-scaling variants before removing the feature flag
  or adding any player-facing explanation.
- If future scenarios add bodies, provide each body’s SOI radius from its
  appropriate primary-body relationship.

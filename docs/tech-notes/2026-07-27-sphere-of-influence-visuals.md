# Sphere-of-Influence Visual Variants

## What Changed

- Added classical gravitational sphere-of-influence radii to the built-in Earth and Moon bodies.
- Added four hidden WebGL presentation variants selected by an exact URL flag:
  - `soi=1`: soft field with an emphasized edge.
  - `soi=2`: clean boundary band with a restrained glow.
  - `soi=3`: screen-space dashed perimeter.
  - `soi=4`: concentric contour grid with radial spokes.
- Kept all SOI rendering absent when the flag is missing or invalid.
- Increased the general camera maximum from 2,500 to 4,000 million metres and the Earth-Moon scenario maximum from 1,000 to 4,000 million metres.

## Why

The experiment needs several comparable visual treatments before one becomes part of the normal game surface. Earth’s full SOI also needs more camera context than the previous Earth-Moon scenario limit provided, especially in a portrait viewport.

The physical radius uses the classical patched-conic approximation:

`r = a × (m / M)^(2/5)`

With the simulation’s mass and orbit constants, this gives an Earth SOI of about 924,638 km relative to the Sun and a Moon SOI of about 66,169 km relative to Earth. NASA describes the same approximation and rounds the regions to roughly 1 million km for Earth and 66,000 km for the Moon in [Dynamical Behavior of Earth-Moon Trajectories](https://ntrs.nasa.gov/api/citations/19660021054/downloads/19660021054.pdf).

## Key Files and Ownership

- `src/simulation/sphereOfInfluence.ts` owns the physical radius calculation.
- `src/simulation/scenarios/earthMoon.ts` assigns Earth and Moon SOI radii from their primary-body relationships.
- `src/config/featureFlags.ts` owns the exact `soi=1..4` mapping.
- `src/scene/sphereOfInfluenceVisual.ts` owns the four Three.js visual constructions.
- `src/scene/createGameScene.ts` creates flagged SOI scene objects and keeps them absent by default.
- `src/presentation/bodyPresentation.ts` keeps SOI visuals positioned and hidden with their bodies.
- `src/domain/viewportPresets.ts` and `config/base.yml` own the expanded camera limits.

## Decisions

- The scene shows the SOI cross-section in the orbital plane rather than a literal transparent 3D shell. The simulation is planar, and the fixed camera can sit inside Earth’s true SOI; a full shell would cover the view instead of communicating a useful boundary.
- SOI objects are separate from body meshes. They follow body translation but do not inherit Earth spin, Moon tidal orientation, or cloud rotation.
- Body color remains the visual identity, lightly mixed toward white for contrast against the starfield.
- The dashed variant registers with the existing screen-space dash updater so dash and gap sizes remain stable while zooming.
- No player-facing control or copy was added. The four URL values are a review surface, not a shipped setting.
- The 4× Earth-Moon limit was selected after portrait testing showed that a 2× limit still clipped Earth’s full SOI.

## Validation

- `npm test` passed all 72 Vitest files and 727 tests, plus 16 automation-claim tests and 4 automation-workflow tests.
- `npm run build` passed config validation, TypeScript compilation, and the release Vite build. Vite emitted the repository’s existing large-chunk warning.
- Desktop browser screenshots at a 1,440 × 900 viewport confirm all four variants are distinct and keep bodies, trajectory cues, and HUD legible.
- A 390 × 844 portrait screenshot at the 4,000 maximum confirms the complete Earth boundary fits the viewport.
- The changed tutorial trail GUI replay passes at the shared 4,000 viewport preset, and its generated screenshot was inspected successfully.
- The full 91-test GUI run initially passed 88 tests. The changed replay test and an unrelated time-warp fling timing failure passed on focused rerun. One unrelated existing leaderboard assertion still fails because the accessibility tree exposes `Time 07h30m` while the test expects `Time 7h30m`.

## Follow-Ups

- Choose one of the four treatments before removing the feature flag or adding any player-facing explanation.
- If future scenarios add bodies, provide each body’s SOI radius from its appropriate primary-body relationship.

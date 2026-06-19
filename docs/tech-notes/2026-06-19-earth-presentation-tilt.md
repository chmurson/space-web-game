# Earth Presentation Tilt

Date: 2026-06-19
Issue: https://github.com/chmurson/space-web-game/issues/29
Branch: `codex/issue-29-earth-presentation-tilt`
Shipit state: `.codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md`

## What Changed

Earth now receives a fixed render-only axial presentation tilt before its
elapsed-time visual spin is applied.

The tilt leans the north pole away from the camera-side X/Z plane direction, so
the rendered composition de-emphasizes the north pole and exposes more equator
and southern hemisphere.

## Why

The textured Earth was reading too straight-on relative to the elevated gameplay
camera. A fixed presentation tilt improves the hemisphere framing without
changing the simulation plane, body positions, orbital mechanics, scenario data,
or controls.

## Key Files

- `src/presentation/bodyRotation.ts` owns the Earth-only tilt quaternion and
  existing body visual rotation policy.
- `src/presentation/bodyPresentation.ts` applies the composed body quaternion to
  Three.js body meshes during the existing visual sync.
- `tests/presentation/bodyRotation.test.ts` covers the tilt angle, direction,
  stable spin axis, Earth spin, cloud drift, and Moon texture orientation.

## Decisions

- Use a real-world-like `23.5` degree axial tilt as the fixed presentation
  angle.
- Compose Earth orientation as `fixed tilt * visual spin` so Earth spins around
  the tilted local north axis.
- Keep cloud drift as a child-local Y rotation. The Earth cloud layer and
  atmosphere rim remain children of the Earth mesh, so both inherit the same
  fixed parent tilt.
- Keep the change presentation-only. Simulation state, physics, labels,
  trajectories, and asset loading are unchanged.
- Avoid a generalized body-axis or seasonal-lighting system until day/night
  shading or a real Sun object needs it.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts`
  passed: 1 file, 9 tests.
- `npm test` passed: 37 files, 232 tests.
- `npm run build` passed. Vite emitted the existing large chunk warning.
- `npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-19-earth-presentation-tilt.md .codex/shipit-workflows/codex/issue-29-earth-presentation-tilt.md`
  passed for the 3 configured Biome-tracked files.
- Desktop and mobile CDP browser checks reached `?scenario=earth-moon` with
  visible Earth, HUD, and Moon label. Console output showed only Vite debug
  messages and the existing missing `favicon.ico`.
- Screenshot sanity checks passed:
  - desktop `1280x800`, `colors=5714`, `mean=0.0355668`
  - mobile `780x1688`, `colors=13289`, `mean=0.041324`
- `coderabbit --base main --agent` completed with 0 findings.
- `npm run deploy:netlify` deployed staging URL
  https://fanciful-bunny-d77b4b.netlify.app and unique deploy URL
  https://6a351d079be61703af22d1b7--fanciful-bunny-d77b4b.netlify.app.

## Follow-Ups

- Issue #6 can decide whether this tilt should feed into future render-driven
  day/night shading.

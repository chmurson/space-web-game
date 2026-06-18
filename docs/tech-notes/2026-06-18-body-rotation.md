# Body Rotation

Date: 2026-06-18
Issue: https://github.com/chmurson/space-web-game/issues/5
Branch: `codex/issue-5-body-rotation`
Shipit state: `.codex/shipit-workflows/codex/issue-5-body-rotation.md`

## What Changed

Earth and Moon body meshes now receive render-only Y-axis rotations during the
existing body presentation update.

Earth spins from elapsed simulation time using an approximately real 24-hour
visual day.
The Moon uses the current Moon-to-Earth vector so the texture-centered local
face stays oriented toward Earth in Earth-Moon scenarios.

## Why

Textured bodies read as static when their meshes never rotate. Deriving visual
rotation from simulation state keeps reset/restart behavior deterministic while
leaving physics, trajectory prediction, saves, and scenario data untouched.

## Key Files

- `src/presentation/bodyRotation.ts` owns the pure render rotation policy.
- `src/presentation/bodyPresentation.ts` applies body mesh positions and visual
  rotations.
- `src/runtime/frameLoop.ts` passes elapsed simulation time into the body
  presentation layer.
- `tests/presentation/bodyRotation.test.ts` covers Earth spin and Moon
  tidally locked orientation math.

## Decisions

- Body rotation is presentation-only and does not mutate `SimulationState`.
- Earth uses a 24-hour visual day rather than a strict sidereal day. This keeps
  the presentation close to real-world intuition without introducing precision
  that the simplified game model does not otherwise need.
- Moon orientation is based on body positions, not accumulated elapsed time, so
  it stays deterministic and naturally tracks the Earth-facing direction.
- The NASA LROC Moon texture is treated as a near-side-centered equirectangular
  map. Three.js maps the texture center to the sphere's local `+X` axis, so the
  tidal-lock rotation points local `+X` toward Earth.
- Texture loading, material setup, lighting, clouds, and simulation physics were
  left unchanged to avoid overlap with active loading/asset work.

## Validation

- `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts`
  passed: 1 file, 4 tests.
- `npm test` passed: 35 files, 210 tests.
- `npm run build` passed. Vite emitted the existing chunk-size warning.
- `npx biome check src/presentation/bodyRotation.ts src/presentation/bodyPresentation.ts src/runtime/frameLoop.ts tests/presentation/bodyRotation.test.ts`
  passed after applying safe formatting fixes.
- Desktop and mobile browser smoke checks reached `?scenario=earth-moon` with a
  correctly sized WebGL canvas and visible textured Earth, HUD, spacecraft label,
  and Moon indicator.
- `coderabbit --base main --agent` completed with 0 findings after the branch
  was rebased onto the latest `origin/main`.
- `npm run deploy:netlify` deployed to
  https://fanciful-bunny-d77b4b.netlify.app.
- After the follow-up change from a 6-hour stylized visual day to a 24-hour
  visual day, validation was rerun:
  - `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts`
    passed: 1 file, 5 tests.
  - `npm test` passed: 36 files, 215 tests.
  - `npm run build` passed. Vite emitted the existing chunk-size warning.
  - `npx biome check --write src/presentation/bodyRotation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md`
    passed with no fixes.
  - `npm run deploy:netlify` deployed unique URL
    https://6a34196553539c28b4a10349--fanciful-bunny-d77b4b.netlify.app.
  - A final CodeRabbit rerun was attempted twice but rate-limited.
- After the Moon near-side texture alignment adjustment, validation was rerun:
  - `npx vitest run --config vite.config.ts tests/presentation/bodyRotation.test.ts`
    passed: 1 file, 6 tests.
  - `npm test` passed: 36 files, 216 tests.
  - `npm run build` passed. Vite emitted the existing chunk-size warning.
  - `npx biome check --write src/presentation/bodyRotation.ts tests/presentation/bodyRotation.test.ts docs/tech-notes/2026-06-18-body-rotation.md .codex/shipit-workflows/codex/issue-5-body-rotation.md`
    passed with no fixes.
  - `npm run deploy:netlify` deployed unique URL
    https://6a341c10e5c2722df0b99425--fanciful-bunny-d77b4b.netlify.app.
  - A final CodeRabbit rerun was attempted but rate-limited.
- On merge to `main`, final validation was rerun and passed: Biome check,
  focused rotation tests, full `npm test`, and `npm run build`.
- `npm run deploy:netlify:production` deployed production URL
  https://space-web-game.netlify.app and unique deploy URL
  https://6a341f6b53539c3c9aa10350--space-web-game.netlify.app.

## Follow-Ups

- Issue #6 can decide whether this visual rotation policy should feed into a
  sun-direction or day/night material path.

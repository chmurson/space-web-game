# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

## Scoped Instructions

- Before modifying source code, look for the nearest `AGENTS.md` that applies to the target files, starting in the target directory and walking upward.
- When adding a new scoped `AGENTS.md`, add a link here with a brief explanation of its scope.
- [extension/space-web-game-devtools/AGENTS.md](extension/space-web-game-devtools/AGENTS.md): Chrome DevTools extension guidance, including when to bump the extension manifest version.

## Deployment

- This repository has one production Netlify target and multiple non-production staging targets:
- Production site for `main`: `space-web-game`
- Production URL for `main`: `https://space-web-game.netlify.app`
- Production site ID for `main`: `0ed821be-c897-4f15-ad17-859ae866ca1d`
- Default shared staging site for non-`main` branches: `fanciful-bunny-d77b4b`
- Default shared staging URL for non-`main` branches: `https://fanciful-bunny-d77b4b.netlify.app`
- Default shared staging site ID for non-`main` branches: `e0d8dda6-9340-4d3c-9e78-941ccbb63d5f`
- Woven moth staging site: `space-web-game-woven-moth`
- Woven moth staging URL: `https://space-web-game-woven-moth.netlify.app`
- Woven moth staging site ID: `65b8db6a-f0cc-49e3-b4e4-cc994699ba6a`
- Deploy scripts use explicit `--site` selection and do not rely on `.netlify/state.json`.
- The default non-production staging target can be changed per worktree by creating the gitignored `.netlify-deploy.local.json` with `{ "defaultStagingTarget": "woven-moth" }` or another supported staging target key.
- If the current branch is `main`, deploy to Netlify after each commit that changes executable app code, runtime behavior, or user-visible site output.
- If the current branch is not `main`, deploy to the configured staging site after each meaningful code change unless there is a clear reason not to.
- On non-`main` branches, deploy to the configured staging site before handing work back to the user when the work changed executable app code, runtime behavior, or user-visible site output.
- Planning-only, docs-only, and repository-instruction-only edits do not require Netlify deploys.
- Do not deploy non-`main` branches to the `main` production site.
- Use `npm run deploy:netlify` for branch-aware deploys.
- Use `npm run deploy:netlify:production` or `npm run deploy:netlify:staging` only when an explicit override is needed.
- Use `npm run deploy:netlify:staging:woven-moth` to explicitly deploy to the woven moth staging site.
- After any staging deploy, share the staging URL with the user.

## Verification

- Run relevant tests, build checks, and validation commands when the change affects executable code, behavior, configuration, or shipped assets.
- Planning-only, docs-only, and repository-instruction-only edits do not require test runs, build runs, or deploys unless the user explicitly asks for them.
- When verification is skipped because the change is non-executable, say so briefly in the response.

## GitHub Issue Intake

- Every time an agent picks up work from GitHub, use the Shipit workflow from the start and apply the Ponytail lens throughout the work.
- When starting implementation for a GitHub issue, mark the issue in progress before changing product code using the repo's current tracking mechanism, then record the issue URL/comment in Shipit state.
- Before proceeding with a ticket, read the issue body and all comments, then make sure the scope is clear.
- Record relevant issue comments, decisions, non-goals, and any scope uncertainty in the Shipit state before implementation.
- If issue comments conflict or leave the requested behavior unclear, pause and clarify before changing product code.

## Shipit Reviews

- Run CodeRabbit as part of Shipit review with `coderabbit --base main --agent`.
- Apply the Ponytail review lens during Shipit review: look for code to delete, simplify, or replace with native/standard-library behavior, and call out YAGNI/speculative abstractions before approving the branch.
- If CodeRabbit fails, times out, or cannot produce findings for any reason, explicitly alert the user so they can debug it or run it themselves.
- Treat automated review findings, including CodeRabbit findings, as hypotheses rather than facts. Inspect the current code and diff before deciding whether each finding is valid, stale, out of scope, or based on an incorrect proposed fix.

## Code Quality

- Do not widen module APIs only to make tests easier to write.
- Prefer testing behavior through existing public functions instead of exporting internal helpers just for tests.
- For HUD, menu, drawer, touch-control, and overlay styling, prefer shared UI surface tokens in `src/style.css` such as `--ui-glass-control-bg`, `--ui-glass-panel-bg`, `--ui-glass-label-bg`, and their related border/blur/shadow variables before adding local colors.
- Reuse or extend shared UI surface styles when a new element has the same role as an existing pill, popup, drawer, label, or glass panel. Add local CSS values only when the visual treatment is genuinely component-specific, and keep those values close to the component that owns them.

## Recommended Game Studio Skills

- Use `game-studio:three-webgl-game` for core Three.js runtime work, including scene setup, render-loop behavior, camera controls, pointer input, visual simulation presentation, and changes around `src/scene`, `src/render`, `src/rendering`, `src/presentation`, and related input code.
- Use `game-studio:web-game-foundations` for architecture decisions that affect the game loop, simulation/render boundaries, runtime state, scenario flow, save/debug behavior, or performance strategy across `src/runtime`, `src/simulation`, `src/scenario`, and app composition.
- Use `game-studio:game-ui-frontend` for HUD, menus, dialogs, overlays, touch controls, responsive layout, settings panels, and other DOM UI under `src/ui` or CSS changes that affect the playable surface.
- Use `game-studio:game-playtest` after gameplay, camera, rendering, HUD, input, or responsive-layout changes to verify the browser experience with screenshots, interaction checks, and desktop/mobile viewport coverage.
- Use `game-studio:web-3d-asset-pipeline` only when adding or optimizing shipped 3D assets such as GLB/glTF models, textures, compression, LODs, or collision assets.
- Do not use `game-studio:phaser-2d-game` for this repo unless the project deliberately migrates to Phaser; this codebase is a plain TypeScript/Vite/Three.js app.
- Do not use `game-studio:react-three-fiber-game` unless the project deliberately moves to React-hosted Three.js rendering.
- Use `game-studio:sprite-pipeline` only if the project adds generated 2D sprite animation assets.

Future skill candidates to remember:

- Consider `game-studio:react-three-fiber-game` if the project later moves toward React-hosted Three.js UI or scene composition.
- Consider `game-studio:sprite-pipeline` if the game later adds generated 2D sprite effects, icons, animation strips, or sprite-based UI/gameplay assets.
- Consider `game-studio:web-3d-asset-pipeline` if asset work becomes larger than simple model loading, especially for GLB/glTF optimization, texture packaging, compression, LODs, or collision assets.

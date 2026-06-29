# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

## Scoped Instructions

- Before modifying source code, look for the nearest `AGENTS.md` that applies to the target files, starting in the target directory and walking upward.
- When adding a new scoped `AGENTS.md`, add a link here with a brief explanation of its scope.
- [extension/space-web-game-devtools/AGENTS.md](extension/space-web-game-devtools/AGENTS.md): Chrome DevTools extension guidance, including when to bump the extension manifest version.

## Design Guidance

- `DESIGN.md` is the repo-local source of truth for the current shipped game-surface visual system.
- Before UI, HUD, menu, dialog, overlay, touch-control, visual style, copy tone, or responsive layout changes, read `DESIGN.md` before editing files.
- If implementation intentionally diverges from `DESIGN.md`, update `DESIGN.md` in the same change or call out why the divergence should become a follow-up issue.
- For HUD, menu, overlay, touch-control, and responsive UI work, continue using `npm run test:gui` when relevant and inspect the generated screenshot artifact.
- Extension UI should also follow any scoped guidance in `extension/space-web-game-devtools/AGENTS.md`; if extension-specific design rules later diverge, add a scoped design note instead of overloading the game-surface guidance.

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
- PRs targeting `main` use the automated Netlify PR preview workflow in `.github/workflows/netlify-pr-preview.yml`.
- The PR preview workflow builds the PR head, deploys `dist/` with a stable `pr-<number>` Netlify alias, and reports the preview URL in the workflow summary and a stable PR comment.
- Required PR preview secret is `NETLIFY_AUTH_TOKEN`; preview deploys reuse the production Netlify site ID with a non-production `pr-<number>` alias and do not pass `--prod`.
- The PR preview workflow runs for same-repository PRs; forked PRs do not receive repository secrets and need explicit maintainer staging if a preview is required.
- Deploy scripts use explicit `--site` selection and do not rely on `.netlify/state.json`.
- The default non-production staging target can be changed per worktree by creating the gitignored `.netlify-deploy.local.json` with `{ "defaultStagingTarget": "woven-moth" }` or another supported staging target key.
- If the current branch is `main`, deploy to Netlify after each commit that changes executable app code, runtime behavior, or user-visible site output.
- For ordinary PR work targeting `main`, rely on the automated PR preview instead of running manual staging deploys.
- On non-`main` branches not covered by a PR preview, deploy to the configured staging site after each meaningful code change unless there is a clear reason not to.
- Before handing back non-`main` work that changed executable app code, runtime behavior, or user-visible site output, either confirm the automated PR preview covers the branch or deploy to the configured staging site.
- Planning-only, docs-only, and repository-instruction-only edits do not require Netlify deploys.
- Do not deploy non-`main` branches to the `main` production site.
- Use `npm run deploy:netlify` for branch-aware deploys.
- Use `npm run deploy:netlify:production` or `npm run deploy:netlify:staging` only when an explicit override is needed.
- Use `npm run deploy:netlify:staging:woven-moth` to explicitly deploy to the woven moth staging site.
- After any staging deploy, share the staging URL with the user.

## Verification

- Run relevant tests, build checks, and validation commands when the change affects executable code, behavior, configuration, or shipped assets.
- For HUD, menu, overlay, touch-control, or responsive UI changes, run `npm run test:gui` when relevant and visually inspect the generated screenshot artifact before accepting the change. Report the artifact path and whether it matched the expected UI state. This supplements, not replaces, browser/playtest checks for richer gameplay states.
- Planning-only, docs-only, and repository-instruction-only edits do not require test runs, build runs, or deploys unless the user explicitly asks for them.
- When verification is skipped because the change is non-executable, say so briefly in the response.

## Durable Work Notes

- Shipit state is transient local worktree scratch for the current task, not durable repository documentation or past-work memory.
- Convert durable parts of Shipit state into `docs/tech-notes/` when future "what changed, how, and why" context matters.
- Substantial executable, runtime, rendering, asset, or user-visible feature or fix work requires a dated tech note unless the human explicitly approves skipping it.
- Tech notes should include what changed, why it changed, key files and ownership boundaries, important decisions, validation performed, and follow-ups or known gaps.
- Skipping a tech note for substantial work requires human approval; record the approval and reason in transient Shipit state while active, and mention it in the final response.
- Planning-only, docs-only, repository-instruction-only, and tiny mechanical changes can skip tech notes with a brief final note.

## GitHub Issue Intake

- Every time an agent picks up work from GitHub, use the Shipit workflow from the start and apply the Ponytail lens throughout the work.
- When starting implementation for a GitHub issue, mark the issue in progress before changing product code using the repo's current tracking mechanism, then record the issue URL/comment in Shipit state.
- Before proceeding with a ticket, read the issue body and all comments, then make sure the scope is clear.
- Record relevant issue comments, decisions, non-goals, and any scope uncertainty in transient Shipit state before implementation; move durable context into `docs/tech-notes/` when it should remain useful after the worktree scratch state is gone.
- If issue comments conflict or leave the requested behavior unclear, pause and clarify before changing product code.

## Pull Requests

- PR descriptions should keep a high-level description of what changed.
- Link the related issue when one exists; otherwise include concise context for why the change was made.
- Include important implementation details, ownership boundaries, and behavior changes when they matter for review.
- Avoid validation steps, test-command output, and validation-result sections unless explicitly requested.
- Avoid deployed-instance links in PR descriptions because GitHub workflows provide those separately.

## Automation Task Claims

- Automation orchestrators and workers must use task-scoped claims for GitHub PRs/issues/branches instead of a single repository-wide automation lock.
- Use `npm run claim:task -- acquire --kind pr|issue --id <id> --token-file <path>` before delegating or starting automation-owned work on a PR/issue. Include `--branch` when the task is tied to a branch, and keep the generated token file in the worker context.
- Claim records live in the per-user shared directory `$CODEX_HOME/automation-locks/space-web-game/tasks/` by default, so separate worktrees coordinate with each other.
- If acquiring, heartbeating, or verifying a claim fails, stop or skip the task. Do not edit, test, commit, push, deploy, or reply on GitHub for automation-owned work unless the matching claim token verifies first. When `--branch` is supplied, the helper also blocks concurrent claims for that same branch.
- Workers called by automation must run `npm run claim:task -- verify --kind pr|issue --id <id> --branch <branch> --token-file <token-file>` for branch-bound work before source/docs edits, verification commands, commits, pushes, deploys, and GitHub comments. For unbound tasks, omit only the `--branch <branch>` pair. Use the same token-file flow for `heartbeat` during long-running work and `release` when the active automation handoff is finished or intentionally abandoned.
- Only replace a stale claim through the helper's normal `acquire` path. The helper fails closed for live claims, unreadable claims, and uncertain liveness.

## Shipit Reviews

- Run CodeRabbit as part of Shipit review with `coderabbit --base main --agent`.
- Apply the Ponytail review lens during Shipit review: look for code to delete, simplify, or replace with native/standard-library behavior, and call out YAGNI/speculative abstractions before approving the branch.
- If CodeRabbit fails, times out, or cannot produce findings for any reason, explicitly alert the user so they can debug it or run it themselves.
- Treat automated review findings, including CodeRabbit findings, as hypotheses rather than facts. Inspect the current code and diff before deciding whether each finding is valid, stale, out of scope, or based on an incorrect proposed fix.

## Main Branch Merges

- When an agent merges a local branch into `main`, always use squash and merge so `main` gets one commit for the completed branch.
- After completing a local branch merge into `main`, including any required verification or deploy steps, push the local `main` branch to `origin/main` before handing work back to the user unless the user explicitly says not to.

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

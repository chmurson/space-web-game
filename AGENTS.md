# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

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

## Code Quality

- Do not widen module APIs only to make tests easier to write.
- Prefer testing behavior through existing public functions instead of exporting internal helpers just for tests.

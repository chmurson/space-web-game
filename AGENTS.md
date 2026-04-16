# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

## Deployment

- This repository has two Netlify targets:
- Production site for `main`: `space-web-game-tiny-impr2`
- Production URL for `main`: `https://space-web-game-tiny-impr2.netlify.app`
- Production site ID for `main`: `0ed821be-c897-4f15-ad17-859ae866ca1d`
- Shared staging site for non-`main` branches: `fanciful-bunny-d77b4b`
- Shared staging site ID for non-`main` branches: `e0d8dda6-9340-4d3c-9e78-941ccbb63d5f`
- Deploy scripts use explicit `--site` selection and do not rely on `.netlify/state.json`.
- If the current branch is `main`, deploy to Netlify after each commit.
- If the current branch is not `main`, deploy to the shared staging site after each meaningful change unless there is a clear reason not to.
- On non-`main` branches, always deploy to the shared staging site before handing work back to the user.
- Do not deploy non-`main` branches to the `main` production site.
- Use `npm run deploy:netlify` for branch-aware deploys.
- Use `npm run deploy:netlify:production` or `npm run deploy:netlify:staging` only when an explicit override is needed.
- After any staging deploy, share the staging URL with the user.

## Code Quality

- Do not widen module APIs only to make tests easier to write.
- Prefer testing behavior through existing public functions instead of exporting internal helpers just for tests.

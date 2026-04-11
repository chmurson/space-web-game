# Repository Notes

## Communication

- After each substantial implementation or refactor step, include a short plain-language summary in the response.
- Keep that summary focused on what changed and why it matters, without assuming the reader followed all internal details.
- Keep the technical summary too; the plain-language summary is an addition, not a replacement.

## Deployment

- This repository is linked to Netlify site `space-web-game-tiny-impr2`.
- Production URL: `https://space-web-game-tiny-impr2.netlify.app`
- Netlify site ID: `0ed821be-c897-4f15-ad17-859ae866ca1d`
- Local Netlify link state is stored in `.netlify/state.json`.
- If the current branch is `main`, deploy to Netlify after each commit.
- If the current branch is not `main`, do not deploy to the production environment.
- On non-`main` branches, deploy only to a non-production Netlify preview when the user asks for a deploy or when a deploy is needed to share the result.
- After any non-production deploy, share the preview URL with the user.

## Code Quality

- Do not widen module APIs only to make tests easier to write.
- Prefer testing behavior through existing public functions instead of exporting internal helpers just for tests.

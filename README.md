# Space Web Game

Working title for a simple spacecraft simulator with real orbital physics.

## Development

```sh
npm install
npm run dev
```

To connect local dev to a deployed Netlify API, proxy `/api` to a staging or PR
alias origin:

```sh
SPACE_WEB_GAME_DEV_API_ORIGIN=https://fanciful-bunny-d77b4b.netlify.app npm run dev
```

## Build

```sh
npm run build
```

The build validates game configuration, runs TypeScript checks, and creates the
production output in `dist/`.

## Deployment

Deployments use Netlify and publish the existing `dist/` directory. Build before
deploying:

```sh
npm run build
npm run deploy:netlify
```

Deployment scripts:

- `npm run deploy:netlify` selects the target from the current branch. `main`
  deploys to production; any other branch deploys to shared staging.
- `npm run deploy:netlify:production` forces a production deploy.
- `npm run deploy:netlify:staging` forces a staging deploy.

Production deploy automation:

- `.github/workflows/netlify-production.yml` starts on every push to `main` and
  deploys the latest successful release build to Netlify production. Superseded
  in-flight runs are canceled so an older commit cannot overwrite a newer one.
- The GitHub Actions repository secret `NETLIFY_AUTH_TOKEN` must be configured
  for production deploys.
- `.github/workflows/netlify-pr-preview.yml` deploys same-repository PRs to
  stable `pr-<number>` aliases on the production Netlify site.
- Reach the Moon highscore submissions on PR aliases require
  `REACH_MOON_RUN_RECEIPT_SECRET` in a non-production branch-deploy context,
  using a fresh staging/non-production value.

Stable PR alias previews:

- `.github/workflows/netlify-pr-preview.yml` runs for same-repository PRs
  targeting `main`, builds the PR head, and deploys `dist/` to a stable Netlify
  alias like `https://pr-130--space-web-game.netlify.app`.
- These stable aliases are Netlify branch deploys with branch `pr-<number>`.
  They are not true Netlify Deploy Previews, even though the repo calls the
  workflow output a PR preview.
- Function secrets for the alias runtime must exist in the non-production
  branch deploy context, or in the branch-specific `pr-<number>` context. Set
  `REACH_MOON_RUN_RECEIPT_SECRET` there with a fresh non-production value; do
  not reuse the production secret. A value configured only for Netlify's
  `deploy-preview` context is not available to the stable alias runtime.
- After a PR alias redeploy, validate the receipt function before testing
  highscore submission:

  ```sh
  curl -sS -X POST \
    https://pr-<number>--space-web-game.netlify.app/api/reach-moon/run-receipt
  ```

  The response should be `201` JSON with a `runReceipt` object. A
  `missing_receipt_secret` error means the non-production branch deploy secret
  is not available to that alias.

Current Netlify targets:

- Production: `space-web-game`
  (`https://space-web-game.netlify.app`)
- Staging: `fanciful-bunny-d77b4b`
  (`https://fanciful-bunny-d77b4b.netlify.app`)

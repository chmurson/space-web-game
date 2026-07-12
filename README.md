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

- `npm run deploy:netlify` deploys to shared staging by default.
- `npm run deploy:netlify:production` forces a production deploy and is
  reserved for the manual production workflow.
- `npm run deploy:netlify:staging` forces a staging deploy.

Deployment automation:

- `.github/workflows/netlify-main-staging.yml` starts on every push to `main`
  and deploys that commit to the primary URL of the shared staging site.
- `.github/workflows/netlify-production.yml` is manual-only. Its optional
  `commit` input accepts a commit SHA or ref; when omitted, it deploys the
  current `main` HEAD. After a successful deploy it force-updates the UTC-dated
  `prod-YYYYMMDD` tag to the deployed commit.
- The GitHub Actions repository secret `NETLIFY_AUTH_TOKEN` must be configured
  for staging, preview, and production deploys.
- `.github/workflows/netlify-pr-preview.yml` deploys same-repository PRs to
  stable `pr-<number>` aliases on the shared staging Netlify site.
- Reach the Moon highscore submissions on PR aliases require
  `REACH_MOON_RUN_RECEIPT_SECRET` in a non-production branch-deploy context,
  using a fresh staging/non-production value.

Stable PR alias previews:

- `.github/workflows/netlify-pr-preview.yml` runs for same-repository PRs
  targeting `main`, builds the PR head, and deploys `dist/` to a stable Netlify
  alias like `https://pr-130--fanciful-bunny-d77b4b.netlify.app`.
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
    https://pr-<number>--fanciful-bunny-d77b4b.netlify.app/api/reach-moon/run-receipt
  ```

  The response should be `201` JSON with a `runReceipt` object. A
  `missing_receipt_secret` error means the non-production branch deploy secret
  is not available to that alias.

Current Netlify targets:

- Production: `space-web-game`
  (`https://space-web-game.netlify.app`)
- Staging: `fanciful-bunny-d77b4b`
  (`https://fanciful-bunny-d77b4b.netlify.app`)

# Space Web Game

Working title for a simple spacecraft simulator with real orbital physics.

## Development

```sh
npm install
npm run dev
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

Current Netlify targets:

- Production: `space-web-game`
  (`https://space-web-game.netlify.app`)
- Staging: `fanciful-bunny-d77b4b`
  (`https://fanciful-bunny-d77b4b.netlify.app`)

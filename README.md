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

Current Netlify targets:

- Production: `space-web-game-tiny-impr2`
  (`https://space-web-game-tiny-impr2.netlify.app`)
- Staging: `fanciful-bunny-d77b4b`
  (`https://fanciful-bunny-d77b4b.netlify.app`)

# Netlify release lanes

## What changed

Netlify deployment automation now has three explicit lanes:

- pushes to `main` deploy to the primary URL of the shared staging site;
- pull requests deploy stable `pr-<number>` aliases on that same staging site;
- production deploys run only through manual workflow dispatch.

The manual production workflow accepts an optional commit SHA or ref and falls
back to the current `main` HEAD. After Netlify reports a successful production
deploy, the workflow force-updates a UTC-dated `prod-YYYYMMDD` tag to the exact
deployed commit, allowing another release on the same day to replace the tag.

## Why

This separates continuous validation from deliberate releases. Main and PR
builds remain easy to inspect on staging, while a production update requires an
explicit operator action and records the selected revision with a daily tag.

## Ownership boundaries

- `.github/workflows/netlify-main-staging.yml` owns continuous main deployment.
- `.github/workflows/netlify-pr-preview.yml` owns stable PR aliases and comments.
- `.github/workflows/netlify-production.yml` owns manual production deployment
  and production tag updates.
- `scripts/deployNetlify.mjs` remains the shared site-selection and Netlify CLI
  wrapper used by main staging and production workflows. Its automatic mode now
  defaults to shared staging even on `main`; production requires the explicit
  production mode used by the manual workflow.

## Validation

Workflow syntax and the final diff were checked locally. Live Netlify behavior
will be exercised after these workflow files reach GitHub.

## Known gaps

The repository or organization must allow the production workflow's GitHub
token to force-update `prod-*` tags. Protected tag rules can intentionally block
that step even after Netlify deployment succeeds.

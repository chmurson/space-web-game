# Reach the Moon Highscores Validation

Date: 2026-07-01
Branch: `codex/issue-118-highscores-validation`
Issue: [#118](https://github.com/chmurson/space-web-game/issues/118)
Parent: [#20](https://github.com/chmurson/space-web-game/issues/20)

## What Changed

- Ran the integrated validation pass for the shared Reach the Moon highscore chain.
- Confirmed the existing implementation still matches the focused child-issue design for contracts, receipts, Netlify storage/API, runtime submission plumbing, and leaderboard UI.
- Removed a stale `--context deploy-preview` flag from the PR preview workflow so stable `pr-<number>` aliases run with branch-deploy runtime context as documented.
- Aligned README PR-preview secret guidance with the branch-deploy alias model.
- Added this durable validation note for the final pre-v1 highscore slice.
- Found a staging operations blocker: the shared staging Netlify site can deploy the functions, but `REACH_MOON_RUN_RECEIPT_SECRET` is not configured for the staging site's production/functions context and this worker's Netlify identity cannot create it.

No product source changes were needed.

## Storage Design

- Netlify Functions own the public API:
  - `POST /api/reach-moon/run-receipt` issues signed run receipts.
  - `GET /api/reach-moon/highscores` reads leaderboard rollups.
  - `POST /api/reach-moon/highscores` accepts highscore submissions.
- Netlify Blob store name: `reach-moon-highscores`.
- Immutable records are stored under `records/by-run/<receipt-run-id>.json`.
- Cached rollups are stored under:
  - `rollups/daily/YYYY-MM-DD.json`
  - `rollups/weekly/YYYY-Www.json`
  - `rollups/all-time.json`
- Normal reads use cached top-10 rollups. Cache misses rebuild the requested rollups from a bounded paginated record scan and write the repaired rollup best-effort.
- Submissions write the immutable run record with `onlyIfNew`, then update daily, weekly, and all-time rollups with ETag compare-and-set retries. Replaying the same receipt reads the original record instead of creating another score.

## Trust Model

- The browser requests a server-issued Reach the Moon run receipt when the mission starts.
- Receipts are HMAC-signed with `REACH_MOON_RUN_RECEIPT_SECRET`, scoped to scenario id `reach-moon`, and expire after 24 hours.
- Highscore submission requires a valid receipt; the receipt `runId` becomes the immutable record id and idempotency key.
- The server recomputes `score.totalScore` from submitted fuel ratio and mission elapsed seconds. Client-provided score totals are ignored.
- Player names are normalized server-side with the shared 2-32 character rules and generated fallback callsigns for missing/blank names.
- Netlify rate limits are configured on both receipt and highscore functions.
- Known trust gap: v1 receipts prove a server-issued run started, but they do not bind final fuel/time values to a server-authoritative simulation result. Issue #119 owns post-v1 abuse hardening unless abuse appears before launch.

## Validation

- `npm ci` passed in the task worktree. npm reported existing audit findings: 1 low, 8 moderate, and 2 high vulnerabilities.
- Initial focused Vitest run failed before tests because the fresh worktree had no dependencies installed. After `npm ci`, the same focused command passed: 7 files, 47 tests.
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/server/reachMoonRunReceipts.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts tests/netlify/reachMoonRunReceiptFunction.test.ts tests/runtime/highLevelActions/reachMoonRunReceiptRequest.test.ts tests/runtime/highLevelActions/registerHighLevelActions.test.ts tests/scenario/specific-scenarios/reachMoonScenario.test.ts` passed: 7 files, 47 tests.
- `npx playwright test --config playwright.config.ts tests/gui/mobileHudScreenshot.spec.ts -g "highscores|highscore requests|submit rollups"` passed: 4 tests.
- `npm test` passed: 57 Vitest files, 394 Vitest tests, plus 16 automation-claim tests.
- `npm run build` passed with the existing Vite large-chunk warning for `dist/assets/index-CC6N--Rf.js`.
- `npm run test:gui` passed: 30 Playwright tests.
- GUI screenshot inspected: `tmp/playwright-results/mobileHudScreenshot-captur-58df7-Moon-highscores-leaderboard-mobile-chromium/mobile-reach-moon-highscores.png`. The highscore panel fit the mobile viewport, filters and rows were readable, the long pilot name ellipsized, and no controls overlapped.
- `npm run deploy:netlify` deployed the branch to the shared staging site:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a44fd218203f15263ec083c--fanciful-bunny-d77b4b.netlify.app
  - Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a44fd218203f15263ec083c
- Deployed `GET /api/reach-moon/highscores?period=daily` passed against the unique deploy: status `200`, daily rollup present, entries array present.
- Deployed `POST /api/reach-moon/run-receipt` failed against the unique deploy: status `500`, no `runReceipt` object. The failure blocks deployed highscore submission because submissions require a valid receipt.
- PR preview workflow for [#148](https://github.com/chmurson/space-web-game/pull/148) passed and published https://pr-148--space-web-game.netlify.app.
- PR alias `POST /api/reach-moon/run-receipt` failed against https://pr-148--space-web-game.netlify.app: status `500`, error code `missing_receipt_secret`.

## Deployment Blocker

The shared staging site has no `REACH_MOON_RUN_RECEIPT_SECRET` in the production/functions context used by the current branch-aware staging deploy.

Confirmed:

- `npx netlify api getEnvVars --data '{"account_id":"5b91528bc965921d8fdea1ee","site_id":"e0d8dda6-9340-4d3c-9e78-941ccbb63d5f","context_name":"production","scope":"functions"}'` returned `[]`.
- Attempting to create a staging-only secret through Netlify's environment-variable API returned `Forbidden` for this worker's Netlify identity.

Required owner action:

- Add a fresh non-production `REACH_MOON_RUN_RECEIPT_SECRET` for the shared staging site `fanciful-bunny-d77b4b` in the production/functions context, then redeploy and rerun:

```sh
curl -sS -X POST \
  https://fanciful-bunny-d77b4b.netlify.app/api/reach-moon/run-receipt
```

Expected result: status `201` JSON with a `runReceipt` object.

## Known Gaps

- Shared staging highscore submissions cannot be smoke-tested until the staging receipt secret is configured.
- Same-repository PR aliases also need a fresh non-production `REACH_MOON_RUN_RECEIPT_SECRET` in the production site's branch-deploy context or branch-specific `pr-<number>` context before receipt and submit smoke tests can pass there. PR #148 confirmed the secret is currently unavailable to `https://pr-148--space-web-game.netlify.app`.
- Issue #119 remains the explicit post-v1 abuse-resistance follow-up.

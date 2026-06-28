# Reach the Moon Highscore API

Issue: https://github.com/chmurson/space-web-game/issues/115
Branch: `codex/issue-115-highscore-api`
Shipit state: `.codex/shipit-workflows/codex-issue-115-highscore-api.md`

## What Changed

- Added the `reach-moon-highscores` Netlify Function for `GET` leaderboard reads and `POST` highscore submissions.
- Added Netlify Blob storage for immutable run-record blobs plus cached top-10 rollup blobs for daily, weekly, and all-time periods.
- Wired submissions through the shared Reach the Moon highscore contract and signed run-receipt validator from issues #113 and #114.
- Added typed JSON error responses, method/body/period/input/receipt/storage validation, cache headers, and a code-based Netlify rate-limit config.
- Added focused mocked-storage tests for empty reads, period validation, cached rollup reads, bounded cache repair, rollup keys, top-10 ordering, score recomputation, and validation failures.

## Why

Issue #115 is the backend API slice for Reach the Moon highscores. It provides the storage and trust boundary that later runtime submission and leaderboard UI issues can call without moving score authority into the browser.

## Key Files

- `netlify/functions/reach-moon-highscores.ts` owns the API boundary, Blob keys, JSON responses, cache headers, rate-limit config, immutable run-record writes, cached rollup reads, and bounded rollup cache repair.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` remains the shared scoring and ranking contract. The function reuses it instead of duplicating scoring rules.
- `src/server/reachMoonRunReceipts.ts` remains the receipt signing and validation boundary. The function requires `REACH_MOON_RUN_RECEIPT_SECRET` before accepting submissions.
- `tests/netlify/reachMoonHighscoresFunction.test.ts` covers the function with mocked Blob storage.

## Storage Layout

- Store name: `reach-moon-highscores`.
- Immutable records: `records/by-run/<receipt-run-id>.json`, written with `onlyIfNew`.
- Daily rollup cache: `rollups/daily/YYYY-MM-DD.json`.
- Weekly rollup cache: `rollups/weekly/YYYY-Www.json`, using UTC ISO week keys.
- All-time rollup cache: `rollups/all-time.json`.

## Decisions

- `GET /api/reach-moon/highscores` returns cached rollups by default; `?period=daily|weekly|all-time` narrows the read and validates unsupported periods. Missing rollup blobs are repaired from a bounded paginated record read and written back best-effort.
- `POST /api/reach-moon/highscores` validates the same period query if present but always returns all updated rollups because a submission affects daily, weekly, and all-time state. Existing rollup blobs are updated with Netlify Blob ETag compare-and-set retries so normal submissions do not scan every immutable record.
- Stored scores are recomputed server-side with `createReachMoonHighscoreRecord`; client-provided score fields are ignored.
- The signed receipt `runId` is the immutable record id and idempotency key. Replaying the same receipt reads the original record instead of creating a second score.
- Rollups store only the current top 10 for each period. Immutable records remain the recovery source, but normal GET/POST paths read and update rollup blobs instead of rebuilding from all records.
- Rate limiting uses the Netlify Function `config.rateLimit` API with IP/domain aggregation. No separate `netlify.toml` was added.

## Known Gaps

- Rollup cache-miss repair reads only the first paginated Blob result, capped at 1,000 immutable records. If submission volume grows, add a compact per-day/per-week record index or a queued full-cache rebuild path.
- Signed receipts are still stateless run-start receipts, so this API validates authenticity and expiry but does not bind the final submitted run values to a server-derived result. A future integration issue can add server-authoritative run-result signing if needed.
- Rollup cache writes are best-effort after a record is accepted; a transient existing-cache write failure can leave a period stale until a later backfill or repair path refreshes it.

## Validation

- `npx vitest run --config vite.config.ts tests/netlify/reachMoonHighscoresFunction.test.ts tests/server/reachMoonRunReceipts.test.ts` passed after the cache-path fix: 2 files, 16 tests.
- `npm test` passed after the cache-path fix: 52 Vitest files, 347 Vitest tests, and 16 automation-claim tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `git diff --check` passed.
- CodeRabbit was run with `coderabbit --base main --agent` after the follow-up fix and completed with 0 findings.
- `npm run deploy:netlify` deployed the non-main branch to the shared staging site:
  - Shared staging URL: https://fanciful-bunny-d77b4b.netlify.app
  - Unique deploy URL: https://6a4190c396403e07e0d7e8a4--fanciful-bunny-d77b4b.netlify.app
  - Build logs: https://app.netlify.com/projects/fanciful-bunny-d77b4b/deploys/6a4190c396403e07e0d7e8a4

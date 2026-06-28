# Reach the Moon Run Receipts

Issue: https://github.com/chmurson/space-web-game/issues/114
Branch: `codex/issue-114-signed-run-receipts`
Shipit state: `.codex/shipit-workflows/codex/issue-114-signed-run-receipts.md`

## What Changed

- Added a server-boundary helper for issuing signed Reach the Moon run receipts.
- Added validation for receipt presence, expiry, scenario scope, and HMAC signature.
- Added focused tests for the happy path and the requested failure cases.

## Why

The highscore sequence needs a small receipt from the server when a Reach the Moon run starts, so later public score submissions are gated by something the server issued. This is not intended to be cheat-proof, but it raises the cost of direct junk submissions before accounts or server-authoritative simulation exist.

## Key Files

- `src/server/reachMoonRunReceipts.ts` owns receipt creation, HMAC signing, and receipt validation.
- `tests/server/reachMoonRunReceipts.test.ts` covers creation and validation behavior.
- `src/scenario/specific-scenarios/reachMoonHighscores.ts` remains the shared score contract from issue #113; this change does not move trust checks into renderer, UI, or scenario runtime code.

## Decisions

- Kept receipts stateless for v1 because no highscore storage/API layer exists until issue #115.
- Used Web Crypto HMAC SHA-256 instead of Node-specific crypto so the helper stays dependency-free under the existing TypeScript config.
- Require a nonblank HMAC secret of at least 32 bytes before signing or verifying receipts.
- Used a 24-hour wall-clock TTL by default to avoid evergreen receipts while leaving room for a human run.
- Kept the helper Reach-the-Moon-specific instead of adding a generic receipt framework.
- Did not wire runtime/UI start or submit flows; those remain owned by later highscore child issues.

## Validation

- `npm ci` completed in the task worktree after the first focused test run found missing dependencies. It reported existing audit findings: 1 low, 2 moderate, and 2 high vulnerabilities.
- `npx vitest run --config vite.config.ts tests/server/reachMoonRunReceipts.test.ts` passed: 1 file, 6 tests.
- `npx biome check src/server/reachMoonRunReceipts.ts tests/server/reachMoonRunReceipts.test.ts` passed.
- `coderabbit --base main --agent` completed with 2 findings; both were fixed.
- `git diff --check` passed.
- `npm test` passed: 50 Vitest files, 336 Vitest tests, and 16 automation-claim tests.
- `npm run build` passed with the existing Vite large-chunk warning.
- `npm run deploy:netlify` completed a non-main deploy to the shared staging site.

## Follow-Ups

- #115 owns Netlify Function routes, Blob storage, and the environment secret that will call these helpers.
- #116 owns threading completed runtime runs into highscore submission flow.

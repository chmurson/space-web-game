# Reach the Moon Highscore Abuse Hardening

Date: 2026-07-02
Branch: `codex/issue-119-leaderboard-abuse-hardening`
Issue: [#119](https://github.com/chmurson/space-web-game/issues/119)
Parent: [#20](https://github.com/chmurson/space-web-game/issues/20)

## What Changed

- Added conservative server-side rejects to `POST /api/reach-moon/highscores`
  before any public highscore record is written.
- Added a receipt timing check that rejects submissions sent less than 15
  seconds after the signed run receipt was issued.
- Added storage-only audit flags for suspicious-but-accepted records.
- Kept public highscore responses and rollup cache entries on the existing
  public `ReachMoonHighscoreRecord` shape by stripping storage-only audit
  metadata before responding or ranking.
- Added `docs/backoffice/AGENTS.md` with Netlify CLI review guidance for
  suspicious highscore records and linked it from root `AGENTS.md`.

## Why

The v1 highscore flow already signs run receipts, recomputes scores server-side,
uses receipt `runId` as the immutable record key, and keeps daily/weekly/all-time
rollups. Issue #119 adds the first proportional hardening layer for obvious
direct API or DevTools submissions without moving simulation authority
server-side, adding accounts, or changing the Blob storage model.

## Key Files

- `netlify/functions/reach-moon-highscores/post.ts` owns receipt timing,
  plausibility rejects, and suspicious flag creation.
- `netlify/functions/reach-moon-highscores/storage.ts` owns stored-record reads,
  public-record stripping, and rollup cache updates/repair.
- `netlify/functions/reach-moon-highscores/types.ts` owns local storage-only
  audit metadata types.
- `tests/netlify/reachMoonHighscoresFunction.test.ts` covers the Netlify
  function boundary with mocked Blob storage.
- `docs/backoffice/AGENTS.md` owns operational review instructions for
  suspicious records.

## Thresholds

Hard rejects:

- Receipt age below `15_000 ms`: rejects instant scripted submissions while
  preserving the existing receipt signature and 24-hour TTL validation.
- Mission elapsed below `300 s`: rejects near-zero mission times.
- Fuel remaining ratio above `0.999`: rejects effectively full-fuel mission
  completions.
- Recomputed total score outside `[0, 250]`: rejects values outside the current
  bounded additive score domain.

Storage-only suspicious flags:

- `unusually_short_mission`: mission elapsed below one simulated day.
- `unusually_high_fuel_remaining`: fuel remaining ratio at or above `0.95`.
- `near_max_score`: recomputed total score at or above `245`.

## Decisions

- Kept the shared public highscore type unchanged. Audit metadata is a local
  Netlify Function storage type and is stripped from public submit responses,
  cached rollups, and repaired rollups.
- Reused the existing immutable record write path. Replays still use the
  receipt `runId` as the idempotency key and do not create duplicate records.
- Did not add spent-receipt tracking, moderation UI, hidden public visibility,
  user accounts, or a server-authoritative simulation.
- Kept thresholds conservative and simple. This slice catches clear abuse and
  stores review signals; it does not try to prove a run physically happened.

## Tradeoffs

- False positives are possible for accepted suspicious flags because top-end
  runs are intentionally retained for human review. The flags do not hide or
  downrank records.
- False negatives remain possible for forged records that stay inside the
  envelope. Stronger proof would require server-authoritative run results or a
  richer telemetry receipt chain.
- Cached public rollups intentionally omit audit metadata, so backoffice review
  must fetch immutable `records/by-run/*.json` blobs rather than relying on the
  public leaderboard API.

## Validation

- Initial focused Vitest run failed before tests because the fresh worktree had
  no dependencies installed. `npm ci` passed and reported existing audit
  findings: 1 low, 8 moderate, and 2 high vulnerabilities.
- `npx vitest run --config vite.config.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
  passed after implementation and after formatting: 1 file, 15 tests.
- `npx vitest run --config vite.config.ts tests/scenario/specific-scenarios/reachMoonHighscores.test.ts tests/scenario/specific-scenarios/reachMoonScore.test.ts tests/server/reachMoonRunReceipts.test.ts tests/netlify/reachMoonRunReceiptFunction.test.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
  passed: 5 files, 64 tests.
- `npm test` passed: 57 Vitest files, 423 Vitest tests, and 16 automation-claim
  tests.
- `npm run build` passed, with the existing Vite warning that the main JS chunk
  is larger than 500 kB after minification.
- `npx biome check --write AGENTS.md docs/backoffice/AGENTS.md docs/tech-notes/2026-07-02-reach-moon-highscore-abuse-hardening.md netlify/functions/reach-moon-highscores/post.ts netlify/functions/reach-moon-highscores/storage.ts netlify/functions/reach-moon-highscores/types.ts tests/netlify/reachMoonHighscoresFunction.test.ts`
  fixed 3 code files. The follow-up no-write Biome check on the changed code
  files passed with no fixes applied.
- `git diff --check` passed.
- `coderabbit --base main --agent` completed with 0 findings.

## Follow-Ups

- If suspicious records become common, add a human-approved moderation/backfill
  path for hiding or removing records and rebuilding affected rollups.
- If abuse stays inside this envelope, consider a future server-authoritative
  result-signing slice instead of adding many heuristic flags.

# Automation Task Claims

The space-web-game automation monitor may run more than one orchestrator at a time, but two workers must not own the same GitHub PR, issue, or task branch. Use the repository helper instead of the old repository-wide `free-to-take-orchestrator.lock`.

## Claim Storage

Claims are stored outside worktrees so all local clones coordinate through the same per-user path:

```sh
$CODEX_HOME/automation-locks/space-web-game/tasks/
```

If `CODEX_HOME` is unset, the helper falls back to `~/.codex`. Tests or one-off dry runs can override the directory with `SPACE_WEB_GAME_TASK_CLAIM_ROOT`.

Each task is stored as `<kind>-<id>.json`, for example `pr-71.json` or `issue-59.json`. The helper uses a short-lived global write mutex only while reading or writing claim files, including branch-conflict checks.

## Command Flow

Acquire before an orchestrator delegates or a worker starts automation-owned work:

```sh
npm run claim:task -- acquire \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --owner "$CODEX_THREAD_ID" \
  --purpose "PR #71 review follow-up" \
  --ttl 14400 \
  --token-file /tmp/space-game-pr-71.claim-token
```

The command writes the generated token to `--token-file` when provided and redacts the raw token from stdout by default. Keep that token in the worker context only; committed files should contain only the token hash stored in the claim record. Use `--print-token` only for an explicit manual handoff that cannot use a token file.

Verify before edits, tests, commits, pushes, deploys, or GitHub replies:

```sh
npm run claim:task -- verify \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file /tmp/space-game-pr-71.claim-token
```

Heartbeat during long work:

```sh
npm run claim:task -- heartbeat \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file /tmp/space-game-pr-71.claim-token
```

Release when the active automation handoff is done or intentionally abandoned:

```sh
npm run claim:task -- release \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file /tmp/space-game-pr-71.claim-token
```

## Failure Policy

The helper fails closed:

- A live matching task claim blocks `acquire`.
- A live claim for the same branch blocks `acquire`, even when the PR/issue id differs.
- Unreadable, malformed, or uncertain claims block `acquire`.
- `verify`, `heartbeat`, and `release` require the matching token.
- Branch verification fails when a branch is supplied and the stored branch differs.
- A stale active claim is replaceable only after TTL expiry and only when the recorded same-host PID is absent or not live. If PID liveness is uncertain, the task stays blocked.
- A stale write mutex is reclaimable only when its recorded same-host PID is clearly dead.

## Reconciliation rule

The claim file is the single source of truth for ownership. For reconciliation,
an unexpired `active` claim is treated as healthy when its `last_seen` is within
the 2-hour freshness window. During that window, assume the worker is in progress
even when a worker id, continuation record, sidecar, or memory event is missing or
stale. A parallel orchestrator must wait and must not release, replace, or
duplicate that claim. Those other files are audit and wakeup hints only.

After 2 hours without a heartbeat, or after the claim's own TTL has expired, the
orchestrator may question the handoff
and inspect worker/sidecar state. This does not authorize taking ownership: claim
replacement still requires the claim TTL to expire and the helper's PID-liveness
rules to permit it.

When the claim is expired, missing metadata still does not prove completion. Use
the helper's normal stale-claim replacement rules and PID-liveness checks; if they
do not permit replacement, report the task as uncertain and leave it untouched.

Workers invoked by automation should stop immediately when `verify` or `heartbeat` fails. Orchestrators should skip the task when `acquire` fails instead of spawning duplicate work.

## Claim Record Fields

Records include:

- `kind`, `id`, and optional `branch`
- `owner`, `thread_id`, `run_id`, `hostname`, and local `pid`
- `token_hash`
- `started_at`, `last_seen`, `ttl_seconds`, optional `released_at`
- `status`
- `purpose`

The raw token is never written to the claim record.

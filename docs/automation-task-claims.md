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
AUTOMATION_CONFIG_PATH="/absolute/path/to/resolved/automation.toml"
ACTIVE_AUTOMATION_ID="$(sed -n 's/^id = "\([^"]*\)"$/\1/p' "$AUTOMATION_CONFIG_PATH")"
: "${ACTIVE_AUTOMATION_ID:?resolved automation config has no id}"
AUTOMATION_CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
TOKEN_FILE="$AUTOMATION_CODEX_HOME/automations/$ACTIVE_AUTOMATION_ID/tokens/pr-71.claim-token"

npm run claim:task -- acquire \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --owner "$CODEX_THREAD_ID" \
  --purpose "automation_id=$ACTIVE_AUTOMATION_ID;token_file=$TOKEN_FILE;scope=explicit_request;reason=PR #71 review follow-up" \
  --ttl 14400 \
  --token-file "$TOKEN_FILE"
```

The command writes the generated token to `--token-file` when provided and redacts the raw token from stdout by default. Keep that token in the worker context only; committed files should contain only the token hash stored in the claim record. Use `--print-token` only for an explicit manual handoff that cannot use a token file.

When `--purpose` is supplied, the helper validates its workflow registration
before writing a token or claim. The value must begin with the exact
`automation_id=<active automation id>;token_file=<absolute path>` prefix, the
registered token path must match `--token-file`, and that path must be inside
the matching automation's canonical `tokens/` directory. Claims without this
validated registration may still support legacy or explicit manual workflows,
but recovery must not treat them as same-automation ownership evidence.

Verify before edits, tests, commits, pushes, deploys, or GitHub replies:

```sh
npm run claim:task -- verify \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file "$TOKEN_FILE"
```

Heartbeat during long work:

```sh
npm run claim:task -- heartbeat \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file "$TOKEN_FILE"
```

Release when the active automation handoff is done or intentionally abandoned:

```sh
npm run claim:task -- release \
  --kind pr \
  --id 71 \
  --branch issue-59-trail-render-frame-debug-state \
  --token-file "$TOKEN_FILE"
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
even when a worker id, sidecar, or memory event is missing or stale. A parallel
orchestrator must not release, replace, or duplicate that claim.

Every automation claim registers the exact active automation id and token-file
path in its `purpose` metadata when acquired. Treat that registration as
same-automation ownership evidence only when its exact prefix is valid, its
automation id matches the resolved active automation, its canonical token path
matches the registration and live claim workflow, and the token verifies.
Determine same-automation ownership from that validated registration, not from
whether a durable handoff already exists. A
durable pending handoff created by the same active automation lets a later
invocation verify the recorded token and resume reconciliation of that exact
claim even when the claim owner, parent thread, or run id belongs to an earlier
invocation. This is not a new ownership acquisition and must not start another
worker. The record must match the claim's kind, id, and branch, and its recorded
token file must verify through the claim helper before it is used.

A registered same-automation claim whose token verifies but whose handoff is
missing is `same_automation_unregistered`, not foreign. Preserve the claim and
use exact sidecar, worker-status, branch/worktree, and GitHub evidence to
reconstruct the record only when the original worker identity and context are
proven, or to reconcile an evidenced terminal/abandoned pre-handoff attempt. If
that evidence is incomplete, wait for direct status or the normal expiry path;
never start a second worker. A claim registered to another automation, or one
with missing/malformed registration metadata and no matching handoff, remains
foreign and must be left untouched.

After terminal reconciliation releases a claim, an archive failure may leave
the same-automation pending handoff behind. That is `archive_recovery`, not a
live-claim mismatch: confirm there is no live claim or worker and that every
referenced sidecar/review record has the terminal outcome, then retry only the
idempotent archive. Handoff records, sidecars, memory events, and worker ids are
otherwise audit and wakeup hints only; none can override a recent active claim.

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
- `purpose`, whose workflow-owned prefix registers the active automation id and
  token-file path before a durable handoff exists

The raw token is never written to the claim record.

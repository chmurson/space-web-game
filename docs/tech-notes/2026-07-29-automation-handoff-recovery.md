# Automation handoff recovery

## What changed

The engineer workflow now persists each delegated worker in a durable pending
handoff record and lets a later invocation of the same automation recover that
record before starting fresh PR or issue triage.

`scripts/automationHandoff.mjs` provides the record protocol:

- `create` writes one private, token-free pending record per claimed task.
- `list` reads every pending record and fails closed on malformed state.
- `archive` preserves a completed audit record only for the worker thread that
  created the pending record.

Review hardening also makes command-position `-h`/`--help` consistent with the
existing help flag and returns archive timestamps and reconciliation metadata in
the archive command's public result.

The workflow prompt uses the helper to make handoff recovery mandatory and
changes the worker template to receive the active automation id rather than the
old hard-coded `space-game-automation` identity.

Claim acquisition now registers the exact active automation id and token-file
path in claim purpose metadata. That registration lets a later invocation
recognize a same-automation claim even if the original run crashed before it
could create the durable handoff. The workflow also uses the dynamically
resolved GitHub login for mention matching and issue assignment instead of
embedding one account name in the contract.

The task-claim helper now validates any supplied workflow registration before
acquisition. The registered automation id must match the canonical automation
token namespace, and the absolute registered token path must match the actual
`--token-file`. Invalid registration fails before either the token or claim is
written, while claims with no registration remain untrusted legacy/manual state
instead of recovery ownership evidence.

## Why it changed

The scheduler can finish a parent orchestration run while its delegated worker
continues. The previous policy relied on the scheduler resuming that exact
parent task, so the next hourly invocation could treat the work as foreign or
miss the result entirely. That left live claims, worker output, and automation
memory out of sync and delayed new actionable work.

A pending record gives every later invocation of the same configured automation
the exact, validated recovery context: task claim coordinates, token-file path,
worker and parent thread ids, worktree, sidecars, scope, and next action.

## Ownership and safety boundaries

- Task claims remain the sole concurrency authority. A handoff never replaces a
  claim or authorizes another worker.
- Only a later invocation with the same active automation id may use a matching
  handoff record. A different automation remains foreign.
- A same-automation claim without its pending record is explicitly retained as
  `same_automation_unregistered` when its registration metadata and token verify;
  absence of the handoff alone no longer makes the claim foreign.
- Supplied claim registration is accepted only when its structured prefix,
  active automation id, canonical token namespace, actual token-file option,
  and later token verification all agree. Free-form or mismatched purpose text
  cannot become same-automation recovery evidence.
- The record stores a token-file path, never a raw token, and uses restrictive
  filesystem permissions.
- Duplicate creation always reports `HANDOFF_ACTIVE`. Existing-record details
  are included when they can be read and validated, but malformed or
  concurrently moved records cannot replace the stable duplicate signal.
- Concurrent duplicate creation remains write-once: one create succeeds, one
  reports `HANDOFF_ACTIVE`, and the surviving pending record stays valid.
- Archive retries accept the same worker and outcome after an uncertain pending
  cleanup, but reject a different outcome as `HANDOFF_ARCHIVE_CONFLICT`.
- Stored-record validation names invalid sidecar and storage-identity fields
  directly so recovery failures do not look like malformed CLI input.
- The orchestrator owns handoff and memory writes; workers report their terminal
  result instead of modifying those records.
- Terminal reconciliation releases the claim before archiving the handoff. A
  failed archive remains pending as explicit `archive_recovery`; a later
  same-automation invocation can verify terminal sidecar/review state and retry
  only the idempotent archive without requiring the released claim.

## Key files

- `scripts/automationHandoff.mjs` owns durable record validation and filesystem
  operations outside Git worktrees.
- `scripts/automationHandoff.test.mjs` covers creation, token privacy,
  sequential and concurrent duplicate rejection, malformed and
  storage-identity-invalid state, archive audit output, matching-worker
  archival, conflict detection, and idempotent recovery after uncertain
  cleanup.
- `scripts/automationTaskClaim.mjs` validates workflow-owned purpose
  registration before acquisition; `scripts/automationTaskClaim.test.mjs`
  covers accepted canonical registration plus malformed, missing, and
  mismatched registration failures.
- `docs/automation-prompts/engineer-workflow.md` owns the orchestration policy
  and worker prompt contract.
- `docs/automation-task-claims.md` explains how same-automation recovery fits
  the existing claim-first reconciliation rule, including pre-handoff claim
  registration and post-release archive recovery.

## Validation

- `npm test` — 73 Vitest files / 775 tests, 18 task-claim tests, 13 handoff
  tests, and 7 workflow-prompt tests
- `npm run build`
- `npm run test:automation-handoffs` — 13 tests
- `npm run test:automation-workflow`
- `node --check scripts/automationHandoff.mjs`
- `node --check scripts/automationHandoff.test.mjs`
- `node --check scripts/engineerWorkflowPrompt.test.mjs`
- `npx biome check scripts/automationHandoff.mjs
  scripts/automationHandoff.test.mjs
  docs/tech-notes/2026-07-29-automation-handoff-recovery.md`
- `git diff --check`

## Follow-up / known gap

The helper persists and validates recovery state, but it cannot itself query a
Codex worker thread. The workflow continues to use the runtime's thread-status
interface for that step. A future runtime-level wakeup callback can accelerate
recovery, but correctness no longer depends on one being available.

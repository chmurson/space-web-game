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

The workflow prompt uses the helper to make handoff recovery mandatory and
changes the worker template to receive the active automation id rather than the
old hard-coded `space-game-automation` identity.

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
- The record stores a token-file path, never a raw token, and uses restrictive
  filesystem permissions.
- Duplicate creation always reports `HANDOFF_ACTIVE`. Existing-record details
  are included when they can be read and validated, but malformed or
  concurrently moved records cannot replace the stable duplicate signal.
- The orchestrator owns handoff and memory writes; workers report their terminal
  result instead of modifying those records.
- Terminal reconciliation releases the claim before archiving the handoff. A
  failed archive remains pending rather than being silently discarded.

## Key files

- `scripts/automationHandoff.mjs` owns durable record validation and filesystem
  operations outside Git worktrees.
- `scripts/automationHandoff.test.mjs` covers creation, privacy, duplicate
  rejection with best-effort details, malformed-state failure, and
  matching-worker archival.
- `docs/automation-prompts/engineer-workflow.md` owns the orchestration policy
  and worker prompt contract.
- `docs/automation-task-claims.md` explains how same-automation recovery fits
  the existing claim-first reconciliation rule.

## Validation

- `npm test` — 73 test files / 775 tests, plus task-claim, handoff, and
  workflow-prompt checks
- `npm run test:automation-handoffs`
- `npm run test:automation-workflow`
- `node --check scripts/automationHandoff.mjs`
- `node --check scripts/automationHandoff.test.mjs`
- `node --check scripts/engineerWorkflowPrompt.test.mjs`

## Follow-up / known gap

The helper persists and validates recovery state, but it cannot itself query a
Codex worker thread. The workflow continues to use the runtime's thread-status
interface for that step. A future runtime-level wakeup callback can accelerate
recovery, but correctness no longer depends on one being available.

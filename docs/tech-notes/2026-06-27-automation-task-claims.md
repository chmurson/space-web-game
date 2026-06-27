# Automation Task Claims

Date: 2026-06-27

## What Changed

- Added `scripts/automationTaskClaim.mjs`, a dependency-free Node CLI for `acquire`, `heartbeat`, `verify`, and `release` task claims.
- Added focused Node tests in `scripts/automationTaskClaim.test.mjs`.
- Added `npm run claim:task` and `npm run test:automation-claims`.
- Documented the automation claim workflow in `docs/automation-task-claims.md`, `AGENTS.md`, and `.codex/shipit.config.md`.

## Why

The previous automation monitor guidance used a single worktree-local orchestrator lock. That was too coarse for safe parallel orchestration and too local to prevent duplicate ownership of the same PR, issue, or branch from another worktree.

Task-scoped claims allow multiple orchestrators to run concurrently while blocking duplicate active work for the same GitHub task.

## Ownership Boundaries

- `scripts/automationTaskClaim.mjs` owns local claim file reads/writes, token verification, stale-claim replacement rules, and CLI output.
- `docs/automation-task-claims.md` owns human-readable operational usage.
- `AGENTS.md` and `.codex/shipit.config.md` own future agent guidance for automation-run workers.

The game runtime, rendering, UI, assets, and deployed site behavior are unchanged.

## Decisions

- Claims live by default in `$CODEX_HOME/automation-locks/space-web-game/tasks/` so all worktrees for the same user share ownership state.
- Each PR/issue uses its own claim file plus a short-lived global write mutex for atomic updates and branch-conflict scans.
- Branch conflicts are enforced when `--branch` is supplied, so different task ids cannot concurrently claim the same implementation branch.
- Claim records store only a SHA-256 token hash. CLI `acquire` writes generated tokens to `--token-file` and redacts raw tokens from stdout unless `--print-token` is explicitly requested.
- The helper fails closed for live claims, unreadable claims, unknown statuses, invalid TTL metadata, token mismatches, branch mismatches, and uncertain PID liveness.
- Expired active claims are replaceable only when the TTL is clearly expired and the recorded same-host PID is absent or not live.
- Stale write mutex directories are reclaimable only when their recorded same-host PID is clearly dead.

## Validation

- `npm run test:automation-claims`
- `npx biome check scripts/automationTaskClaim.mjs scripts/automationTaskClaim.test.mjs package.json AGENTS.md .codex/shipit.config.md docs/automation-task-claims.md`
- `coderabbit --base main --agent`

## Follow-Ups

- Keep external scheduler prompts passing the generated token to implementation workers and requiring `verify` before edits, tests, commits, pushes, deploys, or GitHub replies.

# Shipit Project Config

## State

- State directory: `.codex/shipit-workflows`
- Shipit workflow state is local-only, transient scratch for the current task/worktree, and must not be committed.
- Shipit workflow state is not durable repository documentation and should not be relied on as durable project history.
- At initial Shipit setup for a task, create/update state under `.codex/shipit-workflows/`, then verify it is ignored before product changes with `git check-ignore .codex/shipit-workflows/<state-file>`.
- If any Shipit workflow state or artifact is already tracked, stop and remove it from the index before including it in a task commit.

## Tech Notes Gate

- For substantial executable, runtime, rendering, asset, or user-visible changes, add or update a dated technical note before marking `Artifacts/docs updated`.
- Useful durable parts of Shipit state should be converted into `docs/tech-notes/` before final handoff.
- Put notes under `docs/tech-notes/`.
- Name notes as `YYYY-MM-DD-<short-task-slug>.md`.
- A tech note should record:
  - what changed
  - why it changed
  - key files and ownership boundaries
  - important implementation decisions
  - validation performed
  - follow-up issues or known gaps
- Skipping a tech note for substantial feature or fix work requires explicit human approval; record the approval and reason in transient Shipit state and mention the skip in the final handoff.
- Planning-only, docs-only, repository-instruction-only, and tiny mechanical changes may skip this gate with a brief final note.

## Main Branch Merge Gate

- When merging a local branch into `main`, always use squash and merge so the completed branch lands on `main` as one commit.

## Netlify PR Preview Gate

- PRs targeting `main` should rely on the automated Netlify PR preview workflow instead of agent-run manual staging deploys.
- The preview workflow requires repository secret `NETLIFY_AUTH_TOKEN`; it reuses the production Netlify site ID for non-production `pr-<number>` alias deploys and does not pass `--prod`.
- The preview workflow covers same-repository PRs; forked PRs need explicit maintainer staging if a preview is required because repository secrets are not available to them.
- For covered PRs, Shipit completion is not blocked on `npm run deploy:netlify`; record the workflow check state and preview URL when available.
- Keep manual staging deploys available for explicit human requests, PRs targeting branches other than `main`, branches without PR preview coverage, or cases where a separate shared staging URL is needed.
- If the preview workflow fails or required secrets are missing, record that as validation/deploy risk instead of masking it with an unrelated manual staging deploy unless the human explicitly asks for one.

## Shipit Review Gate

These rules copy the durable Shipit review requirements from `AGENTS.md` into the project Shipit harness. They supplement the built-in Shipit review mode.

- Treat supplied external or automated review findings as hypotheses, not facts.
- Inspect the current code and diff before deciding whether each supplied finding is valid, stale, out of scope, or based on an incorrect proposed fix.
- Process supplied findings before the final self-review.
- Fix only still-valid, in-scope findings; record skipped findings with concise reasons.
- Apply the Ponytail review lens during Shipit review:
  - look for code to delete or simplify
  - prefer native or standard-library behavior where it replaces unnecessary custom code
  - call out YAGNI, speculative abstractions, over-broad APIs, and needless dependency or asset-pipeline complexity
- Record the Ponytail review outcome even when it finds nothing to change.
- After supplied findings and the Ponytail pass, complete the normal reviewer self-review and solution retrospect.
- Do not mark `Review complete` until review notes include:
  - supplied findings fixed or skipped, if any
  - Ponytail lens outcome
  - self-review outcome
  - solution retrospect
  - residual risk
  - validation results or explicitly accepted validation gaps
- Handle new external and automated feedback on the PR after the local Shipit review gate is complete.

## Shipit Yeet Gate

When Shipit review is complete and the user asks to yeet the work, open or update the GitHub PR in ready-for-review state so human reviewers and automated checks can run on the PR.

- This repo-level rule intentionally overrides the generic Yeet skill's draft-PR default after review has passed.
- Do not create a draft PR after the Shipit review gate has passed unless the human explicitly asks for a draft.
- When creating a PR after review, omit `--draft` from `gh pr create`.
- If a PR already exists as a draft after review, run `gh pr ready` before handing work back.
- Record the ready-for-review PR URL in Shipit workflow state.

## GitHub Issue Status Gate

When starting implementation for a GitHub issue, update every issue that the task explicitly targets before changing product code.

- If the repo has no project status or `in progress` label, assign the issue to the authenticated user when appropriate and leave a concise start comment with:
  - the implementation branch
  - the Shipit state path
  - what is being done
  - what remains
- Record the issue URL/comment and current issue state in the Shipit workflow state.

Before marking Shipit work `completed`, update every GitHub issue that the task explicitly targets or materially changes.

- If the work is still in progress, leave a concise issue comment with:
  - what is being done
  - what remains
- If the issue is complete, close it with a concise comment that includes:
  - the merged PR or commit
  - any follow-up issues that now own deferred work
- Record the issue URL and final issue state in the Shipit workflow state before marking `Status: completed`.

## Automation Task Claim Gate

When Shipit work is started by the space-web-game automation monitor, the orchestrator or worker must hold a task-scoped claim before changing files or writing to GitHub.

- Acquire the claim with `npm run claim:task -- acquire --kind pr|issue --id <id> --token-file <path>` before delegating or beginning automation-owned work. Include `--branch <branch>` when the PR/issue is tied to a branch so the helper can block duplicate branch ownership too.
- Pass the generated token to the worker context. Do not store the raw token in committed files.
- Before source/docs edits, verification commands, commits, pushes, deploys, or GitHub comments, verify branch-bound work with `npm run claim:task -- verify --kind pr|issue --id <id> --branch <branch> --token-file <token-file>`. For unbound tasks, omit only the `--branch <branch>` pair. Use the same token-file flow for heartbeat and release.
- During long-running implementation or review handling, refresh `last_seen` with `heartbeat` before the TTL expires.
- Release the claim when the active automation handoff finishes or is intentionally abandoned.
- If acquire, verify, or heartbeat fails, stop or skip the task. The task may be retried only after the helper reports that a stale claim was safely replaced.

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

## Shipit Review Gate

These rules copy the durable Shipit review requirements from `AGENTS.md` into the project Shipit harness. They supplement the built-in Shipit review mode.

- Run CodeRabbit as part of Shipit review:

```sh
coderabbit --base main --agent
```

- If CodeRabbit fails, times out, or cannot produce findings, record that in the workflow review notes and explicitly alert the user.
- Treat CodeRabbit findings and all automated review findings as hypotheses, not facts.
- Inspect the current code and diff before deciding whether each automated finding is valid, stale, out of scope, or based on an incorrect proposed fix.
- Process supplied or automated findings before the final self-review.
- Fix only still-valid, in-scope findings; record skipped findings with concise reasons.
- Apply the Ponytail review lens during Shipit review:
  - look for code to delete or simplify
  - prefer native or standard-library behavior where it replaces unnecessary custom code
  - call out YAGNI, speculative abstractions, over-broad APIs, and needless dependency or asset-pipeline complexity
- Record the Ponytail review outcome even when it finds nothing to change.
- After automated findings and the Ponytail pass, complete the normal reviewer self-review and solution retrospect.
- Do not mark `Review complete` until review notes include:
  - CodeRabbit status
  - automated findings fixed or skipped, if any
  - Ponytail lens outcome
  - self-review outcome
  - solution retrospect
  - residual risk
  - validation results or explicitly accepted validation gaps

## GitHub Issue Status Gate

When starting implementation for a GitHub issue, update every issue that the task explicitly targets before changing product code.

- If the repo has no project status or `in progress` label, assign the issue to the authenticated user when appropriate and leave a concise start comment with:
  - the implementation branch
  - the Shipit state path
  - the first planned scope
  - what remains before the issue can close
- Record the issue URL/comment and current issue state in the Shipit workflow state.

Before marking Shipit work `completed`, update every GitHub issue that the task explicitly targets or materially changes.

- If the work is still in progress, leave a concise issue comment with:
  - what changed
  - what validation or deploy happened, if any
  - what remains before the issue can close
- If the issue is complete, close it with a concise comment that includes:
  - the merged PR or commit
  - the shipped behavior
  - the production or staging deploy URL when applicable
  - any follow-up issues that now own deferred work
- Record the issue URL and final issue state in the Shipit workflow state before marking `Status: completed`.

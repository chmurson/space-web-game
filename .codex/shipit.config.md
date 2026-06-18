# Shipit Project Config

## State

- State directory: `.codex/shipit-workflows`

## Tech Notes Gate

- For substantial executable, runtime, rendering, asset, or user-visible changes, add or update a dated technical note before marking `Artifacts/docs updated`.
- Put notes under `docs/tech-notes/`.
- Name notes as `YYYY-MM-DD-<short-task-slug>.md`.
- A tech note should record:
  - what changed
  - why it changed
  - key files and ownership boundaries
  - important implementation decisions
  - validation performed
  - follow-up issues or known gaps
- Planning-only, docs-only, and tiny mechanical changes may waive this gate, but record the waiver in the Shipit state.

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

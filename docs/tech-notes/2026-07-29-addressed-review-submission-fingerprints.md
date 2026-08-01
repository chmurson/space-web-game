# Addressed review-submission fingerprints

Shipit state:
`.codex/shipit-workflows/automation/issue-338-review-submission-fingerprints.md`

## What changed

The engineer workflow now persists independently verified review-submission
results in a repository-scoped
`review-submissions/<canonical-owner>/<canonical-repo>/` automation-state
namespace. Before delegating a formal-review finding, triage re-fetches the
exact review and compares its repository, PR, review id, body hash,
`submitted_at`, `commit_id`, and `state` with the stored addressed fingerprint.

An exact addressed match is suppressed without a claim, reaction, or worker. A
body or observed-version change makes the prior record stale and sends the
current submission through normal triage again.

## Why

Issue #338 exposed a gap in comment-oriented idempotency. Review submission
`4798808831` on PR #334 was fixed and independently verified, but GitHub has no
equivalent of the issue-comment or inline-review-comment reaction endpoint for
the workflow's completion marker. The next run therefore saw the unchanged
CodeRabbit summary as actionable and delegated it again.

## Ownership and boundaries

- `docs/automation-prompts/engineer-workflow.md` owns orchestration behavior,
  fingerprint fields, state lifetime, and reconciliation rules.
- `scripts/engineerWorkflowPrompt.test.mjs` protects the prompt contract,
  including the match-before-claim ordering and separation from inline review
  comments.
- Existing `sidecars/` comment records and their `eyes`/`rocket` lifecycle stay
  unchanged. Review submissions use `review-submissions/` and never acknowledge
  or suppress an inline review comment.
- Review submissions enter a separate classified inventory consumed by priority
  item 3; they do not enter either mandatory comment stream.
- Automation memory remains a historical audit log. It is not used as the
  addressed-state database.

## Decisions

- The observed review version uses fields returned by GitHub's exact review
  endpoint: `submitted_at`, `commit_id`, and `state`. The fetched body is hashed
  separately with SHA-256.
- The normalized GitHub `nameWithOwner` scopes record paths and the repository
  fingerprint field so shared automation state cannot collide across
  repositories.
- Missing body or version fields fail closed; placeholder fingerprints cannot
  suppress delegation.
- Addressed review-submission records survive claim release and routine cleanup
  while the pull request remains open.
- Claim release waits for every triggering comment sidecar and dedicated
  review-submission record to be durably reconciled.
- Terminal reconciliation still requires an independent per-item mapping. The
  lack of a reaction endpoint changes the persistence signal, not the evidence
  required to mark work addressed.

## Validation

- Focused engineer-workflow prompt tests.
- Node syntax check for the focused test file.
- Biome formatting/check for the changed test.
- Git diff whitespace and changed-file review.

## Follow-ups and known gaps

The orchestrator remains prompt-driven, so this change defines and tests the
state contract rather than adding a separate state-management runtime. Old
root-level review-submission sidecars with placeholder hashes do not qualify as
addressed fingerprints and will fail closed if encountered.

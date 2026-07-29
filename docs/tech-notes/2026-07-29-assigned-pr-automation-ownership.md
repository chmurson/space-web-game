# Assigned PR automation ownership

## What changed

The engineer workflow now resolves the authenticated automation identity before
PR triage and treats any open pull request assigned to that identity as
automation-owned. Assigned PRs receive the same complete comment, check, and
review-follow-up triage as PRs created by the automation.

The workflow now inventories both required comment sources for every open PR.
An otherwise unowned PR remains restricted by default, but a direct mention of
the automation identity with a concrete request creates narrow
`explicit_request` scope for that exact request.

## Why

The former automation-owned-only filter missed actionable human requests on
PRs #330 and #331 even though the automation account was explicitly mentioned.
Assignment is equally clear authority to own PR follow-up, so it must not be
treated as a weaker signal than branch provenance.

## Ownership and boundaries

- `docs/automation-prompts/engineer-workflow.md` owns scope classification,
  assignment handling, and the branch-bound claim requirement.
- `scripts/engineerWorkflowPrompt.test.mjs` protects the assignment,
  direct-request, and live-metadata contract.
- A fresh `assignees` match to the authenticated `gh` identity grants full
  PR-level ownership, including checks and review findings.
- An unassigned and otherwise unowned PR grants only the explicitly mentioned
  request; it does not authorize generic PR maintenance.
- A claim acquired for that narrow explicit request does not upgrade the whole
  PR to owned scope on a later scheduler run.
- Claim purpose and the corresponding sidecar/continuation persist the scope;
  explicit-request records also retain the exact triggering comment identity.
- Existing task claims, worktrees, reaction tracking, and worker verification
  remain mandatory before any GitHub write or source change.

## Decisions

- The identity comes from `gh api user --jq .login` rather than a hard-coded
  login so the policy follows the authenticated automation account.
- Assignment is evaluated from current PR metadata on every run. Old memory,
  released claims, labels, authorship, requested-review state, and branch-name
  guesses cannot independently create ownership.
- The workflow inventories both mandatory comment streams on every open PR so
  direct requests cannot disappear outside the previous ownership filter.
- A direct mention is required before an unowned/unassigned PR can become
  actionable; this preserves the boundary against unsolicited changes to
  unrelated draft work.

## Validation

- Focused engineer-workflow prompt tests.
- Node syntax check for the focused test file.
- Biome formatting/check for changed files.
- Git diff whitespace and changed-file review.

## Follow-ups and known gaps

This remains a prompt-driven contract. The scheduler must still provide the
worker-handoff continuation described by the workflow so terminal worker
results are reconciled before a claim expires.

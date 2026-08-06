# Engineer Workflow v2

Status: Proposed

Date: 2026-08-03

Scope: Scheduled GitHub PR follow-up and issue intake automation

Implementation: Not started

## Reading guide

For a first pass, read:

1. Executive summary
2. Goals and non-goals
3. Design principles
4. Proposed execution flow
5. Delivery plan
6. Open decisions and decision record

The snapshot, validator, worker-contract, fixture, and evaluation sections are
the detailed design behind those decisions. They can be reviewed separately
after the overall direction is clear.

## Executive summary

The current engineer workflow solves several real reliability problems, but it
has accumulated a large coordination protocol around task claims, comment
sidecars, reactions, review-submission fingerprints, automation memory, worker
continuations, and cross-run handoffs. The protocol is difficult to reason
about and has still allowed the automation to select a later, narrow request
while missing earlier work on the same pull request.

This proposal keeps the cost-aware model split:

- Luna with low reasoning performs frequent, read-heavy GitHub triage;
- Sol with extra-high reasoning performs expensive implementation work only
  when a pull request or issue actually requires it.

The central change is the unit of work. Luna will select a whole pull request,
not a triggering comment. Sol will receive that pull request as an outcome to
complete, independently refresh its full state, address every current gap, and
finish within the same scheduled run. GitHub remains the authoritative state.
Deterministic scripts will guarantee snapshot completeness, unchanged-state
short-circuiting, and structural validation of Luna's plan.

The rollout is intentionally incremental:

1. A spike validates scheduled-run concurrency and subagent lifecycle.
2. Implementation PR 1 adds workflow v2 beside the still-available legacy
   workflow, regression fixtures, snapshot tooling, plan validation, and a
   dry-run/live pilot path.
3. After a successful pilot, implementation PR 2 removes legacy claims,
   sidecars, prompts, and related rules that v2 no longer needs.

This document is a decision proposal. It does not authorize implementation,
automation configuration changes, cleanup, or deletion of legacy state.

## Why this change is being considered

### Original economic hypothesis

The orchestrator/worker split was introduced for a sound reason. Frequent runs
should be inexpensive when GitHub has not changed, while code changes and
multi-step debugging should use the strongest available coding and reasoning
model.

The intended operating model is:

```text
frequent GitHub triage        infrequent implementation
Luna + low reasoning    ->    Sol + extra-high reasoning
cheap and repeatable          expensive and capable
```

Workflow v2 preserves this hypothesis. It does not replace the hourly Luna run
with an hourly Sol/XHigh run.

### Current reliability and complexity problem

The current workflow is defined primarily by:

- [`docs/automation-prompts/engineer-workflow.md`](../../automation-prompts/engineer-workflow.md)
- [`docs/automation-task-claims.md`](../../automation-task-claims.md)
- [`scripts/engineerWorkflowPrompt.test.mjs`](../../../scripts/engineerWorkflowPrompt.test.mjs)
- the automation claim gate in [`AGENTS.md`](../../../AGENTS.md)
- the automation claim gate in [`.codex/shipit.config.md`](../../../.codex/shipit.config.md)

It has evolved to protect against concrete failures, including:

- missed issue-level PR conversation comments;
- assigned PRs not being recognized as automation-owned;
- narrow direct requests accidentally expanding to full PR ownership;
- the same CodeRabbit review submission being delegated repeatedly;
- edited comments being treated as addressed based on an older version;
- parallel runs duplicating a worker;
- scheduled runs losing track of a worker before terminal reconciliation;
- memory rewrites corrupting or losing prior run evidence.

Each protection is individually understandable. Together they produce a
distributed state machine whose state is spread across GitHub, claims, token
files, sidecars, review-submission records, memory events, worktrees, branches,
worker threads, and scheduler continuations.

The orchestrator must therefore spend substantial effort determining whether
work is active, stale, addressed, recoverable, or safe to clean up before it can
decide what product work should happen next.

### PR #331 as the motivating example

PR #331 contained an earlier owner comment with three requested product changes
and a later request to resolve merge conflicts. The automation selected the
later conflict request as the worker task and required several subsequent runs
to reconcile the worker, claim, sidecar, reaction, and continuation state. The
earlier product request was discovered only after human correction.

The failure was not primarily the absence of another tracking record. The task
boundary was wrong:

```text
current boundary:  address triggering comment 5107174867
desired boundary:  bring PR #331 to its next valid terminal state
```

Workflow v2 makes the pull request the unit of planning, delegation,
implementation, and verification.

## Goals

1. Bring every in-scope open PR toward owner-merge readiness before starting
   new issue work.
2. Address all current actionable owner and CodeRabbit feedback on the selected
   PR, including earlier comments and referenced requests.
3. Resolve merge conflicts and relevant failing checks as part of the same PR
   outcome, not as separate comment tasks.
4. Keep frequent no-op runs inexpensive by retaining Luna/Low triage and using
   a deterministic unchanged-snapshot short circuit.
5. Use Sol/XHigh only after a complete, validated plan proves that work exists.
6. Remove cross-run worker handoffs from the normal execution model.
7. Make GitHub the authoritative source for current PR state.
8. Preserve fail-closed behavior when GitHub inventory is incomplete.
9. Make the workflow and its tests understandable without reconstructing a
   distributed local state machine.
10. Leave merging to the repository owner.

## Non-goals

1. Automatically merge pull requests.
2. Deploy directly to production.
3. Modify unrelated third-party PRs without assignment, ownership, or an
   explicit request that grants appropriate scope.
4. Replace semantic interpretation of human feedback with a large handwritten
   natural-language parser.
5. Run multiple implementation workers in parallel during the first v2
   rollout.
6. Delete legacy claim, token, sidecar, memory, or worktree state in
   implementation PR 1.
7. Guarantee that a model always interprets ambiguous human language correctly.
   The design instead ensures that no comment can disappear without an explicit
   classification.
8. Turn the planning specification itself into executable behavior.

## Design principles

### 1. A PR is the unit of work

Comments, review findings, conflicts, and checks are evidence about a PR. They
are not independently owned tasks. One selected PR produces one work packet and
at most one worker in a scheduled run.

### 2. GitHub is authoritative; local state is an optimization

Current work is derived from a fresh GitHub snapshot. A local digest can prove
that a successfully fetched snapshot is unchanged, but it cannot declare a PR
addressed, active, or ready when GitHub says otherwise.

### 3. Deterministic code owns mechanical guarantees

Pagination, source completeness, canonicalization, digests, schema validation,
coverage of every comment id, and head-SHA guards should be implemented in
small deterministic scripts. Prompt prose should not be responsible for these
mechanical invariants.

### 4. Models own semantic judgment at the appropriate cost

Luna classifies feedback and selects work from a bounded normalized snapshot.
Sol determines and implements the correct code change. The validator does not
attempt to replace either model with speculative parsing logic.

### 5. The strong worker verifies the whole PR again

The Luna work packet is a minimum known scope, not an exhaustive task list.
Before editing, Sol refreshes the selected PR and may add work that Luna missed.
This deliberate redundancy is paid only on actionable runs.

### 6. A worker belongs to one parent run

The parent starts the worker, waits for it, reconciles the result, and then
finishes. A later scheduled run does not inherit an active worker handoff in the
normal v2 design.

### 7. Fail closed on missing evidence, not on ordinary waiting

Incomplete GitHub sources stop triage. A PR that is clean and merely waiting for
CodeRabbit or owner review does not stop issue intake and does not trigger
repeated review requests.

## Scope and authorization

Workflow v2 must inventory every open PR before issue intake so that direct
requests and missing conversation sources cannot disappear behind an ownership
filter.

The proposed mutation boundary retains the current safe default:

- an automation-created or automation-registered PR is in full PR scope;
- a PR currently assigned to the resolved automation identity is in full PR
  scope;
- an otherwise unowned PR with a current direct request to the automation
  identity grants only the scope of that request unless the PR is assigned;
- an unowned and unassigned PR without a direct request is inventoried but not
  modified.

"Bring all PRs to acceptance" therefore means all PRs for which the automation
has full follow-up authority, plus explicitly requested work on other PRs. If
the desired product policy is broader, it must be approved explicitly before
implementation PR 1 because it changes authorization, not merely triage.

## PR state model

Every in-scope open PR is classified into one of four states.

### `needs_work`

The agent can take a concrete action now. Examples:

- merge conflicts;
- actionable owner feedback;
- actionable CodeRabbit feedback;
- unresolved review threads;
- relevant failing checks or preview failures;
- implementation is complete but draft state prevents required review;
- the current head has not received the required review and no equivalent
  request is already pending.

### `waiting_for_review`

The branch is mergeable, relevant checks pass, no known actionable feedback
remains, and the only missing condition is an external review or check already
requested or running. The automation does not repeat the request each hour.

### `ready_for_merge`

All of the following are true for the current head:

- the PR is not a draft;
- the branch is mergeable;
- relevant required checks pass;
- CodeRabbit has actually reviewed the current head and has no unresolved
  actionable finding;
- no actionable owner request or unresolved review thread remains;
- the repository owner has approved the current state according to the agreed
  owner-acceptance rule.

The automation stops. The owner performs the merge.

### `blocked`

The automation cannot proceed safely because of missing permissions, ambiguous
product direction, an external dependency, unavailable required tooling, or an
unresolved concurrency condition. It records one concise, current explanation
when useful and does not repeat the same write every hour.

## Proposed execution flow

```text
acquire run eligibility
        |
        v
fetch and normalize every open PR
        |
        +-- incomplete source ----------> stop, fail closed
        |
        +-- successful unchanged digest -> cheap no-op report
        |
        v
Luna classifies every PR and every relevant record
        |
        v
deterministic validator checks coverage and policy invariants
        |
        +-- invalid plan ---------------> stop, report contract failure
        |
        v
select one whole PR requiring work
        |
        +-- none -----------------------> select at most one Ready for dev issue
        |
        v
spawn one Sol worker with a PR-level outcome
        |
        v
wait for terminal worker result in this run
        |
        v
refresh complete selected-PR state and report result
```

The initial rollout deliberately limits each scheduled run to one
implementation worker. Luna may inventory all PRs, but it does not create a
parallel write-heavy fan-out.

## Deterministic snapshot layer

### Responsibilities

A small repository script will obtain and normalize the GitHub state needed by
the orchestrator. Its proposed responsibilities are:

1. Resolve the authenticated GitHub identity.
2. List every open PR and retain ownership/assignment metadata.
3. Fetch every page of issue-level PR conversation comments.
4. Fetch every page of inline pull-request review comments.
5. Fetch review-thread resolution state through GraphQL.
6. Fetch every page of review submissions when required for CodeRabbit review
   state.
7. Fetch head/base SHA, draft state, mergeability, review decision, requested
   reviewers, and relevant checks.
8. Normalize records into a stable schema without dropping human or CodeRabbit
   bodies needed for semantic classification.
9. Mark source completeness explicitly.
10. Produce a canonical digest only after every mandatory fetch succeeds.

### Unchanged-state optimization

The latest successful canonical snapshot may be cached outside the repository
worktree. On the next run, the script still refreshes GitHub but returns a
compact result when the canonical state is unchanged:

```json
{
  "complete": true,
  "changed": false,
  "digest": "sha256:<value>",
  "openPrCount": 3
}
```

Luna can then finish without receiving all comment bodies and without starting
Sol. A failed or partial fetch never updates the cached digest and never becomes
`changed: false`.

### What belongs in the digest

At minimum:

- PR identity, scope-relevant assignment, draft state, head/base SHA, and
  mergeability;
- relevant check name, status, conclusion, and associated head;
- comment kind, id, author/type, current body hash, `updatedAt`, reactions, and
  thread resolution where applicable;
- review-submission id, author/type, body hash, submitted commit, state, and
  submission timestamp;
- requested reviewers and current review decisions;
- issue labels and state used by the fallback path.

The implementation should prefer the smallest digest input that captures every
decision-relevant state transition. Raw HTML and presentation-only fields are
out of scope.

## Luna plan contract

Luna receives only a complete changed snapshot. It must emit a strict plan that
classifies every PR and every relevant record exactly once.

Illustrative shape:

```json
{
  "pullRequests": [
    {
      "number": 331,
      "state": "needs_work",
      "scope": "assigned",
      "records": [
        {
          "kind": "issue_comment",
          "id": 5103175999,
          "classification": "actionable",
          "reason": "Owner requested three concrete product changes.",
          "items": [
            "Keep only the first treatment.",
            "Keep border width stable across zoom.",
            "Prepare four width variants."
          ]
        }
      ],
      "workItems": [
        "Address comment 5103175999 items 1-3.",
        "Resolve current merge conflicts.",
        "Move the completed implementation out of draft review-skipped state."
      ]
    }
  ],
  "selected": {
    "kind": "pull_request",
    "number": 331
  }
}
```

The exact schema will be finalized in implementation PR 1. The important
contract is exhaustive record disposition and one PR-level selection.

## Deterministic plan validator

The validator checks mechanical completeness and safety. It does not decide
whether an arbitrary English sentence is actionable.

It must reject a plan when:

- any open PR from the snapshot is missing;
- any relevant comment or review record is missing or classified more than
  once;
- a classification lacks a reason;
- an actionable record has no extracted work item or explicit evidenced
  `not_applicable` outcome;
- the selected work packet omits an actionable item already declared for that
  PR;
- conflict, failing check, draft/review state, and actionable feedback for the
  selected PR are split into separate delegated tasks;
- issue intake is selected while an agent-actionable in-scope PR exists;
- issue intake is selected after an incomplete PR inventory;
- more than one implementation worker is requested;
- the plan attempts a mutation outside its current authorization scope.

Small deterministic high-signal guards may supplement the schema. For example,
a direct automation mention combined with an unchecked checklist cannot be
silently omitted or classified as informational without a concrete reason. The
validator should not grow into a second natural-language triage engine.

## Sol worker contract

The worker receives:

- PR URL and number;
- PR scope and authorization boundary;
- branch, base, and expected starting head SHA;
- snapshot timestamp;
- every known PR-level work item;
- the required terminal outcomes;
- relevant repository validation rules through `AGENTS.md` and linked docs.

The work packet is explicitly a minimum known scope. Before editing, Sol must
refresh the entire selected PR, including both comment streams, review state,
checks, draft state, mergeability, and head SHA. If it discovers another current
actionable item, it adds that item rather than limiting itself to Luna's list.

The worker then:

1. Verifies the remote head has not moved unexpectedly.
2. Reuses or creates the appropriate PR worktree/branch context without editing
   the orchestrator checkout.
3. Resolves conflicts and all current in-scope feedback together.
4. Runs repository-required validation.
5. Performs Shipit review and the Ponytail simplification pass where applicable.
6. Commits and pushes to the existing PR branch.
7. Marks the PR ready only when implementation and validation make that safe.
8. Requests missing review only if an equivalent current request is not already
   pending.
9. Never merges and never deploys directly to production.
10. Refreshes the complete PR state after pushing.

The structured result maps every discovered work item to `addressed`,
`not_addressed`, or evidenced `not_applicable`, and includes before/after head
SHA, commits, push status, validation, final PR state, external waits, and
blockers.

## Worker lifecycle and concurrency

The preferred v2 lifecycle is a true subagent owned by the scheduled parent
run:

```text
parent starts worker -> parent waits -> worker returns terminal result
-> parent reconciles -> parent finishes
```

The workflow does not intentionally yield an active worker to the next hourly
run. This removes the normal need for task claims, token files, sidecars,
continuation records, active-handoff memory, and stale-worker recovery.

This design depends on facts that must be established by the spike:

- whether the scheduler can overlap two runs of the same automation;
- whether a true subagent is cancelled, retained, or detached when its parent
  run ends unexpectedly;
- whether the parent can reliably wait for the expected maximum implementation
  duration;
- whether terminal status remains observable before the scheduled run closes.

If the scheduler serializes runs and parent-owned subagents terminate with the
parent, no custom lock is needed. If runs can overlap, v2 may add one
automation-wide lease acquired at run start and released after terminal
reconciliation. It must not reintroduce comment-, issue-, or PR-level claims.

Independent of scheduler behavior, Sol must compare the current remote head SHA
before push and must not overwrite concurrent branch changes.

## PR readiness and review requests

Workflow v2 distinguishes an action the agent can take from an external event it
must wait for.

The automation may mark an implementation-complete draft ready so CodeRabbit and
the owner can review it. It may request a missing review once. It must not post
the same request or review trigger every hour when equivalent current evidence
already exists.

A green CodeRabbit status alone does not prove review acceptance. A status such
as "review skipped because draft" means the current head has not passed the
required review and cannot be classified `ready_for_merge`.

The exact owner-acceptance rule is an open product decision. The recommended
default is an `APPROVED` review from the repository owner that still applies to
the current head, with any newer actionable owner request taking precedence.

## Issue fallback

Issue intake occurs only when every inventoried in-scope PR is one of:

- `ready_for_merge`;
- `waiting_for_review` with no agent action currently available;
- `blocked` by an external condition that the run cannot resolve.

The run may then select at most one open issue with exact `Ready for dev` and
without exact `Human input wanted` or `Blocked`. It must read the full issue body
and comments before delegating implementation.

Issue implementation uses the same worker-lifecycle rule: one Sol worker owned
by the current run, no cross-run active handoff, and a fresh GitHub state on the
next run if interrupted.

## Regression fixture strategy

Fixtures exercise three distinct layers. They do not pretend that one unit test
can validate the entire agentic workflow.

### Layer 1: snapshot tests

Input: raw GitHub-like API responses.

Output: normalized canonical snapshot or a fail-closed error.

These tests protect pagination, independent source coverage, record identity,
review/check interpretation, canonicalization, and digest behavior.

### Layer 2: validator tests

Input: normalized snapshot plus a hand-authored candidate plan.

Output: accepted plan or a specific validation failure.

These tests protect exhaustive record disposition, one-PR work packets,
authorization, fail-closed issue fallback, and the one-worker limit.

### Layer 3: Luna model evals

Input: normalized fixture snapshot passed to the real orchestrator prompt.

Output: Luna plan, followed by deterministic validation and scenario-specific
semantic assertions.

These evals measure whether Luna understands the comments, identifies all work
items, and selects the correct PR. They are opt-in and do not run in ordinary CI
because they require model access and consume tokens.

### Proposed fixture layout

```text
scripts/fixtures/engineer-workflow/
  pr-331/
    github-input.json
    snapshot.expected.json
    plan.valid.json
    plan.missing-earlier-comment.json
    plan.only-conflict.json
    decision.expected.json
```

### Initial scenarios

1. Earlier multi-item owner comment plus later conflict request.
2. A reminder that points to an earlier comment.
3. CodeRabbit check green while review is skipped because the PR is draft.
4. Conflict, actionable feedback, and a failing check on the same PR.
5. Owner approval that predates a material new head.
6. Partial or failed fetch of either mandatory comment source.
7. Unchanged complete snapshot.
8. No actionable PR work and one eligible `Ready for dev` issue.
9. Remote head changes after planning and before push.
10. Parent or worker interruption without a durable GitHub result.
11. Unowned PR with no direct request.
12. Unowned PR with one narrow direct request.

The PR #331 regression passes only when:

- both comments survive snapshot normalization;
- Luna classifies both comments;
- the earlier comment yields all three requested items;
- the conflict and product requests appear in one PR-level work packet;
- draft/review-skipped state is not treated as CodeRabbit acceptance;
- the plan requests no issue fallback and no second worker.

## Cost and quality evaluation

Workflow v2 treats the model split as a hypothesis to verify, not an assumption
to defend regardless of results.

The fixture eval should compare:

| Candidate | Intended role |
| --- | --- |
| Luna / low | Production orchestrator candidate |
| Terra / medium | Fallback if Luna triage quality is insufficient |
| Sol / medium or extra-high | Quality benchmark, not the default hourly orchestrator |

Each critical scenario should run multiple times. Proposed measurements:

- actionable-comment recall;
- PR selection accuracy;
- work-packet completeness;
- false worker dispatch rate;
- no-op short-circuit rate;
- output stability across repetitions;
- orchestrator tokens per no-op and changed run when available;
- worker tokens per actionable run when available;
- total scheduled runs and total model work per PR moved to a terminal state.

The primary economic metric is cost per successfully reconciled PR, not cost per
individual orchestrator invocation. Several cheap runs that repeat or miss work
may cost more than one slightly stronger triage run.

Proposed Luna acceptance gate:

- every relevant record is classified because the validator enforces coverage;
- every critical fixture selects the correct PR in every acceptance run;
- no issue is selected after incomplete PR inventory;
- the PR #331 scenario produces one complete PR packet;
- false worker dispatch remains acceptably low during live dry-run observation.

If Luna cannot satisfy the semantic gates, Terra/medium is evaluated before
considering an hourly Sol/XHigh orchestrator.

## Evidence and traceability contract

Workflow v2 must be evaluated by observable outcomes, not by whether its prose
looks shorter than v1. Implementation PR 1 must generate a read-only evidence
record for fixture tests, model evals, dry-runs, and the live pilot.

The evidence record is a projection of data already collected by the workflow.
It is not a dashboard, a sidecar, or a new source of truth: it must never
control a later triage decision, replace a fresh GitHub fetch, or reintroduce a
cross-run reconciliation protocol. GitHub remains authoritative; snapshots are
derived observations. The output may be a test artifact, scheduler log, or
human-readable report, but its storage location is an implementation detail
rather than new workflow state.
Deleting an old report must not affect workflow behavior. Its rendering should
use canonical ordering so identical captured inputs and model outputs produce
the same reviewer-facing trace; this does not imply that model judgment itself
is deterministic.

### One run, one navigable trace

For each complete changed snapshot that reaches Luna and each worker run, the
evidence record must make this chain navigable with stable identifiers:

```text
GitHub record or PR condition
        -> normalized snapshot record and digest
        -> Luna disposition and reason
        -> validator coverage result
        -> selected PR-level work item
        -> Sol result and before/after head SHA
        -> refreshed PR snapshot
```

Every relevant record must appear exactly once in the classification portion of
that complete changed snapshot. Every actionable record or actionable PR
condition must reference one or more work items, unless the plan supplies an
evidenced `not_applicable` disposition. Every work item must link back to its
source record or condition. Selected packet items must end as `addressed`,
`not_addressed`, or evidenced `not_applicable`; work on an unselected PR must
instead be marked `not_selected` with its selection reason and must not be
reported as addressed. A no-op run may use a compact trace, but it must still
show a complete unchanged snapshot, its digest, and why no worker was started.
A stage that was not reached must appear as `not_run` with a reason rather than
silently disappearing. An incomplete fetch must show that selection, validation,
and worker execution stopped before they could run.

The human-readable view should link to the GitHub record rather than copy raw
comment bodies. It may include a short generated reason, record kind/id,
`updatedAt`, and body hash so that a reviewer can see which revision was
classified without creating another durable copy of the conversation.

### Required evidence fields

At minimum, the generated record must contain:

- run timestamp, complete/changed status, canonical snapshot digest, and each
  mandatory source's completeness/status and record count;
- each open PR's number, authorization scope, head/base SHA, classified state,
  and selection or non-selection reason;
- each relevant comment, review submission, review thread, check, and PR
  condition with its stable source reference, current revision evidence,
  classification, and reason;
- record-to-work-item mappings, work-item-to-worker-result mappings, and the
  validator's coverage and policy result;
- expected and observed worker head SHA, commit/push outcome, validation
  summary, and the refreshed selected-PR state; and
- the zero-or-one-worker decision, any issue-fallback decision, and evidence
  that its preconditions held.

The same structured evidence should render both a machine-readable artifact and
a compact Markdown summary. The Markdown summary is the reviewer-facing proof;
the structured form allows fixture assertions to inspect the exact same facts.

### PR #331 acceptance trace

The historical PR #331 fixture is the minimum traceability regression. Its
rendered evidence must show all of the following in one selected PR packet:

| Source evidence | Required disposition | Required trace result |
| --- | --- | --- |
| `issue_comment:5103175999` | `actionable` | Three distinct product work items: retain option 1 as the base, keep its border width stable across zoom while preserving the gradient, and prepare variants 1–4 with different border widths. |
| `issue_comment:5107174867` | `actionable` | A conflict-resolution work item. |
| Draft state and review-skipped evidence | `needs_work` | Never classify the PR as CodeRabbit-accepted or `ready_for_merge`. |
| PR selection | `pull_request:331` | One worker packet contains the product items and conflict; no issue fallback or second worker. |

`plan.only-conflict.json` must fail because it omits the earlier actionable
record. The test must expose the missing record in its evidence output, not
only return a generic invalid-plan result.

### Comparison and rollout gates

The comparison must use fixed historical snapshots for correctness and a
non-overlapping observation window for operational measurements; v1 and v2 must
not run as concurrent writing automations. The evaluation scorecard must show
v1 baseline and v2 result for:

- source-record coverage and actionable-record recall;
- selected PR and work-packet completeness;
- duplicate-worker, cross-run-handoff, and repeated-review-request events;
- the identity and number of durable local state surfaces needed to explain an
  outcome; and
- no-op and actionable-run model work, plus cost per PR moved to a valid
  terminal state when telemetry is available.

| Stage | Required evidence | Gate |
| --- | --- | --- |
| Before activation | Deterministic fixtures, including the full PR #331 trace and invalid plans. | Every expected record is present exactly once; deliberately incomplete plans are rejected with the omitted record identified. |
| Model eval | A repeated-run count fixed under Open decision 7 before the first acceptance evaluation, on every critical fixture with the same trace schema. | Every acceptance run selects the expected PR and produces a validator-accepted complete packet. |
| Dry-run | At least three complete live inventories, each with an independently reviewed human inventory. Capture at least one changed/actionable and one unchanged or waiting-only case when live activity permits; otherwise replay the missing case read-only. | Zero GitHub writes; source-to-snapshot coverage, actionable-record recall, and packet completeness are all 100%. Missing actionable records, incomplete packets, and incomplete mandatory sources must be corrected; only non-gating differences may be explicitly accepted with a recorded reason. |
| Live pilot | At least ten scheduled runs and one genuine PR follow-up. | Zero omitted actionable records, duplicate workers for unchanged PR state, cross-run active handoffs, repeated pending review requests, unauthorized writes, expected-head violations, merges, production-deployment attempts, and skipped post-worker refreshes. Every selected packet item has a final disposition and every worker run ends with a complete fresh snapshot. |

Before live writes begin, the owner must set the pilot's cost budget or explicit
comparison threshold from the recorded v1 baseline. Each pilot report must show
the target and observed value; "acceptable cost" alone is not a passing gate.
If usable cost telemetry is unavailable, the economic result is `not_evaluable`
until the owner agrees an explicit proxy before pilot acceptance.

## Delivery plan

### Current specification PR

This document is the only intended repository change. It exists so the design,
tradeoffs, and open decisions can be reviewed before executable work begins.

No automation is paused or modified. No claim, token, sidecar, worktree, branch,
memory, or scheduler state is cleaned up.

### Spike: lifecycle and concurrency

The spike answers four questions:

1. Can the scheduled Luna parent spawn a true Sol subagent and wait for a
   terminal result in the same run?
2. What happens to the worker when the parent completes, fails, or times out?
3. Can two runs of the same hourly automation overlap?
4. Are per-run and per-worker token metrics available directly, or must the
   pilot use proxy measurements such as snapshot size, worker count, and run
   duration?

The spike should use a bounded non-product task or dry-run fixture. It must not
modify an active PR or production configuration merely to test lifecycle.

Spike exit decisions:

- scheduler serialization confirmed: no custom lease;
- overlapping runs confirmed: add one run-wide lease in implementation PR 1;
- child cannot be reliably bound to parent: stop and redesign before PR 1;
- parent cannot wait long enough for ordinary implementation: stop and redesign
  before removing cross-run handoffs.

### Implementation PR 1: introduce workflow v2 beside legacy v1

Proposed additions:

- deterministic GitHub snapshot and canonical digest helper;
- strict plan schema and validator;
- regression fixtures and ordinary unit tests;
- opt-in Luna model-eval harness;
- read-only evidence-report renderer for fixtures, model evals, dry-run, and
  pilot review;
- `engineer-workflow-v2.md` orchestrator prompt;
- compact PR-level worker prompt template;
- package scripts for focused tests and evals;
- a dated tech note because this PR changes executable automation behavior;
- conditional run-wide lease only if required by the spike.

Legacy v1 remains available for rollback. Implementation PR 1 must not delete
the task-claim helper, legacy prompt, claim docs, sidecars, or historical tech
notes.

Before activation:

- all deterministic fixture tests pass;
- Luna passes the agreed critical model-eval gate;
- v1 baseline evidence has been recorded from the fixed fixture corpus and the
  agreed non-overlapping observation window;
- the v2 prompt reads from mission to detailed rules without duplicating the
  same policy in a second long checklist;
- applicable `AGENTS.md` and Shipit rules explicitly distinguish legacy v1 from
  v2 during the transition;
- the active automation still points to v1.

### Dry-run activation

After implementation PR 1 merges:

1. Pause the active v1 automation.
2. Point the scheduled task at v2 in dry-run mode while retaining Luna/low.
3. Run at least three complete live GitHub inventories without workers or
   GitHub writes.
4. Compare every generated evidence report and plan with a human inventory of
   the same PRs.
5. Correct the prompt, snapshot schema, or validator before enabling writes if
   any record is missing or materially misclassified.

Dry-run rollback is changing the scheduler pointer back to the still-present v1
prompt and resuming it. No repository revert is required.

### Live pilot

Enable at most one Sol/XHigh worker per scheduled run. Keep the existing hourly
cadence initially so cost and reliability changes can be compared without also
changing frequency.

Proposed pilot duration: at least ten scheduled runs and at least one genuine
PR follow-up, with a target observation window of approximately one week when
repository activity allows.

Pilot success criteria:

- no actionable comment omitted from the classified inventory;
- no duplicate worker for the same unchanged PR state;
- no cross-run active worker handoff;
- no repeated review request when the existing request is pending;
- no issue intake while an agent-actionable in-scope PR exists;
- all worker pushes respect the expected-head guard;
- every completed worker is followed by a fresh complete PR snapshot;
- no merge and no direct production deployment;
- a recorded v1 comparison and the owner-approved cost budget or telemetry
  proxy required by the evidence and traceability contract.

### Implementation PR 2: remove legacy coordination infrastructure

Only after pilot acceptance:

- make v2 the sole engineer workflow prompt;
- remove legacy task-claim requirements from `AGENTS.md` and Shipit guidance;
- remove the task-claim CLI, package command, and tests when no other automation
  depends on them;
- remove sidecar/reaction/fingerprint requirements that v2 replaces;
- retire the legacy prompt and prompt-contract tests;
- update durable automation documentation and add the shipped tech note;
- keep historical tech notes intact as history.

Local token, sidecar, claim, memory, and worktree cleanup is a separate
recoverable maintenance action. It requires explicit target verification and is
not an implicit part of PR 2.

## Alternatives considered

### One hourly Sol/XHigh agent

This is operationally simpler, but it pays the strongest-model cost on every
unchanged GitHub poll. It remains a benchmark and fallback, not the proposed
default.

### Continue extending the current prompt and claim protocol

This preserves existing mechanisms and avoids migration risk. It also retains
the state-reconciliation burden that motivated the proposal, and each new
failure mode is likely to add another local record or precedence rule.

### Luna implements changes directly

This avoids subagent coordination but assigns complex code changes and
validation to the model selected for repeatable classification work. It does
not match the original quality/cost hypothesis.

### Fully deterministic triage without a model

Mechanical PR state can be classified deterministically, but human comments,
references to earlier discussion, product tradeoffs, and automated-review
hypotheses still require semantic judgment. A handwritten parser would move
complexity into code without eliminating ambiguity.

### Multiple Sol workers in parallel

Parallelism could reduce queue latency, but write-heavy subagents increase
coordination and conflict risk. It is deliberately deferred until the serial v2
workflow is proven and measured.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Luna misclassifies a comment | Exhaustive disposition, critical model evals, and Sol's independent full-PR refresh |
| Snapshot cache hides a change | Cache only complete canonical snapshots; never update cache on partial failure |
| Validator becomes another complex policy engine | Restrict it to schema, coverage, authorization, and a few high-signal guards |
| Worker outlives or loses its parent | Spike lifecycle before implementation; do not remove handoffs if the result is unsafe |
| Scheduled runs overlap | Prefer confirmed scheduler serialization; otherwise one run-wide lease |
| Concurrent branch update | Expected-head recheck before push; never overwrite unexpected remote changes |
| Waiting review causes hourly spam | Explicit waiting state and idempotent review-request evidence |
| Strong worker repeats Luna's token spend | Worker refresh is limited to one selected PR and buys defense against missed scope |
| Migration removes a safety rule too early | Keep v1 and all legacy infrastructure through the live pilot |
| Complexity moves from prompt into excessive code | Ponytail review of scripts and schemas; implement only fixture-proven invariants |
| Evidence report becomes another state store | Keep it read-only, disposable, and outside later triage decisions |

## Open decisions

These decisions should be resolved before implementation PR 1 is marked ready:

1. Does full PR scope remain limited to automation-owned/assigned PRs, with
   narrow direct-request scope elsewhere, or should the automation receive
   broader authority over every repository PR?
2. What exact GitHub evidence constitutes repository-owner acceptance for the
   current head?
3. May the automation automatically mark every implementation-complete draft
   ready for review, or are some drafts intentionally human-controlled?
4. Is one worker per hourly run the desired permanent throughput limit or only
   the pilot limit?
5. When all PRs are waiting on external review, should every hourly run be
   allowed to start one new issue, or should there be a maximum open-PR/WIP cap?
6. Where should the successful snapshot cache and optional run-wide lease live?
7. How many repeated model-eval runs are sufficient for the Luna acceptance
   gate?
8. Which cost telemetry is actually observable in scheduled runs?
9. What exact GitHub evidence proves that CodeRabbit reviewed the current head,
   as opposed to reporting a green skipped/status-only result?
10. What v1 observation window, cost budget, or agreed telemetry proxy must
    gate live-pilot acceptance?

## Decision record

| Decision | Proposed answer | Status |
| --- | --- | --- |
| Preserve Luna/Low orchestrator and Sol/XHigh worker | Yes | Proposed |
| Make the whole PR the unit of delegation | Yes | Proposed |
| Treat Luna work items as minimum scope | Yes; Sol refreshes the whole selected PR | Proposed |
| Require exhaustive classification of every record | Yes; enforced by validator | Proposed |
| Short-circuit unchanged complete snapshots | Yes | Proposed |
| Generate a disposable evidence report for evaluation | Yes; fixtures, model evals, dry-run, and pilot | Proposed |
| Limit initial rollout to one worker per run | Yes | Proposed |
| Keep worker inside the parent run | Yes, subject to spike | Pending spike |
| Replace task claims with no lock or one run-wide lease | Subject to scheduler overlap result | Pending spike |
| Keep legacy v1 through pilot | Yes | Proposed |
| Remove legacy state in implementation PR 1 | No | Proposed |
| Leave merging to repository owner | Yes | Proposed |

## Acceptance criteria for this specification

The specification is ready to approve when a reviewer can answer:

- what problem v2 solves;
- which guarantees from v1 are preserved;
- why Luna and Sol retain separate roles;
- which behavior is deterministic code and which remains model judgment;
- what fixtures test and what they do not test;
- how one v2 run traces back to GitHub evidence and can be compared with v1;
- why the worker receives a whole PR;
- how no-op cost is reduced;
- what the spike must prove;
- what enters implementation PR 1 and PR 2;
- how rollout and rollback work;
- which product decisions remain open.

Approval of this document authorizes planning the spike and implementation PR
1. It does not authorize production activation, legacy cleanup, merging, or
production deployment.

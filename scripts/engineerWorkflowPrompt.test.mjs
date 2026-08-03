import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const promptUrl = new URL(
  '../docs/automation-prompts/engineer-workflow.md',
  import.meta.url,
)
const claimsUrl = new URL('../docs/automation-task-claims.md', import.meta.url)

const readPrompt = () => readFile(promptUrl, 'utf8')
const readClaims = () => readFile(claimsUrl, 'utf8')

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim()

const assertContainsAll = (prompt, policies) => {
  for (const policy of policies) {
    assert.ok(prompt.includes(policy), `Missing workflow policy: ${policy}`)
  }
}

const extractSection = (document, heading, nextHeading) => {
  const start = document.indexOf(heading)
  assert.notEqual(start, -1, `Missing section heading: ${heading}`)

  const end = document.indexOf(nextHeading, start + heading.length)
  assert.notEqual(end, -1, `Missing next section heading: ${nextHeading}`)

  return document.slice(start, end)
}

const assertContainsInOrder = (document, policies) => {
  const normalizedDocument = normalizeWhitespace(document)
  let previousIndex = -1

  for (const policy of policies) {
    const normalizedPolicy = normalizeWhitespace(policy)
    const policyIndex = normalizedDocument.indexOf(
      normalizedPolicy,
      previousIndex + 1,
    )
    assert.ok(
      policyIndex > previousIndex,
      `Missing or out-of-order workflow policy: ${normalizedPolicy}`,
    )
    previousIndex = policyIndex
  }
}

describe('engineer workflow prompt', () => {
  it('requires independent, fail-closed PR comment inventories', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'Mandatory PR conversation inventory:',
      'fetch every page of issue-level PR Conversation comments',
      'every page of inline pull-request review comments',
      'as two independent data sources',
      '/issues/{number}/comments',
      '/pulls/{number}/comments',
      '/pulls/{number}/reviews',
      'must not replace either required comment fetch',
      'do not merge them into either comment stream',
      'build a separate classified review-submission inventory',
      'Consume that separate inventory through priority item 3',
      'PR triage is incomplete',
      'If a normalized tool omits a required field such as `updatedAt`',
      'Never convert a fetch failure into “no actionable comments.”',
    ])
  })

  it('makes direct mentions, requests, checklists, reminders, and edits actionable', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'A direct mention of `@<resolved automation identity>` creates an explicit triage obligation',
      'match the exact login returned by `gh api user --jq .login`',
      'unchecked task-list items',
      'requests to inspect or respond to an earlier comment',
      'Reclassify an edited comment whenever its current `updatedAt` or body hash differs from tracking metadata',
      'clean automated/formal-review signals cannot downgrade a human request',
      'assign the issue to the resolved automation identity',
    ])
    assert.doesNotMatch(prompt, /andrzejkoduje/)
  })

  it('treats assigned PRs as owned and limits other PRs to direct requests', async () => {
    const prompt = await readPrompt()
    const ownership = extractSection(
      prompt,
      'PR ownership and scope:',
      'Automation memory:',
    )

    assertContainsInOrder(ownership, [
      'Resolve the current automation identity with `gh api user --jq .login`',
      'Treat an open PR as automation-owned when its fresh `assignees` metadata contains the resolved automation identity',
      'An assignment is explicit PR-level ownership',
      'An `explicit_request` claim retains only that comment scope and must not upgrade the whole PR to owned',
      'Re-evaluate assignment and other ownership evidence from live metadata every run',
      'an old memory event, released claim, label, author, requested-review state, or branch-name guess alone is not ownership',
      'Build both mandatory comment inventories for every open PR',
      'only a current direct mention of the resolved automation identity that contains a concrete request creates `explicit_request` scope',
      'acquire the normal branch-bound PR claim and verify the current checkout and push permission before delegation',
      'include `scope=automation_owned|assigned|explicit_request` in its purpose',
      'For `explicit_request`, also record the triggering comment URL/id',
    ])

    assertContainsAll(prompt, [
      'For every open PR, fetch every page of issue-level PR Conversation comments',
      'On an owned or assigned PR, treat concrete requests as actionable even without a mention',
      'On an otherwise unowned/unassigned PR, require a direct mention of the resolved automation identity before treating a request as actionable',
      'Actionable external/human PR comments on owned or assigned open PRs, plus exact `explicit_request` comments on other open PRs',
      'An assigned PR is owned for full follow-up even when it was not originally created by automation',
      'PR scope: `<automation_owned | assigned | explicit_request>`',
    ])
  })

  it('keeps addressed tracking comment-specific and preserves human request triage', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'an actionable human-authored `issue_comment`',
      'contains an unchecked concrete checklist',
      'one sidecar record per triggering comment',
      'a reaction on one comment never acknowledges another comment',
      'Add the automation `rocket` reaction only when its `updatedAt` and body hash still match the sidecar',
      'Workers must not add these markers',
      'If the current comment version matches an existing sidecar and already has the automation `rocket` reaction',
      'a stale local `in_progress` record must never cause duplicate delegation',
    ])
  })

  it('persists addressed review submissions separately and reopens changed versions', async () => {
    const prompt = await readPrompt()

    const reviewSubmissionTracking = extractSection(
      prompt,
      'Review submission tracking:',
      'Delegated worker completion boundary:',
    )
    assertContainsInOrder(reviewSubmissionTracking, [
      'Treat review submissions (`review_submission`) and inline review comments (`review_comment`) as separate record kinds with separate state namespaces',
      're-fetch the exact review through `GET /repos/{owner}/{repo}/pulls/{number}/reviews/{review_id}`',
      'Compute a SHA-256 hash of its fetched body',
      'record the observed review version as the exact `submitted_at`, `commit_id`, and `state` values',
      'The fingerprint is the repository, PR number, review id, body hash, and observed review version together',
      'repository-scoped `review-submissions/<canonical-owner>/<canonical-repo>/` state directory',
      'GitHub `nameWithOwner`, normalized to lowercase',
      'consult the dedicated review-submission record before acquiring a claim',
      'If its status is `addressed` and its complete fingerprint exactly matches the freshly fetched review, classify that submission `addressed`',
      'do not acquire a claim solely for it, add `eyes` or `rocket`, or spawn a worker',
      'If the fetched body hash or any observed review-version field differs, treat the previous fingerprint as non-matching and re-triage the current submission',
      'fail closed instead of using placeholder fingerprint values',
      'acquire the branch-bound PR claim, mark any previous record `stale` or `superseded`',
      'delegate its explicit request items without attempting comment reactions',
      'Mark its dedicated record `addressed` only when the complete fingerprint is unchanged',
      'store the item mapping, evidence, and reconciliation timestamp without requiring a GitHub reaction',
    ])

    assertContainsAll(reviewSubmissionTracking, [
      'Never use a review-submission record to acknowledge or suppress an inline review comment',
      'A new review id is always a distinct submission',
      'Keep addressed records through claim release and routine cleanup while their PR remains open',
    ])

    const runChecklist = prompt.slice(prompt.indexOf('## Run Checklist'))
    assertContainsInOrder(runChecklist, [
      'Before treating a review submission as actionable, re-fetch it and consult its dedicated addressed fingerprint',
      'For a review-submission candidate without a matching addressed fingerprint, acquire the claim',
      'Reconcile review submissions through their complete body/version fingerprint without requiring a reaction',
      'Release the claim only after every triggering comment sidecar and dedicated review-submission record is durably reconciled',
    ])
  })

  it('recovers durable worker handoffs before fresh triage', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'Durable worker handoffs:',
      'Never infer it from a legacy automation name or hard-code `space-game-automation`.',
      'Cron/standalone scheduled runs can begin in a fresh chat',
      'node scripts/automationHandoff.mjs list --automation-id <active automation id>',
      'claim registration metadata, not free-form ownership evidence',
      'After spawning a worker and before yielding, create exactly one pending record',
      'identifying a matching claim as same-automation before this record exists',
      'The record contains a token-file path only; never place a raw claim token in it.',
      'A worker must not create, alter, archive, or write automation memory or handoff records.',
      'retain the same-automation pending record as explicit `archive_recovery` state',
      'must not require verification of the released claim or repeat GitHub reconciliation writes',
      'before yielding while the worker is active',
      'current run time and terminal outcome',
      'A later scheduled invocation with the same automation id must reconcile the record',
    ])

    const completionBoundary = extractSection(
      prompt,
      'Delegated worker completion boundary:',
      'Priority order:',
    )
    assertContainsInOrder(completionBoundary, [
      'resolve the active automation id, list its pending handoffs, and inspect live claims before possible active-worker handoffs or fresh PR/issue triage',
      'Handoff recovery precedes fresh triage',
      'classify it as `same_automation_unregistered`',
      'do not call the claim foreign merely because the handoff is absent',
      'enter `archive_recovery` instead of the live-worker path',
      'retry only the idempotent archive command',
      'The current invocation may resume that record even when the claim `owner`, original run id, or parent thread id belongs to an earlier invocation',
      'If it is active, verify and heartbeat the recorded claim',
      'end this invocation as `awaiting_worker`',
      'Only when the recorded worker returns a terminal result while its claim is still valid may the same-automation invocation reconcile the worker handoff, triggering comment sidecars, and dedicated review-submission records',
      'perform the terminal-result reconciliation immediately',
      'release the task claim, then archive the matching durable handoff',
      'If release succeeds but archive fails, retain the pending record as `archive_recovery`',
      'a later scheduled invocation under the same active automation id must run this recovery protocol',
    ])
  })

  it('keeps live claims authoritative while allowing same-automation recovery', async () => {
    const [prompt, claims] = await Promise.all([readPrompt(), readClaims()])

    const automationMemory = extractSection(
      prompt,
      'Automation memory:',
      'Mandatory PR conversation inventory:',
    )
    assertContainsInOrder(automationMemory, [
      'Automation memory is historical context and an audit trail, not an authoritative current-state database',
      'Derive current state at decision time from fresh live GitHub/`gh` data, claim and sidecar files, durable handoff records, direct delegated-worker status, and current branch/worktree Git state',
      'Claim-first reconciliation: the live task claim is the concurrency authority',
      'Before interpreting memory, worker ids, handoff records, or sidecars, read the matching claim',
      'Do not release, replace, or duplicate that claim',
      'Determine claim ownership from its exact `automation_id` registration metadata, not from whether a handoff exists',
      'whose handoff is missing is `same_automation_unregistered`',
      'never start a second worker',
      'one with missing/malformed registration metadata and no matching handoff, is foreign',
      'a later invocation may use its recorded token file to verify that exact claim and resume the handoff',
      'it does not acquire a new claim or start a second worker',
      'A durable handoff tells the same automation what to reconcile, but it must never override a recent active claim or justify a second worker',
    ])

    const completionBoundary = extractSection(
      prompt,
      'Delegated worker completion boundary:',
      'Priority order:',
    )
    assertContainsInOrder(completionBoundary, [
      'Handoff recovery precedes fresh triage',
      'verify that its kind/id/branch exactly matches the live claim, then use the recorded token file with the claim helper to verify that claim before acting',
      'This is recovery of the same claim, not a claim replacement',
      'Query the recorded worker thread through `codex_app__read_thread` when that tool is available',
      'If worker status is unavailable while the claim is within the freshness window, retain the record and classify it as `awaiting_status`, not terminal or failed',
      'terminal worker status overrides the freshness wait',
      'Once the freshness window has elapsed, classify unavailable worker state as `uncertain`',
    ])

    const reconciliationRule = extractSection(
      claims,
      '## Reconciliation rule',
      '## Claim Record Fields',
    )
    assertContainsInOrder(reconciliationRule, [
      'The claim file is the single source of truth for ownership',
      'an unexpired `active` claim is treated as healthy when its `last_seen` is within the 2-hour freshness window',
      'A parallel orchestrator must not release, replace, or duplicate that claim',
      'Every automation claim registers the exact active automation id and token-file path in its `purpose` metadata when acquired',
      'Determine same-automation ownership from that registration, not from whether a durable handoff already exists',
      'This is not a new ownership acquisition and must not start another worker',
      "match the claim's kind, id, and branch, and its recorded token file must verify through the claim helper before it is used",
      'whose handoff is missing is `same_automation_unregistered`, not foreign',
      'A claim registered to another automation, or one with missing/malformed registration metadata and no matching handoff, remains foreign',
      'That is `archive_recovery`, not a live-claim mismatch',
      'retry only the idempotent archive',
      "After 2 hours without a heartbeat, or after the claim's own TTL has expired",
    ])

    const sharedPolicies = [
      'must not start another worker',
      'normal expiry path',
    ]
    assertContainsAll(normalizeWhitespace(reconciliationRule), sharedPolicies)
  })
})

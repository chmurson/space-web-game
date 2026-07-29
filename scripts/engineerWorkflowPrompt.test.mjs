import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const promptUrl = new URL(
  '../docs/automation-prompts/engineer-workflow.md',
  import.meta.url,
)
const claimsUrl = new URL(
  '../docs/automation-task-claims.md',
  import.meta.url,
)

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
      'A direct `@andrzejkoduje` mention creates an explicit triage obligation',
      'unchecked task-list items',
      'requests to inspect or respond to an earlier comment',
      'Reclassify an edited comment whenever its current `updatedAt` or body hash differs from tracking metadata',
      'clean automated/formal-review signals cannot downgrade a human request',
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

  it('persists active worker handoffs before yielding and terminal outcomes after reconciliation', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'before yielding while the worker is active',
      'current run time and terminal outcome',
      'before any new delegation',
    ])

    const completionBoundary = extractSection(
      prompt,
      'Delegated worker completion boundary:',
      'Priority order:',
    )
    assertContainsInOrder(completionBoundary, [
      'inspect live claims before possible active-worker handoffs or fresh PR/issue triage',
      'For a foreign claim, skip that task and continue triage; for a claim owned by this run, continue waiting or refresh the continuation',
      'Only when the claim is no longer active, or the owning worker returns a terminal result while its claim is still valid, reconcile the worker handoff, triggering comment sidecars, and dedicated review-submission records',
      'If the worker is terminal, perform the terminal-result reconciliation immediately',
      'If the run must yield while a claim is recent, preserve the active delegated-worker, claim, and continuation/wakeup handoff state',
      'While waiting on that claim, continue the existing handoff rather than starting another task',
      'Wait for a terminal worker result',
      'Only after reconciliation and claim release may the orchestrator prepend a terminal memory event and emit its final report',
    ])
  })

  it('uses recent live claims as the authority during reconciliation', async () => {
    const [prompt, claims] = await Promise.all([readPrompt(), readClaims()])

    const automationMemory = extractSection(
      prompt,
      'Automation memory:',
      'Mandatory PR conversation inventory:',
    )
    assertContainsInOrder(automationMemory, [
      'Automation memory is historical context and an audit trail, not an authoritative current-state database',
      'Derive current state at decision time from fresh live GitHub/`gh` data, claim and sidecar files, direct delegated-worker status, and current branch/worktree Git state',
      'Claim-first reconciliation: the live task claim is the concurrency authority',
      'Before interpreting memory, worker ids, continuation records, or sidecars, read the matching claim',
      'Do not release, replace, or duplicate that claim',
      'If this is a foreign claim, skip that task and continue with other claimable work; if it is owned by this run, wait for the owning worker/continuation or the normal claim-expiry path',
      'Sidecars, memory events, and worker ids are audit and wakeup hints, not ownership state',
    ])

    const completionBoundary = extractSection(
      prompt,
      'Delegated worker completion boundary:',
      'Priority order:',
    )
    assertContainsInOrder(completionBoundary, [
      'inspect live claims before possible active-worker handoffs or fresh PR/issue triage',
      'For a foreign claim, skip that task and continue triage; for a claim owned by this run, continue waiting or refresh the continuation',
      'Once the freshness window has elapsed, question the handoff using worker status, sidecars, and branch/worktree state',
      'Only when the claim is no longer active, or the owning worker returns a terminal result while its claim is still valid, reconcile the worker handoff, triggering comment sidecars, and dedicated review-submission records',
      'If worker status is unavailable while the claim is within the freshness window, do not classify the work as terminal or failed',
      'terminal worker status overrides the freshness wait for the owning run',
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
      'For a foreign claim, leave it untouched, skip only its associated task, and continue with other claimable work',
      'For a claim owned by the current run, wait for the owning worker/continuation or the normal claim-expiry path',
      'Those other files are audit and wakeup hints only',
      'After 2 hours without a heartbeat, or after the claim\'s own TTL has expired',
    ])

    const sharedPolicies = [
      'continue with other claimable work',
      'owning worker/continuation or the normal claim-expiry path',
    ]
    assertContainsAll(normalizeWhitespace(automationMemory), sharedPolicies)
    assertContainsAll(normalizeWhitespace(reconciliationRule), sharedPolicies)
  })
})

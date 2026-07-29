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
      'must not replace either required comment fetch',
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

  it('recovers durable worker handoffs before fresh triage', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'Durable worker handoffs:',
      'Never infer it from a legacy automation name or hard-code `space-game-automation`.',
      'Cron/standalone scheduled runs can begin in a fresh chat',
      'node scripts/automationHandoff.mjs list --automation-id <active automation id>',
      'After spawning a worker and before yielding, create exactly one pending record',
      'The record contains a token-file path only; never place a raw claim token in it.',
      'A worker must not create, alter, archive, or write automation memory or handoff records.',
      'Archive a record only after terminal reconciliation and successful claim release',
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
      'The current invocation may resume that record even when the claim `owner`, original run id, or parent thread id belongs to an earlier invocation',
      'If it is active, verify and heartbeat the recorded claim',
      'end this invocation as `awaiting_worker`',
      'Only when the recorded worker returns a terminal result while its claim is still valid may the same-automation invocation reconcile the worker handoff and triggering sidecars',
      'release the task claim, then archive the matching durable handoff',
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
      'If it lacks a matching same-automation handoff, it is foreign: skip that task and continue with other claimable work',
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
      'A durable pending handoff record created by the same active automation is the exception to the old same-run waiting rule',
      'This is not a new ownership acquisition and must not start another worker',
      "match the claim's kind, id, and branch, and its recorded token file must verify through the claim helper before it is used",
      'For a foreign claim or a claim without a matching same-automation handoff, leave it untouched, skip only its associated task, and continue with other claimable work',
      'Handoff records, sidecars, memory events, and worker ids are audit and wakeup hints only',
      "After 2 hours without a heartbeat, or after the claim's own TTL has expired",
    ])

    const sharedPolicies = [
      'continue with other claimable work',
      'must not start another worker',
    ]
    assertContainsAll(normalizeWhitespace(reconciliationRule), sharedPolicies)
  })
})

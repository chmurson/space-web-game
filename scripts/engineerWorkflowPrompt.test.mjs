import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const promptUrl = new URL(
  '../docs/automation-prompts/engineer-workflow.md',
  import.meta.url,
)

const readPrompt = () => readFile(promptUrl, 'utf8')

const assertContainsAll = (prompt, policies) => {
  for (const policy of policies) {
    assert.ok(prompt.includes(policy), `Missing workflow policy: ${policy}`)
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

  it('persists active worker handoffs before yielding and terminal outcomes after reconciliation', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'before yielding while the worker is active',
      'active delegated-worker, claim, and continuation/wakeup handoff state',
      'including the next reconciliation action',
      'reconcile the worker result rather than mark the run complete',
      'Only after delegated-worker reconciliation and claim release',
      'current run time and terminal outcome',
      'Do not reconcile persisted active-worker handoffs before performing fresh PR/issue triage for a foreign recent claim',
      'If the worker is terminal, perform the terminal-result reconciliation immediately',
      'rather than starting another task',
      'before any new delegation',
    ])
  })

  it('uses recent live claims as the authority during reconciliation', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'Claim-first reconciliation: the live task claim is the concurrency authority',
      'If it is `active`, unexpired, and `last_seen` is within the 2-hour reconciliation freshness window, treat the task as in progress',
      'Do not release, replace, or duplicate that claim',
      'Sidecars, memory events, and worker ids are audit and wakeup hints, not ownership state',
      'inspect live claims before possible active-worker handoffs or fresh PR/issue triage',
      'Once the freshness window has elapsed, question the handoff using worker status, sidecars, and branch/worktree state',
      'If worker status is unavailable while the claim is within the freshness window, do not classify the work as terminal or failed',
      'terminal worker status overrides the freshness wait for the owning run',
    ])

    const claims = await readFile(
      new URL('../docs/automation-task-claims.md', import.meta.url),
      'utf8',
    )
    assert.ok(claims.includes('2-hour freshness window'))
    assert.ok(claims.includes("an unexpired `active` claim"))
  })
})

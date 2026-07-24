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

  it('keeps addressed tracking comment-specific and guards the PR 252 regression', async () => {
    const prompt = await readPrompt()

    assertContainsAll(prompt, [
      'pull/252#issuecomment-4980190452',
      'one sidecar record per triggering comment',
      'a reaction on one comment never acknowledges another comment',
      'Add the automation `rocket` reaction only when its `updatedAt` and body hash still match the sidecar',
      'Workers must not add these markers',
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
    ])
  })
})

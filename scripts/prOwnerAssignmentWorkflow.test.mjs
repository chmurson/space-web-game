import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { parse } from 'yaml'

const codeownersUrl = new URL('../.github/CODEOWNERS', import.meta.url)
const workflowUrl = new URL(
  '../.github/workflows/assign-pr-owner.yml',
  import.meta.url,
)
const githubExpression = (expression) => `\${{ ${expression} }}`

const readWorkflow = async () => {
  const source = await readFile(workflowUrl, 'utf8')
  return { source, workflow: parse(source) }
}

describe('PR owner assignment configuration', () => {
  it('requests chmurson for every repository path', async () => {
    const codeowners = await readFile(codeownersUrl, 'utf8')

    assert.equal(codeowners, '* @chmurson\n')
  })

  it('assigns chmurson on safe base-repository PR events', async () => {
    const { workflow } = await readWorkflow()

    assert.deepEqual(workflow.on, {
      pull_request_target: {
        types: ['opened', 'reopened'],
      },
    })
    assert.deepEqual(workflow.permissions, {
      issues: 'write',
    })

    const job = workflow.jobs['assign-owner']
    assert.equal(
      job.if,
      githubExpression(
        "!contains(github.event.pull_request.assignees.*.login, 'chmurson')",
      ),
    )
    assert.equal(job['runs-on'], 'ubuntu-latest')
    assert.equal(job.steps.length, 1)
    assert.equal(Object.hasOwn(job.steps[0], 'uses'), false)
    assert.equal(job.steps[0].env.GH_TOKEN, githubExpression('github.token'))
    assert.equal(
      job.steps[0].env.PR_NUMBER,
      githubExpression('github.event.pull_request.number'),
    )
    assert.match(
      job.steps[0].run,
      /repos\/\$\{GITHUB_REPOSITORY\}\/issues\/\$\{PR_NUMBER\}\/assignees/,
    )
    assert.match(job.steps[0].run, /assignees\[\]=chmurson/)
  })

  it('never checks out or executes pull-request-authored content', async () => {
    const { source } = await readWorkflow()

    assert.doesNotMatch(source, /actions\/checkout/)
    assert.doesNotMatch(
      source,
      /github\.event\.pull_request\.(body|head|title)/,
    )
    assert.doesNotMatch(source, /\bsecrets\./)
  })
})

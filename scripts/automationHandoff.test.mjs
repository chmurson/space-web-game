import assert from 'node:assert/strict'
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  archiveHandoff,
  createHandoff,
  getDefaultHandoffRoot,
  listPendingHandoffs,
  runCli,
} from './automationHandoff.mjs'

const tempRoots = []

const createRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'space-game-handoffs-'))
  tempRoots.push(root)
  return root
}

const at = (isoString) => new Date(isoString)

const rawTokenSentinel = 'claim-token-sentinel-7f4e634a'

const handoffOptions = (handoffRoot) => ({
  automationId: 'space-web-game-engineer-workflow',
  branch: 'automation/pr-341-follow-up',
  handoffRoot,
  id: '341',
  kind: 'pr',
  nextAction:
    'Inspect the worker thread, then reconcile each triggering comment.',
  parentThreadId: '019fad51-58a8-7bb1-a226-35e74b03f1c1',
  runId: 'space-web-game-engineer-workflow-2026-07-29T12:01:02Z',
  scope: 'automation_owned',
  sidecarPaths: ['/tmp/sidecars/pr-341-comment-1.json'],
  taskUrl: 'https://github.com/chmurson/space-web-game/pull/341',
  token: rawTokenSentinel,
  tokenFile: '/tmp/tokens/pr-341.token',
  workerThreadId: '019fad52-3a32-7a81-a3b5-9561498f4f0f',
  worktreePath: '/tmp/worktrees/pr-341',
})

const handoffArchiveOptions = (handoffRoot) => ({
  automationId: 'space-web-game-engineer-workflow',
  handoffRoot,
  id: '341',
  kind: 'pr',
  note: 'The claim was released after terminal reconciliation.',
  now: at('2026-07-29T12:10:00.000Z'),
  outcome: 'reconciled',
  runId: 'space-web-game-engineer-workflow-2026-07-29T12:10:00Z',
  workerThreadId: '019fad52-3a32-7a81-a3b5-9561498f4f0f',
})

describe('automationHandoff', () => {
  let handoffRoot

  beforeEach(async () => {
    handoffRoot = await createRoot()
  })

  after(async () => {
    await Promise.all(
      tempRoots.map((root) => rm(root, { force: true, recursive: true })),
    )
  })

  it('uses the active automation id to derive a durable default root', () => {
    assert.equal(
      getDefaultHandoffRoot('space-web-game-engineer-workflow', {
        CODEX_HOME: '/tmp/codex-home',
      }),
      '/tmp/codex-home/automations/space-web-game-engineer-workflow/handoffs',
    )
  })

  it('creates a private, token-free pending record with the recovery context', async () => {
    const result = await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })

    assert.equal(result.status, 'created')
    assert.equal(result.handoff.status, 'pending')
    assert.equal(result.handoff.scope, 'automation_owned')
    assert.equal(
      result.handoff.handoff_path,
      path.join(handoffRoot, 'pending', 'pr-341.json'),
    )

    const stored = await readFile(result.handoff.handoff_path, 'utf8')
    assert.doesNotMatch(stored, /secret|raw token/i)
    assert.equal(stored.includes(rawTokenSentinel), false)
    assert.match(stored, /019fad52-3a32-7a81-a3b5-9561498f4f0f/)
    assert.match(stored, /next_reconciliation_action/)
    assert.match(stored, /token_file/)

    const mode = (await stat(result.handoff.handoff_path)).mode & 0o777
    assert.equal(mode & 0o077, 0)
  })

  it('fails closed with existing handoff details rather than overwrite a pending task', async () => {
    const created = await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })

    await assert.rejects(
      () =>
        createHandoff({
          ...handoffOptions(handoffRoot),
          now: at('2026-07-29T12:02:02.000Z'),
        }),
      (error) => {
        assert.equal(error.codeName, 'HANDOFF_ACTIVE')
        assert.deepEqual(error.details, created.handoff)
        return true
      },
    )
  })

  it('atomically rejects one of two concurrent duplicate creations', async () => {
    const options = {
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    }
    const results = await Promise.allSettled([
      createHandoff(options),
      createHandoff(options),
    ])
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)
    assert.equal(rejected[0].reason.codeName, 'HANDOFF_ACTIVE')

    const listed = await listPendingHandoffs({
      automationId: 'space-web-game-engineer-workflow',
      handoffRoot,
    })
    assert.equal(listed.handoffs.length, 1)
    assert.deepEqual(listed.handoffs[0], fulfilled[0].value.handoff)
  })

  it('preserves HANDOFF_ACTIVE when existing details cannot be read or validated', async () => {
    for (const invalidRecord of ['not json', '{}']) {
      const invalidRoot = await createRoot()
      const created = await createHandoff({
        ...handoffOptions(invalidRoot),
        now: at('2026-07-29T12:01:02.000Z'),
      })
      await writeFile(created.handoff.handoff_path, invalidRecord)

      await assert.rejects(
        () =>
          createHandoff({
            ...handoffOptions(invalidRoot),
            now: at('2026-07-29T12:02:02.000Z'),
          }),
        (error) => {
          assert.equal(error.codeName, 'HANDOFF_ACTIVE')
          assert.equal(error.details, null)
          return true
        },
      )
    }
  })

  it('accepts the recovery protocol through its command-line interface', async () => {
    const result = await runCli([
      'node',
      'scripts/automationHandoff.mjs',
      'create',
      '--automation-id',
      'space-web-game-engineer-workflow',
      '--root',
      handoffRoot,
      '--kind',
      'pr',
      '--id',
      '341',
      '--branch',
      'automation/pr-341-follow-up',
      '--worker-id',
      '019fad52-3a32-7a81-a3b5-9561498f4f0f',
      '--token-file',
      '/tmp/tokens/pr-341.token',
      '--scope',
      'automation_owned',
      '--next-action',
      'Inspect the worker thread.',
      '--worktree',
      '/tmp/worktrees/pr-341',
      '--sidecar',
      '/tmp/sidecars/pr-341-comment-1.json',
      '--sidecar',
      '/tmp/sidecars/pr-341-comment-2.json',
    ])

    assert.equal(result.status, 'created')
    assert.deepEqual(result.handoff.sidecar_paths, [
      '/tmp/sidecars/pr-341-comment-1.json',
      '/tmp/sidecars/pr-341-comment-2.json',
    ])
  })

  it('accepts help aliases in command position', async () => {
    for (const helpCommand of ['--help', '-h']) {
      const result = await runCli([
        'node',
        'scripts/automationHandoff.mjs',
        helpCommand,
      ])

      assert.equal(result.status, 'help')
      assert.match(result.usage, /^Usage:/)
    }
  })

  it('lists pending records and rejects malformed recovery state', async () => {
    await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })

    const listed = await listPendingHandoffs({
      automationId: 'space-web-game-engineer-workflow',
      handoffRoot,
    })
    assert.equal(listed.handoffs.length, 1)
    assert.equal(listed.handoffs[0].claim.id, '341')

    await writeFile(
      path.join(handoffRoot, 'pending', 'issue-404.json'),
      'not json',
    )

    await assert.rejects(
      () =>
        listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        }),
      { codeName: 'HANDOFF_INVALID' },
    )
  })

  it('uses record-specific wording for invalid stored sidecar paths', async () => {
    const created = await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })
    const stored = JSON.parse(
      await readFile(created.handoff.handoff_path, 'utf8'),
    )
    stored.sidecar_paths = '/tmp/sidecars/not-a-list.json'
    await writeFile(
      created.handoff.handoff_path,
      `${JSON.stringify(stored, null, 2)}\n`,
    )

    await assert.rejects(
      () =>
        listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        }),
      (error) => {
        assert.equal(error.codeName, 'USAGE')
        assert.equal(error.message, 'sidecar paths must be a list')
        return true
      },
    )
  })

  it('rejects pending records whose identity disagrees with their storage path', async () => {
    for (const [field, value, message] of [
      [
        'automation_id',
        'different-automation',
        'Handoff automation identity does not match its storage root',
      ],
      [
        'handoff_id',
        'issue-341',
        'Handoff task identity does not match its file name',
      ],
    ]) {
      const identityRoot = await createRoot()
      const created = await createHandoff({
        ...handoffOptions(identityRoot),
        now: at('2026-07-29T12:01:02.000Z'),
      })
      const stored = JSON.parse(
        await readFile(created.handoff.handoff_path, 'utf8'),
      )
      stored[field] = value
      await writeFile(
        created.handoff.handoff_path,
        `${JSON.stringify(stored, null, 2)}\n`,
      )

      await assert.rejects(
        () =>
          listPendingHandoffs({
            automationId: 'space-web-game-engineer-workflow',
            handoffRoot: identityRoot,
          }),
        (error) => {
          assert.equal(error.codeName, 'HANDOFF_INVALID')
          assert.equal(error.message, message)
          return true
        },
      )
    }
  })

  it('archives only the matching terminal worker record', async () => {
    await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })

    await assert.rejects(
      () =>
        archiveHandoff({
          ...handoffArchiveOptions(handoffRoot),
          workerThreadId: 'different-worker',
        }),
      { codeName: 'WORKER_MISMATCH' },
    )

    const archived = await archiveHandoff(handoffArchiveOptions(handoffRoot))

    assert.equal(archived.status, 'archived')
    assert.equal(archived.handoff.status, 'reconciled')
    assert.equal(archived.handoff.archived_at, '2026-07-29T12:10:00.000Z')
    assert.equal(
      archived.handoff.reconciliation_note,
      'The claim was released after terminal reconciliation.',
    )
    assert.equal(
      archived.handoff.reconciliation_run_id,
      'space-web-game-engineer-workflow-2026-07-29T12:10:00Z',
    )
    assert.equal(
      (
        await listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        })
      ).handoffs.length,
      0,
    )
    assert.equal((await readdir(path.join(handoffRoot, 'completed'))).length, 1)
  })

  it('recovers idempotently after an uncertain pending-record removal', async () => {
    const created = await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })
    const archiveOptions = handoffArchiveOptions(handoffRoot)
    const pendingRoot = path.dirname(created.handoff.handoff_path)

    await chmod(pendingRoot, 0o500)
    try {
      await assert.rejects(() => archiveHandoff(archiveOptions), {
        codeName: 'HANDOFF_ARCHIVE_UNCERTAIN',
      })
    } finally {
      await chmod(pendingRoot, 0o700)
    }

    assert.equal(
      (
        await listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        })
      ).handoffs.length,
      1,
    )
    assert.equal((await readdir(path.join(handoffRoot, 'completed'))).length, 1)

    const retried = await archiveHandoff({
      ...archiveOptions,
      note: 'Retry after the pending record could not be removed.',
      now: at('2026-07-29T12:11:00.000Z'),
      runId: 'space-web-game-engineer-workflow-2026-07-29T12:11:00Z',
    })
    assert.equal(retried.status, 'archived')
    assert.equal(retried.handoff.archived_at, '2026-07-29T12:10:00.000Z')
    assert.equal(
      retried.handoff.reconciliation_note,
      'The claim was released after terminal reconciliation.',
    )
    assert.equal(
      retried.handoff.reconciliation_run_id,
      'space-web-game-engineer-workflow-2026-07-29T12:10:00Z',
    )
    assert.equal(
      (
        await listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        })
      ).handoffs.length,
      0,
    )
    assert.equal((await readdir(path.join(handoffRoot, 'completed'))).length, 1)
  })

  it('rejects a conflicting archive while preserving the pending record', async () => {
    const created = await createHandoff({
      ...handoffOptions(handoffRoot),
      now: at('2026-07-29T12:01:02.000Z'),
    })
    const pendingRecord = await readFile(created.handoff.handoff_path, 'utf8')
    const archiveOptions = handoffArchiveOptions(handoffRoot)

    await archiveHandoff(archiveOptions)
    await writeFile(created.handoff.handoff_path, pendingRecord, {
      mode: 0o600,
    })

    await assert.rejects(
      () => archiveHandoff({ ...archiveOptions, outcome: 'abandoned' }),
      { codeName: 'HANDOFF_ARCHIVE_CONFLICT' },
    )
    assert.equal(
      (
        await listPendingHandoffs({
          automationId: 'space-web-game-engineer-workflow',
          handoffRoot,
        })
      ).handoffs.length,
      1,
    )
    assert.equal((await readdir(path.join(handoffRoot, 'completed'))).length, 1)
  })
})

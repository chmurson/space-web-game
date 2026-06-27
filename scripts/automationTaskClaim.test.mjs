import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  acquireClaim,
  heartbeatClaim,
  releaseClaim,
  runCli,
  verifyClaim,
} from './automationTaskClaim.mjs'

const tempRoots = []

const createRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'space-game-claims-'))
  tempRoots.push(root)
  return root
}

const at = (isoString) => new Date(isoString)

describe('automationTaskClaim', () => {
  let claimRoot

  beforeEach(async () => {
    claimRoot = await createRoot()
  })

  after(async () => {
    await Promise.all(
      tempRoots.map((root) => rm(root, { force: true, recursive: true })),
    )
  })

  it('acquires a task claim with a hashed token record', async () => {
    const result = await acquireClaim({
      branch: 'issue-59-trail-render-frame-debug-state',
      claimRoot,
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      purpose: 'address review comments',
      token: 'secret-a',
      ttlSeconds: 60,
    })

    assert.equal(result.status, 'acquired')
    assert.equal(result.token, 'secret-a')
    assert.equal(result.claim.kind, 'pr')
    assert.equal(result.claim.id, '71')
    assert.equal(result.claim.branch, 'issue-59-trail-render-frame-debug-state')
    assert.equal(result.claim.owner, 'worker-a')

    const record = JSON.parse(
      await readFile(path.join(claimRoot, 'pr-71.json'), 'utf8'),
    )
    assert.equal(record.token_hash.startsWith('sha256:'), true)
    assert.equal(Object.hasOwn(record, 'token'), false)
  })

  it('denies a duplicate active claim for the same task', async () => {
    await acquireClaim({
      claimRoot,
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          id: '71',
          kind: 'pr',
          now: at('2026-06-27T10:00:30.000Z'),
          owner: 'worker-b',
          pid: null,
          token: 'secret-b',
          ttlSeconds: 60,
        }),
      { codeName: 'CLAIM_ACTIVE' },
    )
  })

  it('denies an active claim for a different task on the same branch', async () => {
    await acquireClaim({
      branch: 'issue-59-trail-render-frame-debug-state',
      claimRoot,
      id: '59',
      kind: 'issue',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    await assert.rejects(
      () =>
        acquireClaim({
          branch: 'issue-59-trail-render-frame-debug-state',
          claimRoot,
          id: '71',
          kind: 'pr',
          now: at('2026-06-27T10:00:30.000Z'),
          owner: 'worker-b',
          pid: null,
          token: 'secret-b',
          ttlSeconds: 60,
        }),
      { codeName: 'BRANCH_CLAIM_ACTIVE' },
    )
  })

  it('verifies and heartbeats only with the matching token and branch', async () => {
    await acquireClaim({
      branch: 'issue-59-trail-render-frame-debug-state',
      claimRoot,
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    await assert.rejects(
      () =>
        verifyClaim({
          branch: 'other-branch',
          claimRoot,
          id: '71',
          kind: 'pr',
          now: at('2026-06-27T10:00:10.000Z'),
          token: 'secret-a',
        }),
      { codeName: 'BRANCH_MISMATCH' },
    )

    await assert.rejects(
      () =>
        verifyClaim({
          branch: 'issue-59-trail-render-frame-debug-state',
          claimRoot,
          id: '71',
          kind: 'pr',
          now: at('2026-06-27T10:00:10.000Z'),
          token: 'wrong',
        }),
      { codeName: 'TOKEN_MISMATCH' },
    )

    const heartbeat = await heartbeatClaim({
      branch: 'issue-59-trail-render-frame-debug-state',
      claimRoot,
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:00:30.000Z'),
      token: 'secret-a',
    })

    assert.equal(heartbeat.status, 'heartbeat')
    assert.equal(heartbeat.claim.last_seen, '2026-06-27T10:00:30.000Z')

    const verified = await verifyClaim({
      branch: 'issue-59-trail-render-frame-debug-state',
      claimRoot,
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:01:20.000Z'),
      token: 'secret-a',
    })

    assert.equal(verified.status, 'verified')
  })

  it('replaces an expired claim when no local pid is live', async () => {
    await acquireClaim({
      claimRoot,
      id: '59',
      kind: 'issue',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 1,
    })

    const replacement = await acquireClaim({
      claimRoot,
      id: '59',
      kind: 'issue',
      now: at('2026-06-27T10:00:02.000Z'),
      owner: 'worker-b',
      pid: null,
      token: 'secret-b',
      ttlSeconds: 60,
    })

    assert.equal(replacement.status, 'acquired')
    assert.equal(replacement.replaced, true)
    assert.match(replacement.replace_reason, /expired/)
    assert.equal(replacement.claim.owner, 'worker-b')
  })

  it('fails closed when an existing claim has an unknown status', async () => {
    await acquireClaim({
      claimRoot,
      id: '60',
      kind: 'issue',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 1,
    })

    const claimPath = path.join(claimRoot, 'issue-60.json')
    const record = JSON.parse(await readFile(claimPath, 'utf8'))
    record.status = 'paused'
    await writeFile(claimPath, `${JSON.stringify(record, null, 2)}\n`)

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          id: '60',
          kind: 'issue',
          now: at('2026-06-27T10:00:02.000Z'),
          owner: 'worker-b',
          pid: null,
          token: 'secret-b',
          ttlSeconds: 60,
        }),
      { codeName: 'CLAIM_UNCERTAIN' },
    )
  })

  it('does not replace an expired claim while the recorded local pid is live', async () => {
    await acquireClaim({
      claimRoot,
      id: '72',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: process.pid,
      token: 'secret-a',
      ttlSeconds: 1,
    })

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          id: '72',
          kind: 'pr',
          now: at('2026-06-27T10:00:02.000Z'),
          owner: 'worker-b',
          pid: null,
          token: 'secret-b',
          ttlSeconds: 60,
        }),
      { codeName: 'CLAIM_PID_LIVE' },
    )
  })

  it('releases a claim with the matching token so the task can be acquired again', async () => {
    await acquireClaim({
      claimRoot,
      id: '73',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    const release = await releaseClaim({
      claimRoot,
      id: '73',
      kind: 'pr',
      now: at('2026-06-27T10:00:20.000Z'),
      token: 'secret-a',
    })

    assert.equal(release.status, 'released')

    const reacquire = await acquireClaim({
      claimRoot,
      id: '73',
      kind: 'pr',
      now: at('2026-06-27T10:00:30.000Z'),
      owner: 'worker-b',
      pid: null,
      token: 'secret-b',
      ttlSeconds: 60,
    })

    assert.equal(reacquire.status, 'acquired')
    assert.equal(reacquire.claim.owner, 'worker-b')
  })

  it('recovers a stale write mutex when the recorded local pid is dead', async () => {
    const mutexDir = path.join(claimRoot, '.mutexes', 'claims.lock')
    await mkdir(mutexDir, { recursive: true })
    await writeFile(
      path.join(mutexDir, 'owner.json'),
      `${JSON.stringify({
        hostname: hostname(),
        pid: 99999999,
        started_at: '2026-06-27T09:00:00.000Z',
      })}\n`,
    )

    const result = await acquireClaim({
      claimRoot,
      id: '74',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    assert.equal(result.status, 'acquired')
  })

  it('does not publish a claim when writing the token file fails', async () => {
    const blockedParent = path.join(claimRoot, 'blocked-parent')
    await writeFile(blockedParent, 'not a directory')

    await assert.rejects(() =>
      acquireClaim({
        claimRoot,
        id: '75',
        kind: 'pr',
        now: at('2026-06-27T10:00:00.000Z'),
        owner: 'worker-a',
        pid: null,
        tokenFile: path.join(blockedParent, 'token'),
        ttlSeconds: 60,
      }),
    )

    await assert.rejects(
      () =>
        verifyClaim({
          claimRoot,
          id: '75',
          kind: 'pr',
          now: at('2026-06-27T10:00:10.000Z'),
          token: 'secret-a',
        }),
      { codeName: 'CLAIM_MISSING' },
    )
  })

  it('rejects unknown CLI flags', async () => {
    await assert.rejects(
      () =>
        runCli([
          'node',
          'automationTaskClaim.mjs',
          'acquire',
          '--kind',
          'pr',
          '--id',
          '76',
          '--brnach',
          'typo',
          '--token',
          'secret-a',
        ]),
      { codeName: 'USAGE' },
    )
  })

  it('redacts the raw token from CLI acquire output unless explicitly requested', async () => {
    const tokenFile = path.join(claimRoot, 'claim-token')
    const result = await runCli([
      'node',
      'automationTaskClaim.mjs',
      'acquire',
      '--kind',
      'pr',
      '--id',
      '77',
      '--root',
      claimRoot,
      '--token-file',
      tokenFile,
    ])

    assert.equal(result.status, 'acquired')
    assert.equal(result.token, undefined)
    assert.equal(result.token_file, tokenFile)
    assert.equal(result.token_redacted, true)
    assert.match(await readFile(tokenFile, 'utf8'), /\S/)
  })
})

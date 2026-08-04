import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises'
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
    assert.equal(
      record.token_hash,
      `sha256:${createHash('sha256').update('secret-a').digest('hex')}`,
    )
    assert.equal(Object.hasOwn(record, 'token'), false)
  })

  it('acquires a claim with validated automation registration metadata', async () => {
    const codexHome = path.join(claimRoot, 'codex-home')
    const tokenFile = path.join(
      codexHome,
      'automations',
      'review-automation',
      'tokens',
      'pr-71.token',
    )
    const purpose = `automation_id=review-automation;token_file=${tokenFile};scope=explicit_request;reason=review follow-up`

    const result = await acquireClaim({
      claimRoot,
      env: { CODEX_HOME: codexHome },
      id: '71',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      purpose,
      tokenFile,
      ttlSeconds: 60,
    })

    assert.equal(result.claim.purpose, purpose)
    assert.equal((await readFile(tokenFile, 'utf8')).trim(), result.token)
  })

  it('rejects malformed or mismatched automation registration metadata', async () => {
    const codexHome = path.join(claimRoot, 'codex-home')
    const tokenFile = path.join(
      codexHome,
      'automations',
      'review-automation',
      'tokens',
      'pr-72.token',
    )

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          env: { CODEX_HOME: codexHome },
          id: '72',
          kind: 'pr',
          pid: null,
          purpose: 'review follow-up',
          tokenFile,
        }),
      { codeName: 'USAGE' },
    )

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          env: { CODEX_HOME: codexHome },
          id: '73',
          kind: 'pr',
          pid: null,
          purpose: `automation_id=review-automation;token_file=${tokenFile};scope=explicit_request`,
          token: 'secret-a',
        }),
      { codeName: 'USAGE' },
    )

    const wrongAutomationTokenFile = path.join(
      codexHome,
      'automations',
      'other-automation',
      'tokens',
      'pr-74.token',
    )
    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          env: { CODEX_HOME: codexHome },
          id: '74',
          kind: 'pr',
          pid: null,
          purpose: `automation_id=review-automation;token_file=${wrongAutomationTokenFile};scope=explicit_request`,
          tokenFile: wrongAutomationTokenFile,
        }),
      { codeName: 'USAGE' },
    )

    await assert.rejects(() => readFile(tokenFile, 'utf8'), { code: 'ENOENT' })
    for (const id of ['72', '73', '74']) {
      await assert.rejects(
        () => readFile(path.join(claimRoot, `pr-${id}.json`), 'utf8'),
        { code: 'ENOENT' },
      )
    }
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

  it('fails closed when stored ttl metadata is not a strict integer', async () => {
    await acquireClaim({
      claimRoot,
      id: '61',
      kind: 'issue',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    const claimPath = path.join(claimRoot, 'issue-61.json')
    const record = JSON.parse(await readFile(claimPath, 'utf8'))
    record.ttl_seconds = '60junk'
    await writeFile(claimPath, `${JSON.stringify(record, null, 2)}\n`)

    await assert.rejects(
      () =>
        verifyClaim({
          claimRoot,
          id: '61',
          kind: 'issue',
          now: at('2026-06-27T10:00:10.000Z'),
          token: 'secret-a',
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

  it('does not replace an expired claim when stored pid metadata is not a strict integer', async () => {
    await acquireClaim({
      claimRoot,
      id: '72',
      kind: 'pr',
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 1,
    })

    const claimPath = path.join(claimRoot, 'pr-72.json')
    const record = JSON.parse(await readFile(claimPath, 'utf8'))
    record.hostname = hostname()
    record.pid = '99999999junk'
    await writeFile(claimPath, `${JSON.stringify(record, null, 2)}\n`)

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
      { codeName: 'CLAIM_UNCERTAIN' },
    )
  })

  it('releases a branch-scoped claim so another task can use the same branch', async () => {
    await acquireClaim({
      branch: 'issue-73-automation-claim',
      claimRoot,
      id: '73',
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
          branch: 'issue-73-automation-claim',
          claimRoot,
          id: '74',
          kind: 'issue',
          now: at('2026-06-27T10:00:10.000Z'),
          owner: 'worker-b',
          pid: null,
          token: 'secret-b',
          ttlSeconds: 60,
        }),
      { codeName: 'BRANCH_CLAIM_ACTIVE' },
    )

    const release = await releaseClaim({
      branch: 'issue-73-automation-claim',
      claimRoot,
      id: '73',
      kind: 'pr',
      now: at('2026-06-27T10:00:20.000Z'),
      token: 'secret-a',
    })

    assert.equal(release.status, 'released')

    const reacquire = await acquireClaim({
      branch: 'issue-73-automation-claim',
      claimRoot,
      id: '74',
      kind: 'issue',
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

  it('recovers an ownerless stale write mutex after the mutex timeout', async () => {
    const mutexDir = path.join(claimRoot, '.mutexes', 'claims.lock')
    const mutexTimeoutMs = 1
    const staleMutexTime = new Date(Date.now() - mutexTimeoutMs - 1_000)
    await mkdir(mutexDir, { recursive: true })
    await utimes(mutexDir, staleMutexTime, staleMutexTime)

    const result = await acquireClaim({
      claimRoot,
      id: '74',
      kind: 'pr',
      mutexTimeoutMs,
      now: at('2026-06-27T10:00:00.000Z'),
      owner: 'worker-a',
      pid: null,
      token: 'secret-a',
      ttlSeconds: 60,
    })

    assert.equal(result.status, 'acquired')
  })

  it('does not reclaim a stale write mutex from a different host', async () => {
    const mutexDir = path.join(claimRoot, '.mutexes', 'claims.lock')
    await mkdir(mutexDir, { recursive: true })
    await writeFile(
      path.join(mutexDir, 'owner.json'),
      `${JSON.stringify({
        hostname: 'other-host.example',
        pid: 99999999,
        started_at: '2026-06-27T09:00:00.000Z',
      })}\n`,
    )

    await assert.rejects(
      () =>
        acquireClaim({
          claimRoot,
          id: '74',
          kind: 'pr',
          mutexTimeoutMs: 1,
          now: at('2026-06-27T10:00:00.000Z'),
          owner: 'worker-a',
          pid: null,
          token: 'secret-a',
          ttlSeconds: 60,
        }),
      { codeName: 'MUTEX_BUSY' },
    )
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

    const token = (await readFile(tokenFile, 'utf8')).trim()
    assert.match(token, /\S/)

    const verified = await verifyClaim({
      claimRoot,
      id: '77',
      kind: 'pr',
      now: at('2026-06-27T10:00:10.000Z'),
      token,
    })
    assert.equal(verified.status, 'verified')
  })
})

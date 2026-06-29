import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestReachMoonRunReceipt } from '@/runtime/highLevelActions/reachMoonRunReceiptRequest'
import type { ReachMoonRunReceipt } from '@/server/reachMoonRunReceipts'

const runReceipt: ReachMoonRunReceipt = {
  issuedAt: '2026-06-29T07:00:00.000Z',
  runId: 'run-116',
  scenarioId: 'reach-moon',
  signature: 'signature',
}

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn(async () => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('requestReachMoonRunReceipt', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a valid run receipt response', async () => {
    const fetchMock = stubFetch(Response.json({ runReceipt }, { status: 201 }))

    await expect(requestReachMoonRunReceipt()).resolves.toEqual(runReceipt)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reach-moon/run-receipt',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('throws the typed server error message when one is available', async () => {
    stubFetch(
      Response.json(
        {
          error: {
            code: 'missing_receipt_secret',
            message: 'REACH_MOON_RUN_RECEIPT_SECRET is required.',
          },
        },
        { status: 500 },
      ),
    )

    await expect(requestReachMoonRunReceipt()).rejects.toThrow(
      'REACH_MOON_RUN_RECEIPT_SECRET is required.',
    )
  })

  it('falls back to the status error when the typed server message is missing', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'missing_receipt_secret' } },
        { status: 500 },
      ),
    )

    await expect(requestReachMoonRunReceipt()).rejects.toThrow(
      'Run receipt request failed (500).',
    )
  })

  it('rejects malformed success responses', async () => {
    stubFetch(Response.json({ runReceipt: {} }, { status: 201 }))

    await expect(requestReachMoonRunReceipt()).rejects.toThrow(
      'Run receipt response was invalid.',
    )
  })
})

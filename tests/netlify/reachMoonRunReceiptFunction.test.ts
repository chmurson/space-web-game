import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler, { config } from '../../netlify/functions/reach-moon-run-receipt'
import {
  type ReachMoonRunReceipt,
  validateReachMoonRunReceipt,
} from '../../src/server/reachMoonRunReceipts'

const secret = 'test-run-receipt-secret-with-32-bytes-minimum'
const now = '2026-06-29T07:30:00.000Z'

const readJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T

describe('reachMoonRunReceipt function', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', secret)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('exposes a rate-limited API path for issuing run receipts', () => {
    expect(config).toMatchObject({
      path: [
        '/api/reach-moon/run-receipt',
        '/.netlify/functions/reach-moon-run-receipt',
      ],
      rateLimit: {
        aggregateBy: ['ip', 'domain'],
        windowLimit: 60,
        windowSize: 60,
      },
    })
  })

  it('issues a valid Reach the Moon run receipt', async () => {
    const response = await handler(
      new Request('https://example.test/api/reach-moon/run-receipt', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await readJson<{ runReceipt: ReachMoonRunReceipt }>(response)

    expect(body.runReceipt).toMatchObject({
      issuedAt: now,
      scenarioId: 'reach-moon',
    })
    expect(body.runReceipt.runId).not.toHaveLength(0)
    expect(body.runReceipt.signature).not.toHaveLength(0)
    await expect(
      validateReachMoonRunReceipt(body.runReceipt, {
        now,
        secret,
      }),
    ).resolves.toEqual({
      ok: true,
      value: body.runReceipt,
    })
  })

  it('rejects unsupported methods with Allow metadata', async () => {
    const response = await handler(
      new Request('https://example.test/api/reach-moon/run-receipt'),
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: 'method_not_allowed' },
    })
  })

  it('returns typed errors when the receipt secret is missing or invalid', async () => {
    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', '')

    const missingResponse = await handler(
      new Request('https://example.test/api/reach-moon/run-receipt', {
        method: 'POST',
      }),
    )

    expect(missingResponse.status).toBe(500)
    await expect(readJson(missingResponse)).resolves.toMatchObject({
      error: { code: 'missing_receipt_secret' },
    })

    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', 'short')

    const invalidResponse = await handler(
      new Request('https://example.test/api/reach-moon/run-receipt', {
        method: 'POST',
      }),
    )

    expect(invalidResponse.status).toBe(500)
    await expect(readJson(invalidResponse)).resolves.toMatchObject({
      error: { code: 'invalid_receipt_secret' },
    })
  })
})

import { describe, expect, it } from 'vitest'

import {
  createReachMoonRunReceipt,
  REACH_MOON_RUN_RECEIPT_SCENARIO_ID,
  REACH_MOON_RUN_RECEIPT_TTL_MS,
  validateReachMoonHighscoreSubmissionReceipt,
  validateReachMoonRunReceipt,
} from '@/server/reachMoonRunReceipts'

const secret = 'test-run-receipt-secret-with-32-bytes-minimum'
const issuedAt = '2026-06-28T20:00:00.000Z'

const expectReceiptError = (
  result: Awaited<ReturnType<typeof validateReachMoonRunReceipt>>,
  code:
    | 'expired_receipt'
    | 'invalid_receipt'
    | 'invalid_signature'
    | 'missing_receipt'
    | 'wrong_scenario',
) => {
  expect(result).toMatchObject({
    errors: [{ code, field: 'runReceipt' }],
    ok: false,
  })
}

describe('reachMoonRunReceipts', () => {
  it('creates and validates a Reach the Moon run receipt', async () => {
    const receipt = await createReachMoonRunReceipt({
      issuedAt,
      secret,
    })

    expect(receipt).toEqual({
      issuedAt,
      runId: expect.any(String),
      scenarioId: REACH_MOON_RUN_RECEIPT_SCENARIO_ID,
      signature: expect.any(String),
    })
    expect(receipt.runId).not.toHaveLength(0)
    expect(receipt.signature).not.toHaveLength(0)

    const result = await validateReachMoonHighscoreSubmissionReceipt(
      {
        fuelRemainingRatio: 0.5,
        missionElapsedSeconds: 90_000,
        runReceipt: receipt,
      },
      {
        now: '2026-06-28T21:00:00.000Z',
        secret,
      },
    )

    expect(result).toEqual({
      ok: true,
      value: receipt,
    })
  })

  it('rejects submissions missing a run receipt', async () => {
    const result = await validateReachMoonHighscoreSubmissionReceipt(
      {
        fuelRemainingRatio: 0.5,
        missionElapsedSeconds: 90_000,
      },
      {
        now: issuedAt,
        secret,
      },
    )

    expectReceiptError(result, 'missing_receipt')
  })

  it('rejects expired run receipts', async () => {
    const receipt = await createReachMoonRunReceipt({
      issuedAt,
      secret,
    })

    const result = await validateReachMoonRunReceipt(receipt, {
      now: new Date(Date.parse(issuedAt) + REACH_MOON_RUN_RECEIPT_TTL_MS + 1),
      secret,
    })

    expectReceiptError(result, 'expired_receipt')
  })

  it('rejects run receipts for the wrong scenario', async () => {
    const receipt = await createReachMoonRunReceipt({
      issuedAt,
      secret,
    })

    const result = await validateReachMoonRunReceipt(
      {
        ...receipt,
        scenarioId: 'tutorial',
      },
      {
        now: issuedAt,
        secret,
      },
    )

    expectReceiptError(result, 'wrong_scenario')
  })

  it('rejects run receipts with invalid signatures', async () => {
    const receipt = await createReachMoonRunReceipt({
      issuedAt,
      secret,
    })
    const replacementPrefix = receipt.signature.startsWith('x') ? 'y' : 'x'

    const result = await validateReachMoonRunReceipt(
      {
        ...receipt,
        signature: `${replacementPrefix}${receipt.signature.slice(1)}`,
      },
      {
        now: issuedAt,
        secret,
      },
    )

    expectReceiptError(result, 'invalid_signature')
  })

  it('rejects trivial receipt secrets before signing', async () => {
    await expect(
      createReachMoonRunReceipt({
        issuedAt,
        secret: 'short-secret',
      }),
    ).rejects.toThrow('at least 32 bytes')
  })
})

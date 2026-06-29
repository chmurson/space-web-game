import {
  createReachMoonHighscoreRecord,
  reachMoonHighscorePeriods,
} from '../../../src/scenario/specific-scenarios/reachMoonHighscores'
import { validateReachMoonHighscoreSubmissionReceipt } from '../../../src/server/reachMoonRunReceipts'
import { createErrorResponse, createJsonResponse } from './responses'
import {
  getHighscoreStore,
  getRecordKey,
  readRecord,
  updateRollups,
} from './storage'
import {
  getEnvValue,
  getRequestedPeriods,
  readJsonBody,
  receiptSecretEnvName,
} from './validation'

export const handlePost = async (
  request: Request,
  now: Date,
): Promise<Response> => {
  const periodSelection = getRequestedPeriods(request)
  if (!periodSelection.ok) {
    return createErrorResponse(
      400,
      'invalid_period',
      'Unsupported highscore period.',
      { supportedPeriods: reachMoonHighscorePeriods },
    )
  }

  const receiptSecret = getEnvValue(receiptSecretEnvName)
  if (!receiptSecret) {
    return createErrorResponse(
      500,
      'missing_receipt_secret',
      `${receiptSecretEnvName} is required before highscore submissions can be accepted.`,
    )
  }

  const body = await readJsonBody(request)
  if (!body.ok) {
    return createErrorResponse(body.status, body.code, body.message)
  }

  const receipt = await validateReachMoonHighscoreSubmissionReceipt(
    body.value,
    {
      now,
      secret: receiptSecret,
    },
  ).catch((error: unknown) => {
    if (error instanceof RangeError) {
      return createErrorResponse(
        500,
        'invalid_receipt_secret',
        `${receiptSecretEnvName} is invalid.`,
      )
    }

    throw error
  })
  if (receipt instanceof Response) {
    return receipt
  }
  if (!receipt.ok) {
    return createErrorResponse(
      401,
      'invalid_receipt',
      'Run receipt is invalid.',
      receipt.errors,
    )
  }

  const runId = receipt.value.runId
  const record = createReachMoonHighscoreRecord(body.value, {
    id: runId,
    submittedAt: now,
  })
  if (!record.ok) {
    return createErrorResponse(
      422,
      'invalid_highscore',
      'Submitted highscore input is invalid.',
      record.errors,
    )
  }

  try {
    const store = getHighscoreStore()
    const recordKey = getRecordKey(runId)
    const recordWrite = await store.setJSON(recordKey, record.value, {
      onlyIfNew: true,
    })
    const storedRecord = recordWrite.modified
      ? record.value
      : await readRecord(store, recordKey)

    if (storedRecord == null) {
      return createErrorResponse(
        503,
        'storage_error',
        'Highscore record could not be written or read.',
      )
    }

    return createJsonResponse({
      record: storedRecord,
      ...(await updateRollups(store, storedRecord, now)),
    })
  } catch {
    return createErrorResponse(
      503,
      'storage_error',
      'Highscore storage is unavailable.',
    )
  }
}

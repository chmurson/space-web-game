import {
  createReachMoonHighscoreRecord,
  type ReachMoonHighscoreRecord,
  reachMoonHighscorePeriods,
} from '../../../src/scenario/specific-scenarios/reachMoonHighscores'
import {
  MOON_ORBIT_BONUS_MAX_POINTS,
  REACH_MOON_BASE_SCORE_POINTS,
  REACH_MOON_FUEL_CAPACITY_KG,
  REACH_MOON_MAX_FUEL_BONUS_POINTS,
  REACH_MOON_MAX_TIME_SCORE_POINTS,
} from '../../../src/scenario/specific-scenarios/reachMoonScore'
import { validateReachMoonHighscoreSubmissionReceipt } from '../../../src/server/reachMoonRunReceipts'
import { createErrorResponse, createJsonResponse } from './responses'
import {
  getHighscoreStore,
  getRecordKey,
  readRecord,
  toPublicHighscoreRecord,
  updateRollups,
} from './storage'
import type {
  PeriodRollups,
  ReachMoonHighscoreAuditFlag,
  ReachMoonHighscoreAuditMetadata,
  StoredReachMoonHighscoreRecord,
} from './types'
import {
  getEnvValue,
  getRequestedPeriods,
  readJsonBody,
  receiptSecretEnvName,
} from './validation'

const minReceiptElapsedMs = 15_000
const minMissionElapsedSeconds = 300
const maxFuelRemainingRatio = 0.999
const minTotalScore = 0
const maxTotalScore =
  REACH_MOON_BASE_SCORE_POINTS +
  REACH_MOON_MAX_FUEL_BONUS_POINTS +
  REACH_MOON_MAX_TIME_SCORE_POINTS +
  MOON_ORBIT_BONUS_MAX_POINTS
const scoreTolerance = 0.001
const suspiciousMissionElapsedSeconds = 86_400
const suspiciousFuelRemainingRatio = 0.95
const suspiciousTotalScore = 295

type RejectionDetail = {
  code:
    | 'fuel_remaining_too_high'
    | 'mission_elapsed_too_low'
    | 'receipt_too_recent'
    | 'score_out_of_range'
  field: 'fuelRemainingRatio' | 'missionElapsedSeconds' | 'runReceipt' | 'score'
  message: string
  threshold: number
  value: number
}

const getFuelRemainingRatio = (record: ReachMoonHighscoreRecord): number =>
  REACH_MOON_FUEL_CAPACITY_KG > 0
    ? record.score.fuelRemainingKg / REACH_MOON_FUEL_CAPACITY_KG
    : 0

const getReceiptTimingRejection = (
  issuedAt: string,
  now: Date,
): RejectionDetail | null => {
  const elapsedMs = now.getTime() - Date.parse(issuedAt)

  return elapsedMs < minReceiptElapsedMs
    ? {
        code: 'receipt_too_recent',
        field: 'runReceipt',
        message: 'Run receipt is too recent for highscore submission.',
        threshold: minReceiptElapsedMs,
        value: elapsedMs,
      }
    : null
}

const getPlausibilityRejections = (
  record: ReachMoonHighscoreRecord,
): RejectionDetail[] => {
  const rejections: RejectionDetail[] = []
  const fuelRemainingRatio = getFuelRemainingRatio(record)

  if (record.score.missionElapsedSeconds < minMissionElapsedSeconds) {
    rejections.push({
      code: 'mission_elapsed_too_low',
      field: 'missionElapsedSeconds',
      message: 'Mission elapsed time is too low for a completed mission.',
      threshold: minMissionElapsedSeconds,
      value: record.score.missionElapsedSeconds,
    })
  }

  if (fuelRemainingRatio > maxFuelRemainingRatio) {
    rejections.push({
      code: 'fuel_remaining_too_high',
      field: 'fuelRemainingRatio',
      message: 'Fuel remaining is too high for a completed mission.',
      threshold: maxFuelRemainingRatio,
      value: fuelRemainingRatio,
    })
  }

  if (
    record.score.totalScore < minTotalScore - scoreTolerance ||
    record.score.totalScore > maxTotalScore + scoreTolerance
  ) {
    rejections.push({
      code: 'score_out_of_range',
      field: 'score',
      message: 'Recomputed score is outside the supported score range.',
      threshold: maxTotalScore,
      value: record.score.totalScore,
    })
  }

  return rejections
}

const getSuspiciousFlags = (
  record: ReachMoonHighscoreRecord,
): ReachMoonHighscoreAuditFlag[] => {
  const flags: ReachMoonHighscoreAuditFlag[] = []
  const fuelRemainingRatio = getFuelRemainingRatio(record)

  if (record.score.missionElapsedSeconds < suspiciousMissionElapsedSeconds) {
    flags.push('unusually_short_mission')
  }
  if (fuelRemainingRatio >= suspiciousFuelRemainingRatio) {
    flags.push('unusually_high_fuel_remaining')
  }
  if (record.score.totalScore >= suspiciousTotalScore) {
    flags.push('near_max_score')
  }

  return flags
}

const createStoredRecord = (
  record: ReachMoonHighscoreRecord,
  checkedAt: Date,
): StoredReachMoonHighscoreRecord => {
  const flags = getSuspiciousFlags(record)
  if (flags.length === 0) {
    return record
  }

  const audit: ReachMoonHighscoreAuditMetadata = {
    checkedAt: checkedAt.toISOString(),
    flags,
    version: 1,
  }

  return { ...record, audit }
}

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
  const receiptTimingRejection = getReceiptTimingRejection(
    receipt.value.issuedAt,
    now,
  )
  if (receiptTimingRejection != null) {
    return createErrorResponse(
      401,
      'invalid_receipt',
      'Run receipt is too recent for highscore submission.',
      [receiptTimingRejection],
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
  const plausibilityRejections = getPlausibilityRejections(record.value)
  if (plausibilityRejections.length > 0) {
    return createErrorResponse(
      422,
      'invalid_highscore',
      'Submitted highscore is outside the Reach the Moon plausibility envelope.',
      plausibilityRejections,
    )
  }
  const recordToWrite = createStoredRecord(record.value, now)

  try {
    const store = getHighscoreStore()
    const recordKey = getRecordKey(runId)
    const recordWrite = await store.setJSON(recordKey, recordToWrite, {
      onlyIfNew: true,
    })
    const storedRecord = recordWrite.modified
      ? recordToWrite
      : await readRecord(store, recordKey)

    if (storedRecord == null) {
      return createErrorResponse(
        503,
        'storage_error',
        'Highscore record could not be written or read.',
      )
    }

    const leaderboard = await updateRollups(store, storedRecord, now)

    const rollups: PeriodRollups = {}
    for (const period of periodSelection.periods) {
      rollups[period] = leaderboard.rollups[period]
    }

    return createJsonResponse({
      record: toPublicHighscoreRecord(storedRecord),
      rollups,
    })
  } catch {
    return createErrorResponse(
      503,
      'storage_error',
      'Highscore storage is unavailable.',
    )
  }
}

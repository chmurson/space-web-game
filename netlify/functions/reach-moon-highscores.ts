import { getStore } from '@netlify/blobs'

import {
  createReachMoonHighscoreRecord,
  createReachMoonHighscoreRollup,
  parseReachMoonHighscorePeriod,
  type ReachMoonHighscorePeriod,
  type ReachMoonHighscoreRecord,
  type ReachMoonHighscoreRollup,
  reachMoonHighscorePeriods,
} from '../../src/scenario/specific-scenarios/reachMoonHighscores'
import { validateReachMoonHighscoreSubmissionReceipt } from '../../src/server/reachMoonRunReceipts'

const storeName = 'reach-moon-highscores'
const receiptSecretEnvName = 'REACH_MOON_RUN_RECEIPT_SECRET'
const maxRollupEntries = 10
const millisecondsPerDay = 86_400_000

export const config = {
  path: [
    '/api/reach-moon/highscores',
    '/.netlify/functions/reach-moon-highscores',
  ],
  rateLimit: {
    aggregateBy: ['ip', 'domain'],
    windowLimit: 120,
    windowSize: 60,
  },
}

type HighscoreBlobStore = {
  get(key: string, options: { type: 'json' }): Promise<unknown | null>
  setJSON(
    key: string,
    data: unknown,
    options?: { onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>
}

type PeriodRollups = Partial<
  Record<ReachMoonHighscorePeriod, ReachMoonHighscoreRollup>
>

type ApiErrorCode =
  | 'invalid_highscore'
  | 'invalid_json'
  | 'invalid_period'
  | 'invalid_receipt_secret'
  | 'invalid_receipt'
  | 'method_not_allowed'
  | 'missing_body'
  | 'missing_receipt_secret'
  | 'storage_error'

type ApiErrorResponse = {
  error: {
    code: ApiErrorCode
    details?: unknown
    message: string
  }
}

type LeaderboardResponse = {
  rollups: PeriodRollups
}

type SubmitResponse = LeaderboardResponse & {
  record: ReachMoonHighscoreRecord
}

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { code: ApiErrorCode; message: string; ok: false; status: number }

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

const listCacheHeaders = {
  'cache-control': 'public, max-age=30, stale-while-revalidate=120',
  ...jsonHeaders,
}

const mutationHeaders = {
  'cache-control': 'no-store',
  ...jsonHeaders,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const getEnvValue = (name: string): string | undefined =>
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process?.env?.[name]

const getHighscoreStore = (): HighscoreBlobStore =>
  getStore(storeName) as HighscoreBlobStore

const createErrorResponse = (
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): Response =>
  new Response(
    JSON.stringify({
      error: {
        code,
        ...(details === undefined ? {} : { details }),
        message,
      },
    } satisfies ApiErrorResponse),
    {
      headers: mutationHeaders,
      status,
    },
  )

const createJsonResponse = (
  body: LeaderboardResponse | SubmitResponse,
  options: { cacheable?: boolean; status?: number } = {},
): Response =>
  new Response(JSON.stringify(body), {
    headers: options.cacheable ? listCacheHeaders : mutationHeaders,
    status: options.status ?? 200,
  })

const createRecordId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const toUtcDateKey = (date: Date): string => date.toISOString().slice(0, 10)

const getIsoWeekKey = (date: Date): string => {
  const thursday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = thursday.getUTCDay() || 7
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day)

  const weekYear = thursday.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / millisecondsPerDay + 1) / 7,
  )

  return `${weekYear}-W${String(week).padStart(2, '0')}`
}

const getRollupKey = (period: ReachMoonHighscorePeriod, date: Date): string => {
  if (period === 'daily') {
    return `rollups/daily/${toUtcDateKey(date)}.json`
  }
  if (period === 'weekly') {
    return `rollups/weekly/${getIsoWeekKey(date)}.json`
  }

  return 'rollups/all-time.json'
}

const getRecordKey = (record: ReachMoonHighscoreRecord): string =>
  `records/${record.submittedAt.slice(0, 10)}/${record.id}.json`

const stripRanks = (
  rollup: ReachMoonHighscoreRollup,
): ReachMoonHighscoreRecord[] =>
  rollup.entries.map(({ rank: _rank, ...record }) => record)

const createTopTenRollup = (
  period: ReachMoonHighscorePeriod,
  records: readonly ReachMoonHighscoreRecord[],
  now: Date,
): ReachMoonHighscoreRollup => {
  const rollup = createReachMoonHighscoreRollup(period, records, now)

  return {
    ...rollup,
    entries: rollup.entries.slice(0, maxRollupEntries),
  }
}

const isHighscoreRollup = (
  value: unknown,
  period: ReachMoonHighscorePeriod,
): value is ReachMoonHighscoreRollup =>
  isRecord(value) &&
  value.period === period &&
  typeof value.generatedAt === 'string' &&
  Array.isArray(value.entries)

const readRollup = async (
  store: HighscoreBlobStore,
  period: ReachMoonHighscorePeriod,
  date: Date,
): Promise<ReachMoonHighscoreRollup> => {
  const key = getRollupKey(period, date)
  const storedRollup = await store.get(key, { type: 'json' })

  return isHighscoreRollup(storedRollup, period)
    ? storedRollup
    : createTopTenRollup(period, [], date)
}

const getRequestedPeriods = (
  request: Request,
): { ok: true; periods: ReachMoonHighscorePeriod[] } | { ok: false } => {
  const requestedPeriod = new URL(request.url).searchParams.get('period')
  if (requestedPeriod == null || requestedPeriod.length === 0) {
    return { ok: true, periods: [...reachMoonHighscorePeriods] }
  }

  const parsed = parseReachMoonHighscorePeriod(requestedPeriod)
  return parsed == null ? { ok: false } : { ok: true, periods: [parsed] }
}

const readJsonBody = async (request: Request): Promise<JsonBodyResult> => {
  const body = await request.text()
  if (body.trim().length === 0) {
    return {
      code: 'missing_body',
      message: 'POST body must be a JSON object.',
      ok: false,
      status: 400,
    }
  }

  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return {
      code: 'invalid_json',
      message: 'POST body must be valid JSON.',
      ok: false,
      status: 400,
    }
  }
}

const buildLeaderboardResponse = async (
  store: HighscoreBlobStore,
  periods: readonly ReachMoonHighscorePeriod[],
  now: Date,
): Promise<LeaderboardResponse> => {
  const rollups: PeriodRollups = {}

  for (const period of periods) {
    rollups[period] = await readRollup(store, period, now)
  }

  return { rollups }
}

const updateRollups = async (
  store: HighscoreBlobStore,
  record: ReachMoonHighscoreRecord,
  now: Date,
): Promise<LeaderboardResponse> => {
  const recordDate = new Date(record.submittedAt)
  const rollups: PeriodRollups = {}

  for (const period of reachMoonHighscorePeriods) {
    const key = getRollupKey(period, recordDate)
    const currentRollup = await readRollup(store, period, recordDate)
    const nextRollup = createTopTenRollup(
      period,
      [...stripRanks(currentRollup), record],
      now,
    )

    await store.setJSON(key, nextRollup)
    rollups[period] = nextRollup
  }

  return { rollups }
}

const handleGet = async (request: Request, now: Date): Promise<Response> => {
  const periodSelection = getRequestedPeriods(request)
  if (!periodSelection.ok) {
    return createErrorResponse(
      400,
      'invalid_period',
      'Unsupported highscore period.',
      { supportedPeriods: reachMoonHighscorePeriods },
    )
  }

  try {
    return createJsonResponse(
      await buildLeaderboardResponse(
        getHighscoreStore(),
        periodSelection.periods,
        now,
      ),
      { cacheable: true },
    )
  } catch {
    return createErrorResponse(
      503,
      'storage_error',
      'Highscore storage is unavailable.',
    )
  }
}

const handlePost = async (request: Request, now: Date): Promise<Response> => {
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

  const record = createReachMoonHighscoreRecord(body.value, {
    id: createRecordId(),
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
    const recordWrite = await store.setJSON(
      getRecordKey(record.value),
      record.value,
      {
        onlyIfNew: true,
      },
    )
    if (!recordWrite.modified) {
      return createErrorResponse(
        503,
        'storage_error',
        'Highscore record could not be written.',
      )
    }

    return createJsonResponse({
      record: record.value,
      ...(await updateRollups(store, record.value, now)),
    })
  } catch {
    return createErrorResponse(
      503,
      'storage_error',
      'Highscore storage is unavailable.',
    )
  }
}

export default async function handler(request: Request): Promise<Response> {
  const now = new Date()

  if (request.method === 'GET') {
    return handleGet(request, now)
  }
  if (request.method === 'POST') {
    return handlePost(request, now)
  }

  return createErrorResponse(
    405,
    'method_not_allowed',
    'Use GET to read highscores or POST to submit one.',
  )
}

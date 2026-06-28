import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler, { config } from '../../netlify/functions/reach-moon-highscores'
import {
  createReachMoonHighscoreRollup,
  type ReachMoonHighscorePeriod,
  type ReachMoonHighscoreRecord,
} from '../../src/scenario/specific-scenarios/reachMoonHighscores'
import { createReachMoonRunReceipt } from '../../src/server/reachMoonRunReceipts'

type StoredValue = {
  data: unknown
  etag: string
}

const blobMocks = vi.hoisted(() => ({
  getStore: vi.fn(),
}))

vi.mock('@netlify/blobs', () => ({
  getStore: blobMocks.getStore,
}))

const secret = 'test-run-receipt-secret-with-32-bytes-minimum'
const now = '2026-06-28T20:30:00.000Z'

const createStore = () => {
  const values = new Map<string, StoredValue>()
  let etagId = 0

  return {
    get: vi.fn(async (key: string) => {
      const value = values.get(key)?.data

      return value == null ? null : structuredClone(value)
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const value = values.get(key)

      return value == null
        ? null
        : {
            data: structuredClone(value.data),
            etag: value.etag,
          }
    }),
    list: vi.fn((options: { paginate?: boolean; prefix?: string } = {}) => {
      const prefix = options.prefix ?? ''
      const page = {
        blobs: [...values.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({
            etag: value.etag,
            key,
          })),
        directories: [],
      }

      if (options.paginate) {
        return (async function* () {
          yield page
        })()
      }

      return Promise.resolve(page)
    }),
    setJSON: vi.fn(
      async (
        key: string,
        data: unknown,
        options: { onlyIfMatch?: string; onlyIfNew?: boolean } = {},
      ) => {
        if (options.onlyIfNew && values.has(key)) {
          return { modified: false }
        }
        if (
          options.onlyIfMatch != null &&
          values.get(key)?.etag !== options.onlyIfMatch
        ) {
          return { modified: false }
        }

        etagId += 1
        values.set(key, {
          data: structuredClone(data),
          etag: `etag-${etagId}`,
        })

        return { modified: true }
      },
    ),
    values,
  }
}

const createRecord = (
  id: string,
  score: { elapsed: number; total: number },
  submittedAt: string,
): ReachMoonHighscoreRecord => ({
  id,
  playerName: `Pilot ${id}`,
  score: {
    baseScorePoints: 1_000,
    fuelBonusPoints: 0,
    fuelRemainingKg: 0,
    missionElapsedSeconds: score.elapsed,
    timePenaltyPoints: 0,
    totalScore: score.total,
  },
  submittedAt,
})

const seedRollup = (
  store: ReturnType<typeof createStore>,
  key: string,
  period: ReachMoonHighscorePeriod,
  records: readonly ReachMoonHighscoreRecord[],
) => {
  store.values.set(key, {
    data: createReachMoonHighscoreRollup(period, records, now),
    etag: `seed-${key}`,
  })
}

const seedRecord = (
  store: ReturnType<typeof createStore>,
  record: ReachMoonHighscoreRecord,
) => {
  store.values.set(`records/by-run/${record.id}.json`, {
    data: record,
    etag: `seed-${record.id}`,
  })
}

const readJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T

const createReceipt = () =>
  createReachMoonRunReceipt({
    issuedAt: '2026-06-28T20:00:00.000Z',
    secret,
  })

describe('reachMoonHighscores function', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', secret)
    blobMocks.getStore.mockReturnValue(createStore())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('exposes a rate-limited API path for the highscore function', () => {
    expect(config).toMatchObject({
      path: [
        '/api/reach-moon/highscores',
        '/.netlify/functions/reach-moon-highscores',
      ],
      rateLimit: {
        aggregateBy: ['ip', 'domain'],
        windowLimit: 120,
        windowSize: 60,
      },
    })
  })

  it('returns empty daily, weekly, and all-time rollups for GET', async () => {
    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores'),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=30, stale-while-revalidate=120',
    )
    await expect(readJson(response)).resolves.toEqual({
      rollups: {
        'all-time': {
          entries: [],
          generatedAt: now,
          period: 'all-time',
        },
        daily: {
          entries: [],
          generatedAt: now,
          period: 'daily',
        },
        weekly: {
          entries: [],
          generatedAt: now,
          period: 'weekly',
        },
      },
    })
  })

  it('validates requested periods before reading storage', async () => {
    const response = await handler(
      new Request(
        'https://example.test/api/reach-moon/highscores?period=monthly',
      ),
    )

    expect(response.status).toBe(400)
    await expect(readJson(response)).resolves.toMatchObject({
      error: {
        code: 'invalid_period',
        details: {
          supportedPeriods: ['daily', 'weekly', 'all-time'],
        },
      },
    })
    expect(blobMocks.getStore).not.toHaveBeenCalled()
  })

  it('stores a sanitized record and updates ordered top-ten rollups', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const dailyOldRecord = createRecord(
      'daily-old',
      { elapsed: 120, total: 900 },
      now,
    )
    const weeklyOldRecord = createRecord(
      'weekly-old',
      { elapsed: 120, total: 900 },
      '2026-06-27T20:30:00.000Z',
    )
    const allTimeRecords = Array.from({ length: 10 }, (_, index) =>
      createRecord(
        `all-time-${index}`,
        { elapsed: 1_000 + index, total: 900 - index },
        `2026-06-${String(18 + index).padStart(2, '0')}T12:00:00.000Z`,
      ),
    )

    for (const record of [dailyOldRecord, weeklyOldRecord, ...allTimeRecords]) {
      seedRecord(store, record)
    }
    seedRollup(store, 'rollups/daily/2026-06-28.json', 'daily', [
      dailyOldRecord,
    ])
    seedRollup(store, 'rollups/weekly/2026-W26.json', 'weekly', [
      dailyOldRecord,
      weeklyOldRecord,
    ])
    seedRollup(store, 'rollups/all-time.json', 'all-time', allTimeRecords)

    const receipt = await createReceipt()
    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 1,
          missionElapsedSeconds: 0,
          playerName: '  Moon Ace  ',
          runReceipt: receipt,
          totalScore: 1,
        }),
        method: 'POST',
      }),
    )
    const body = await readJson<{
      record: ReachMoonHighscoreRecord
      rollups: Record<ReachMoonHighscorePeriod, { entries: { id: string }[] }>
    }>(response)

    expect(response.status).toBe(200)
    expect(body.record).toMatchObject({
      playerName: 'Moon Ace',
      score: {
        fuelBonusPoints: 200,
        missionElapsedSeconds: 0,
        totalScore: 1_200,
      },
      submittedAt: now,
    })
    expect(body.record.id).toBe(receipt.runId)
    expect(
      [...store.values.keys()].filter((key) =>
        key.startsWith('records/by-run/'),
      ),
    ).toHaveLength(13)
    expect(
      store.values.get(`records/by-run/${receipt.runId}.json`),
    ).toBeTruthy()
    const dailyEntries = (
      store.values.get('rollups/daily/2026-06-28.json')?.data as {
        entries: { id: string; rank: number; score: { totalScore: number } }[]
      }
    ).entries
    const weeklyEntries = (
      store.values.get('rollups/weekly/2026-W26.json')?.data as {
        entries: { id: string; rank: number }[]
      }
    ).entries

    expect(dailyEntries[0]).toMatchObject({
      id: body.record.id,
      rank: 1,
      score: { totalScore: 1_200 },
    })
    expect(dailyEntries[1]).toMatchObject({
      id: 'daily-old',
      rank: 2,
    })
    expect(weeklyEntries[0]).toMatchObject({
      id: body.record.id,
      rank: 1,
    })
    expect(weeklyEntries.map((entry) => entry.id)).toContain('weekly-old')
    expect(
      (
        store.values.get('rollups/all-time.json')?.data as {
          entries: { id: string }[]
        }
      ).entries,
    ).toHaveLength(10)
    expect(body.rollups['all-time'].entries[0]).toEqual(
      expect.objectContaining({
        id: body.record.id,
        rank: 1,
      }),
    )
    expect(store.list).not.toHaveBeenCalled()
  })

  it('treats receipt run IDs as idempotency keys for replayed submissions', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()
    const requestBody = {
      fuelRemainingRatio: 1,
      missionElapsedSeconds: 0,
      playerName: 'First Pilot',
      runReceipt: receipt,
    }

    const firstResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify(requestBody),
        method: 'POST',
      }),
    )
    const replayResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          ...requestBody,
          fuelRemainingRatio: 0,
          missionElapsedSeconds: 999,
          playerName: 'Replay Pilot',
        }),
        method: 'POST',
      }),
    )
    const firstBody = await readJson<{ record: ReachMoonHighscoreRecord }>(
      firstResponse,
    )
    const replayBody = await readJson<{ record: ReachMoonHighscoreRecord }>(
      replayResponse,
    )

    expect(firstResponse.status).toBe(200)
    expect(replayResponse.status).toBe(200)
    expect(firstBody.record).toEqual(replayBody.record)
    expect(firstBody.record).toMatchObject({
      id: receipt.runId,
      playerName: 'First Pilot',
    })
    expect(
      [...store.values.keys()].filter((key) =>
        key.startsWith('records/by-run/'),
      ),
    ).toEqual([`records/by-run/${receipt.runId}.json`])
  })

  it('serves GET rollups from cache without scanning immutable records', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const cachedOnlyRecord = createRecord(
      'cached-only',
      { elapsed: 60, total: 999 },
      now,
    )
    seedRollup(store, 'rollups/daily/2026-06-28.json', 'daily', [
      cachedOnlyRecord,
    ])
    seedRecord(
      store,
      createRecord('stored-run', { elapsed: 50, total: 1_200 }, now),
    )

    const response = await handler(
      new Request(
        'https://example.test/api/reach-moon/highscores?period=daily',
      ),
    )
    const body = await readJson<{
      rollups: Record<ReachMoonHighscorePeriod, { entries: { id: string }[] }>
    }>(response)

    expect(response.status).toBe(200)
    expect(body.rollups.daily.entries.map((entry) => entry.id)).toEqual([
      'cached-only',
    ])
    expect(store.list).not.toHaveBeenCalled()
  })

  it('repairs missing GET rollups with a bounded paginated record read', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    seedRecord(
      store,
      createRecord('stored-run', { elapsed: 50, total: 1_200 }, now),
    )

    const response = await handler(
      new Request(
        'https://example.test/api/reach-moon/highscores?period=daily',
      ),
    )
    const body = await readJson<{
      rollups: Record<ReachMoonHighscorePeriod, { entries: { id: string }[] }>
    }>(response)

    expect(response.status).toBe(200)
    expect(body.rollups.daily.entries.map((entry) => entry.id)).toEqual([
      'stored-run',
    ])
    expect(store.list).toHaveBeenCalledWith({
      paginate: true,
      prefix: 'records/by-run/',
    })
    expect(store.values.get('rollups/daily/2026-06-28.json')).toBeTruthy()
  })

  it('keeps accepted records authoritative when a rollup cache write fails', async () => {
    const store = createStore()
    const writeThroughSetJSON = store.setJSON
    store.setJSON = vi.fn(
      async (
        key: string,
        data: unknown,
        options: { onlyIfMatch?: string; onlyIfNew?: boolean } = {},
      ) => {
        if (key === 'rollups/weekly/2026-W26.json') {
          throw new Error('cache write failed')
        }

        return writeThroughSetJSON(key, data, options)
      },
    )
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()

    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 1,
          missionElapsedSeconds: 0,
          playerName: 'Cache Pilot',
          runReceipt: receipt,
        }),
        method: 'POST',
      }),
    )
    const body = await readJson<{
      record: ReachMoonHighscoreRecord
      rollups: Record<ReachMoonHighscorePeriod, { entries: { id: string }[] }>
    }>(response)

    expect(response.status).toBe(200)
    expect(
      store.values.get(`records/by-run/${receipt.runId}.json`),
    ).toBeTruthy()
    expect(body.record.id).toBe(receipt.runId)
    expect(body.rollups.weekly.entries[0]?.id).toBe(receipt.runId)
    expect(store.values.get('rollups/weekly/2026-W26.json')).toBeUndefined()
  })

  it('returns typed JSON errors for method, body, input, receipt, and storage failures', async () => {
    const methodResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        method: 'PATCH',
      }),
    )
    expect(methodResponse.status).toBe(405)
    await expect(readJson(methodResponse)).resolves.toMatchObject({
      error: { code: 'method_not_allowed' },
    })

    const jsonResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: '{',
        method: 'POST',
      }),
    )
    expect(jsonResponse.status).toBe(400)
    await expect(readJson(jsonResponse)).resolves.toMatchObject({
      error: { code: 'invalid_json' },
    })

    const missingBodyResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: '',
        method: 'POST',
      }),
    )
    expect(missingBodyResponse.status).toBe(400)
    await expect(readJson(missingBodyResponse)).resolves.toMatchObject({
      error: { code: 'missing_body' },
    })

    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', '')
    const secretResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
    )
    expect(secretResponse.status).toBe(500)
    await expect(readJson(secretResponse)).resolves.toMatchObject({
      error: { code: 'missing_receipt_secret' },
    })
    vi.stubEnv('REACH_MOON_RUN_RECEIPT_SECRET', secret)

    const receiptResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 0.5,
          missionElapsedSeconds: 90_000,
          runReceipt: {},
        }),
        method: 'POST',
      }),
    )
    expect(receiptResponse.status).toBe(401)
    await expect(readJson(receiptResponse)).resolves.toMatchObject({
      error: {
        code: 'invalid_receipt',
        details: [{ code: 'invalid_receipt', field: 'runReceipt' }],
      },
    })

    const invalidReceipt = await createReceipt()
    const inputResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 2,
          missionElapsedSeconds: 90_000,
          runReceipt: invalidReceipt,
        }),
        method: 'POST',
      }),
    )
    expect(inputResponse.status).toBe(422)
    await expect(readJson(inputResponse)).resolves.toMatchObject({
      error: {
        code: 'invalid_highscore',
        details: [{ code: 'out_of_range', field: 'fuelRemainingRatio' }],
      },
    })

    blobMocks.getStore.mockReturnValue({
      get: vi.fn(async () => {
        throw new Error('storage unavailable')
      }),
      list: vi.fn(async () => {
        throw new Error('storage unavailable')
      }),
      setJSON: vi.fn(),
    })
    const storageResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores'),
    )
    expect(storageResponse.status).toBe(503)
    await expect(readJson(storageResponse)).resolves.toMatchObject({
      error: { code: 'storage_error' },
    })
  })
})

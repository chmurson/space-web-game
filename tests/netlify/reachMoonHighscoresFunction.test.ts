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
    baseScorePoints: 0,
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

const createReceipt = (issuedAt = '2026-06-28T20:00:00.000Z') =>
  createReachMoonRunReceipt({
    issuedAt,
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
      { elapsed: 120, total: 200 },
      now,
    )
    const weeklyOldRecord = createRecord(
      'weekly-old',
      { elapsed: 120, total: 200 },
      '2026-06-27T20:30:00.000Z',
    )
    const allTimeRecords = Array.from({ length: 10 }, (_, index) =>
      createRecord(
        `all-time-${index}`,
        { elapsed: 1_000 + index, total: 200 - index },
        `2026-06-${String(8 + index).padStart(2, '0')}T12:00:00.000Z`,
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
          fuelRemainingRatio: 0.9,
          lunarOrbitQuality: {
            orbitApoapsisAltitudeMeters: 100_000,
            orbitPeriapsisAltitudeMeters: 25_000,
          },
          missionElapsedSeconds: 86_400,
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
        fuelBonusPoints: 199.7,
        lunarOrbitQualityPoints: 50,
        missionElapsedSeconds: 86_400,
        timePenaltyPoints: 49.9,
        totalScore: 299.6,
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
      score: { totalScore: 299.6 },
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

  it('filters POST rollup responses by requested period after updating caches', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()

    const response = await handler(
      new Request(
        'https://example.test/api/reach-moon/highscores?period=daily',
        {
          body: JSON.stringify({
            fuelRemainingRatio: 0.5,
            missionElapsedSeconds: 90_000,
            playerName: 'Daily Pilot',
            runReceipt: receipt,
          }),
          method: 'POST',
        },
      ),
    )
    const body = await readJson<{
      record: ReachMoonHighscoreRecord
      rollups: Partial<
        Record<ReachMoonHighscorePeriod, { entries: { id: string }[] }>
      >
    }>(response)

    expect(response.status).toBe(200)
    expect(Object.keys(body.rollups)).toEqual(['daily'])
    expect(body.rollups.daily?.entries[0]?.id).toBe(receipt.runId)
    expect(store.values.get('rollups/daily/2026-06-28.json')).toBeTruthy()
    expect(store.values.get('rollups/weekly/2026-W26.json')).toBeTruthy()
    expect(store.values.get('rollups/all-time.json')).toBeTruthy()
  })

  it.each([
    [
      'near-zero mission time',
      {
        fuelRemainingRatio: 0.5,
        missionElapsedSeconds: 0,
      },
      'mission_elapsed_too_low',
    ],
    [
      'effectively full fuel remaining',
      {
        fuelRemainingRatio: 1,
        missionElapsedSeconds: 90_000,
      },
      'fuel_remaining_too_high',
    ],
  ])('rejects %s before writing a public record', async (_label, input, expectedCode) => {
    const receipt = await createReceipt()

    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          ...input,
          playerName: 'Impossible Pilot',
          runReceipt: receipt,
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(422)
    await expect(readJson(response)).resolves.toMatchObject({
      error: {
        code: 'invalid_highscore',
        details: [expect.objectContaining({ code: expectedCode })],
      },
    })
    expect(blobMocks.getStore).not.toHaveBeenCalled()
  })

  it('rejects highscore submissions sent too soon after receipt issuance', async () => {
    const receipt = await createReceipt('2026-06-28T20:29:50.000Z')

    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 0.5,
          missionElapsedSeconds: 90_000,
          playerName: 'Instant Pilot',
          runReceipt: receipt,
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
    await expect(readJson(response)).resolves.toMatchObject({
      error: {
        code: 'invalid_receipt',
        details: [
          expect.objectContaining({
            code: 'receipt_too_recent',
            threshold: 15_000,
            value: 10_000,
          }),
        ],
      },
    })
    expect(blobMocks.getStore).not.toHaveBeenCalled()
  })

  it('persists suspicious flags on stored records without exposing them publicly', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()

    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 0.98,
          lunarOrbitQuality: {
            orbitApoapsisAltitudeMeters: 100_000,
            orbitPeriapsisAltitudeMeters: 25_000,
          },
          missionElapsedSeconds: 60_000,
          playerName: 'Audit Pilot',
          runReceipt: receipt,
        }),
        method: 'POST',
      }),
    )
    const body = await readJson<{
      record: ReachMoonHighscoreRecord
      rollups: Record<
        ReachMoonHighscorePeriod,
        { entries: Record<string, unknown>[] }
      >
    }>(response)
    const storedRecord = store.values.get(
      `records/by-run/${receipt.runId}.json`,
    )?.data as ReachMoonHighscoreRecord & {
      audit?: { checkedAt: string; flags: string[]; version: number }
    }
    const dailyEntry = (
      store.values.get('rollups/daily/2026-06-28.json')?.data as {
        entries: Record<string, unknown>[]
      }
    ).entries[0]

    expect(response.status).toBe(200)
    expect(storedRecord.audit).toEqual({
      checkedAt: now,
      flags: [
        'unusually_short_mission',
        'unusually_high_fuel_remaining',
        'near_max_score',
      ],
      version: 1,
    })
    expect(body.record).not.toHaveProperty('audit')
    expect(body.rollups.daily.entries[0]).not.toHaveProperty('audit')
    expect(dailyEntry).not.toHaveProperty('audit')
  })

  it('treats receipt run IDs as idempotency keys for replayed submissions', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()
    const requestBody = {
      fuelRemainingRatio: 0.5,
      missionElapsedSeconds: 90_000,
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
          fuelRemainingRatio: 0.3,
          missionElapsedSeconds: 100_000,
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

  it('continues repair reads across blob list pages until the cap', async () => {
    const store = createStore()
    blobMocks.getStore.mockReturnValue(store)
    seedRecord(
      store,
      createRecord('page-one', { elapsed: 50, total: 800 }, now),
    )
    seedRecord(
      store,
      createRecord('page-two', { elapsed: 40, total: 1_200 }, now),
    )
    store.list = vi.fn(
      (options: { paginate?: boolean; prefix?: string } = {}) => {
        const prefix = options.prefix ?? ''
        if (options.paginate) {
          return (async function* () {
            yield {
              blobs: [{ etag: 'page-one-etag', key: `${prefix}page-one.json` }],
              directories: [],
            }
            yield {
              blobs: [{ etag: 'page-two-etag', key: `${prefix}page-two.json` }],
              directories: [],
            }
          })()
        }

        return Promise.resolve({
          blobs: [...store.values.keys()]
            .filter((key) => key.startsWith(prefix))
            .map((key) => ({ etag: 'etag', key })),
          directories: [],
        })
      },
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
      'page-two',
      'page-one',
    ])
    expect(store.get).toHaveBeenCalledWith('records/by-run/page-one.json', {
      type: 'json',
    })
    expect(store.get).toHaveBeenCalledWith('records/by-run/page-two.json', {
      type: 'json',
    })
  })

  it('surfaces storage errors when a rollup cache write is not confirmed', async () => {
    const store = createStore()
    const writeThroughSetJSON = store.setJSON
    store.setJSON = vi.fn(
      async (
        key: string,
        data: unknown,
        options: { onlyIfMatch?: string; onlyIfNew?: boolean } = {},
      ) => {
        if (key === 'rollups/weekly/2026-W26.json') {
          return { modified: false }
        }

        return writeThroughSetJSON(key, data, options)
      },
    )
    blobMocks.getStore.mockReturnValue(store)
    const receipt = await createReceipt()

    const response = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: JSON.stringify({
          fuelRemainingRatio: 0.5,
          missionElapsedSeconds: 90_000,
          playerName: 'Cache Pilot',
          runReceipt: receipt,
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(503)
    await expect(readJson(response)).resolves.toMatchObject({
      error: { code: 'storage_error' },
    })
    expect(
      store.values.get(`records/by-run/${receipt.runId}.json`),
    ).toBeTruthy()
    expect(store.values.get('rollups/weekly/2026-W26.json')).toBeUndefined()
  })

  it('returns typed JSON errors for method, body, input, receipt, and storage failures', async () => {
    const methodResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        method: 'PATCH',
      }),
    )
    expect(methodResponse.status).toBe(405)
    expect(methodResponse.headers.get('allow')).toBe('GET, POST')
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

    const scalarJsonResponse = await handler(
      new Request('https://example.test/api/reach-moon/highscores', {
        body: '[]',
        method: 'POST',
      }),
    )
    expect(scalarJsonResponse.status).toBe(400)
    await expect(readJson(scalarJsonResponse)).resolves.toMatchObject({
      error: {
        code: 'invalid_json',
        message: 'POST body must be a JSON object.',
      },
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

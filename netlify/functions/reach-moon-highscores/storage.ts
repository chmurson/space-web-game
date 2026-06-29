import { getStore } from '@netlify/blobs'

import {
  createReachMoonHighscoreRollup,
  reachMoonHighscorePeriods,
  type ReachMoonHighscorePeriod,
  type ReachMoonHighscoreRecord,
  type ReachMoonHighscoreRollup,
} from '../../../src/scenario/specific-scenarios/reachMoonHighscores'
import type {
  HighscoreBlobStore,
  LeaderboardResponse,
  PeriodRollups,
} from './types'

const storeName = 'reach-moon-highscores'
const maxRollupEntries = 10
const maxRepairRecordReads = 1_000
const rollupWriteAttempts = 3
const millisecondsPerDay = 86_400_000
const recordKeyPrefix = 'records/by-run/'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const getHighscoreStore = (): HighscoreBlobStore =>
  getStore(storeName) as HighscoreBlobStore

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

export const getRecordKey = (runId: string): string =>
  `${recordKeyPrefix}${runId}.json`

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

const isHighscoreRecord = (value: unknown): value is ReachMoonHighscoreRecord =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.playerName === 'string' &&
  typeof value.submittedAt === 'string' &&
  Number.isFinite(Date.parse(value.submittedAt)) &&
  isRecord(value.score) &&
  typeof value.score.baseScorePoints === 'number' &&
  typeof value.score.fuelBonusPoints === 'number' &&
  typeof value.score.fuelRemainingKg === 'number' &&
  typeof value.score.missionElapsedSeconds === 'number' &&
  typeof value.score.timePenaltyPoints === 'number' &&
  typeof value.score.totalScore === 'number'

const isHighscoreRollup = (
  value: unknown,
  period: ReachMoonHighscorePeriod,
): value is ReachMoonHighscoreRollup =>
  isRecord(value) &&
  value.period === period &&
  typeof value.generatedAt === 'string' &&
  Number.isFinite(Date.parse(value.generatedAt)) &&
  Array.isArray(value.entries) &&
  value.entries.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.rank === 'number' &&
      isHighscoreRecord(entry),
  )

export const readRecord = async (
  store: HighscoreBlobStore,
  key: string,
): Promise<ReachMoonHighscoreRecord | null> => {
  const storedRecord = await store.get(key, { type: 'json' })

  return isHighscoreRecord(storedRecord) ? storedRecord : null
}

const readRecordsForRepair = async (
  store: HighscoreBlobStore,
  requiredRecord?: ReachMoonHighscoreRecord,
): Promise<ReachMoonHighscoreRecord[]> => {
  const records: ReachMoonHighscoreRecord[] = []
  let readCount = 0

  repairPages: for await (const { blobs } of store.list({
    paginate: true,
    prefix: recordKeyPrefix,
  })) {
    for (const { key } of blobs) {
      if (readCount >= maxRepairRecordReads) {
        break repairPages
      }

      readCount += 1
      const record = await readRecord(store, key)
      if (record != null) {
        records.push(record)
      }
    }
  }

  if (
    requiredRecord != null &&
    !records.some((record) => record.id === requiredRecord.id)
  ) {
    records.push(requiredRecord)
  }

  return records
}

const readRollupCache = async (
  store: HighscoreBlobStore,
  period: ReachMoonHighscorePeriod,
  periodDate: Date,
): Promise<ReachMoonHighscoreRollup | null> => {
  const storedRollup = await store.get(getRollupKey(period, periodDate), {
    type: 'json',
  })

  return isHighscoreRollup(storedRollup, period) ? storedRollup : null
}

const readRollupCacheWithEtag = async (
  store: HighscoreBlobStore,
  period: ReachMoonHighscorePeriod,
  periodDate: Date,
): Promise<{ etag?: string; rollup: ReachMoonHighscoreRollup } | null> => {
  const storedRollup = await store.getWithMetadata(
    getRollupKey(period, periodDate),
    { type: 'json' },
  )

  return storedRollup != null && isHighscoreRollup(storedRollup.data, period)
    ? {
        etag: storedRollup.etag,
        rollup: storedRollup.data,
      }
    : null
}

const filterRecordsForPeriod = (
  records: readonly ReachMoonHighscoreRecord[],
  period: ReachMoonHighscorePeriod,
  date: Date,
): ReachMoonHighscoreRecord[] => {
  if (period === 'all-time') {
    return [...records]
  }

  const targetKey =
    period === 'daily' ? toUtcDateKey(date) : getIsoWeekKey(date)

  return records.filter((record) => {
    const recordDate = new Date(record.submittedAt)

    return period === 'daily'
      ? toUtcDateKey(recordDate) === targetKey
      : getIsoWeekKey(recordDate) === targetKey
  })
}

const createRollupsFromRecords = (
  records: readonly ReachMoonHighscoreRecord[],
  periods: readonly ReachMoonHighscorePeriod[],
  periodDate: Date,
  generatedAt: Date,
): PeriodRollups => {
  const rollups: PeriodRollups = {}

  for (const period of periods) {
    rollups[period] = createTopTenRollup(
      period,
      filterRecordsForPeriod(records, period, periodDate),
      generatedAt,
    )
  }

  return rollups
}

const writeRollupCache = async (
  store: HighscoreBlobStore,
  rollups: PeriodRollups,
  periodDate: Date,
  options: { onlyIfNew?: boolean } = {},
): Promise<void> => {
  await Promise.allSettled(
    reachMoonHighscorePeriods.map((period) => {
      const rollup = rollups[period]

      return rollup == null
        ? Promise.resolve()
        : store.setJSON(getRollupKey(period, periodDate), rollup, options)
    }),
  )
}

const repairRollupsFromRecords = async (
  store: HighscoreBlobStore,
  periods: readonly ReachMoonHighscorePeriod[],
  periodDate: Date,
  generatedAt: Date,
  requiredRecord?: ReachMoonHighscoreRecord,
): Promise<PeriodRollups> =>
  createRollupsFromRecords(
    await readRecordsForRepair(store, requiredRecord),
    periods,
    periodDate,
    generatedAt,
  )

const mergeRecordIntoRollup = (
  period: ReachMoonHighscorePeriod,
  rollup: ReachMoonHighscoreRollup,
  record: ReachMoonHighscoreRecord,
  generatedAt: Date,
): ReachMoonHighscoreRollup =>
  createTopTenRollup(
    period,
    [...rollup.entries.filter((entry) => entry.id !== record.id), record],
    generatedAt,
  )

const updateRollupCache = async (
  store: HighscoreBlobStore,
  period: ReachMoonHighscorePeriod,
  record: ReachMoonHighscoreRecord,
  recordDate: Date,
  now: Date,
): Promise<ReachMoonHighscoreRollup> => {
  const key = getRollupKey(period, recordDate)

  for (let attempt = 0; attempt < rollupWriteAttempts; attempt += 1) {
    const cached = await readRollupCacheWithEtag(store, period, recordDate)
    if (cached == null) {
      const repaired =
        (
          await repairRollupsFromRecords(
            store,
            [period],
            recordDate,
            now,
            record,
          )
        )[period] ?? createTopTenRollup(period, [record], now)

      try {
        const write = await store.setJSON(key, repaired, { onlyIfNew: true })
        if (write.modified) {
          return repaired
        }
      } catch {
        // Retry with the latest cache snapshot.
      }
      continue
    }

    const rollup = mergeRecordIntoRollup(period, cached.rollup, record, now)

    try {
      const write =
        cached.etag == null
          ? await store.setJSON(key, rollup)
          : await store.setJSON(key, rollup, { onlyIfMatch: cached.etag })
      if (write.modified) {
        return rollup
      }
    } catch {
      // Retry with the latest cache snapshot.
    }
  }

  throw new Error(`Failed to persist ${period} rollup cache`)
}

export const buildLeaderboardResponse = async (
  store: HighscoreBlobStore,
  periods: readonly ReachMoonHighscorePeriod[],
  periodDate: Date,
  generatedAt: Date = periodDate,
): Promise<LeaderboardResponse> => {
  const rollups: PeriodRollups = {}
  const missingPeriods: ReachMoonHighscorePeriod[] = []

  for (const period of periods) {
    const cachedRollup = await readRollupCache(store, period, periodDate)
    if (cachedRollup == null) {
      missingPeriods.push(period)
    } else {
      rollups[period] = cachedRollup
    }
  }

  if (missingPeriods.length > 0) {
    const repairedRollups = await repairRollupsFromRecords(
      store,
      missingPeriods,
      periodDate,
      generatedAt,
    )
    Object.assign(rollups, repairedRollups)
    await writeRollupCache(store, repairedRollups, periodDate, {
      onlyIfNew: true,
    })
  }

  return { rollups }
}

export const updateRollups = async (
  store: HighscoreBlobStore,
  record: ReachMoonHighscoreRecord,
  now: Date,
): Promise<LeaderboardResponse> => {
  const recordDate = new Date(record.submittedAt)
  const rollupEntries = await Promise.all(
    reachMoonHighscorePeriods.map(
      async (
        period,
      ): Promise<[ReachMoonHighscorePeriod, ReachMoonHighscoreRollup]> => [
        period,
        await updateRollupCache(store, period, record, recordDate, now),
      ],
    ),
  )

  return { rollups: Object.fromEntries(rollupEntries) as PeriodRollups }
}

import { describe, expect, it } from 'vitest'

import {
  createReachMoonHighscoreRecord,
  createReachMoonHighscoreRollup,
  generateReachMoonFallbackPilotName,
  parseReachMoonHighscorePeriod,
  REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH,
  REACH_MOON_HIGHSCORE_PLAYER_NAME_MIN_LENGTH,
  type ReachMoonHighscoreRecord,
  rankReachMoonHighscoreRecords,
} from '@/scenario/specific-scenarios/reachMoonHighscores'
import { reachMoonCompletedRunScore } from '../../fixtures/reachMoonCompletedRun'

const createRecord = (
  id: string,
  score: {
    missionElapsedSeconds: number
    totalScore: number
  },
  submittedAt: string,
): ReachMoonHighscoreRecord => ({
  id,
  playerName: `Pilot ${id}`,
  score: {
    baseScorePoints: 0,
    fuelBonusPoints: 0,
    fuelRemainingKg: 0,
    missionElapsedSeconds: score.missionElapsedSeconds,
    timePenaltyPoints: 0,
    totalScore: score.totalScore,
  },
  submittedAt,
})

describe('reachMoonHighscores', () => {
  it('creates a valid record and recomputes score instead of trusting input', () => {
    const record = createReachMoonHighscoreRecord(
      {
        fuelRemainingRatio: 0.5,
        missionElapsedSeconds: 90_000,
        playerName: '  Apollo Ace  ',
        totalScore: 99_999,
      },
      {
        id: 'record-1',
        submittedAt: '2026-06-28T18:00:00.000Z',
      },
    )

    expect(record).toEqual({
      ok: true,
      value: {
        id: 'record-1',
        playerName: 'Apollo Ace',
        score: reachMoonCompletedRunScore,
        submittedAt: '2026-06-28T18:00:00.000Z',
      },
    })
  })

  it('generates a valid fallback name when the submitted name is blank', () => {
    const record = createReachMoonHighscoreRecord(
      {
        fuelRemainingRatio: 0,
        missionElapsedSeconds: 0,
        playerName: '   ',
      },
      {
        id: 'record-2',
        random: () => 0,
        submittedAt: '2026-06-28T18:00:00.000Z',
      },
    )

    expect(record).toMatchObject({
      ok: true,
      value: {
        playerName: 'Vostok Pilot',
      },
    })
  })

  it('rejects invalid submitted score inputs and player name bounds', () => {
    const result = createReachMoonHighscoreRecord(
      {
        fuelRemainingRatio: 1.2,
        missionElapsedSeconds: Number.NaN,
        playerName: 'A',
      },
      {
        id: 'record-3',
        submittedAt: 'not a date',
      },
    )

    expect(result).toEqual({
      errors: [
        {
          code: 'invalid_date',
          field: 'submittedAt',
          message: 'submittedAt must be a date.',
        },
      ],
      ok: false,
    })

    const validDateResult = createReachMoonHighscoreRecord(
      {
        fuelRemainingRatio: 1.2,
        missionElapsedSeconds: Number.NaN,
        playerName: 'A',
      },
      {
        id: 'record-3',
        submittedAt: '2026-06-28T18:00:00.000Z',
      },
    )

    expect(validDateResult).toMatchObject({
      errors: [
        { code: 'too_short', field: 'playerName' },
        { code: 'out_of_range', field: 'fuelRemainingRatio' },
        { code: 'invalid_type', field: 'missionElapsedSeconds' },
      ],
      ok: false,
    })
  })

  it('rejects overlong player names after trimming', () => {
    const result = createReachMoonHighscoreRecord(
      {
        fuelRemainingRatio: 0,
        missionElapsedSeconds: 0,
        playerName: ` ${'A'.repeat(
          REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH + 1,
        )} `,
      },
      {
        id: 'record-4',
        submittedAt: '2026-06-28T18:00:00.000Z',
      },
    )

    expect(result).toMatchObject({
      errors: [{ code: 'too_long', field: 'playerName' }],
      ok: false,
    })
  })

  it('parses only supported leaderboard periods', () => {
    expect(parseReachMoonHighscorePeriod('daily')).toBe('daily')
    expect(parseReachMoonHighscorePeriod('weekly')).toBe('weekly')
    expect(parseReachMoonHighscorePeriod('all-time')).toBe('all-time')
    expect(parseReachMoonHighscorePeriod('monthly')).toBeNull()
    expect(parseReachMoonHighscorePeriod(undefined)).toBeNull()
  })

  it('ranks by total score, elapsed time, then earlier submission time', () => {
    const records = [
      createRecord(
        'later',
        {
          missionElapsedSeconds: 120,
          totalScore: 900,
        },
        '2026-06-28T18:03:00.000Z',
      ),
      createRecord(
        'higher-score',
        {
          missionElapsedSeconds: 300,
          totalScore: 1_000,
        },
        '2026-06-28T18:04:00.000Z',
      ),
      createRecord(
        'faster',
        {
          missionElapsedSeconds: 90,
          totalScore: 900,
        },
        '2026-06-28T18:05:00.000Z',
      ),
      createRecord(
        'earlier',
        {
          missionElapsedSeconds: 120,
          totalScore: 900,
        },
        '2026-06-28T18:01:00.000Z',
      ),
    ]

    expect(
      rankReachMoonHighscoreRecords(records).map(({ id, rank }) => ({
        id,
        rank,
      })),
    ).toEqual([
      { id: 'higher-score', rank: 1 },
      { id: 'faster', rank: 2 },
      { id: 'earlier', rank: 3 },
      { id: 'later', rank: 4 },
    ])
  })

  it('creates rollups with ranked entries and normalized generatedAt strings', () => {
    const rollup = createReachMoonHighscoreRollup(
      'daily',
      [
        createRecord(
          'second',
          {
            missionElapsedSeconds: 0,
            totalScore: 1,
          },
          '2026-06-28T18:01:00.000Z',
        ),
        createRecord(
          'first',
          {
            missionElapsedSeconds: 0,
            totalScore: 2,
          },
          '2026-06-28T18:02:00.000Z',
        ),
      ],
      '2026-06-28T21:00:00+02:00',
    )

    expect(rollup).toEqual({
      entries: [
        expect.objectContaining({ id: 'first', rank: 1 }),
        expect.objectContaining({ id: 'second', rank: 2 }),
      ],
      generatedAt: '2026-06-28T19:00:00.000Z',
      period: 'daily',
    })
  })

  it('rejects invalid rollup generatedAt strings', () => {
    expect(() =>
      createReachMoonHighscoreRollup('daily', [], 'not a date'),
    ).toThrow('generatedAt must be a date.')
  })

  it('generates bounded two-word pilot-style fallback names', () => {
    const names = [
      generateReachMoonFallbackPilotName(() => 0),
      generateReachMoonFallbackPilotName(() => 0.999),
      generateReachMoonFallbackPilotName(() => Number.NaN),
    ]

    expect(names).toEqual(['Vostok Pilot', 'Artemis Scout', 'Vostok Pilot'])

    for (const name of names) {
      expect(name.split(' ')).toHaveLength(2)
      expect(name.length).toBeGreaterThanOrEqual(
        REACH_MOON_HIGHSCORE_PLAYER_NAME_MIN_LENGTH,
      )
      expect(name.length).toBeLessThanOrEqual(
        REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH,
      )
    }
  })
})

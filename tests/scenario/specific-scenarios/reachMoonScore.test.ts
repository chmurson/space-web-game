import { describe, expect, it } from 'vitest'

import {
  calculateReachMoonOrbitQualityPoints,
  calculateReachMoonScore,
  formatReachMoonOrbitAltitude,
  formatReachMoonOrbitQualityContext,
  formatReachMoonScoreSummary,
  formatReachMoonScoreSummaryDisplay,
  getReachMoonFuelRemainingRatio,
} from '@/scenario/specific-scenarios/reachMoonScore'

describe('reachMoonScore', () => {
  const fuelTargets = [
    [0, 0],
    [0.1, 10.2],
    [0.2, 20.1],
    [0.3, 44.1],
    [0.4, 80.7],
    [0.5, 121.5],
    [0.6, 157.1],
    [0.7, 181.8],
    [0.8, 194.9],
    [0.9, 199.7],
    [1, 200],
  ] as const

  const dayTargets = [
    [1, 49.9],
    [2, 45],
    [3, 40.1],
    [4, 35.2],
    [5, 30.7],
    [6, 26.7],
    [7, 23.2],
    [8, 20.3],
    [9, 18],
    [10, 16.3],
    [11, 15],
    [12, 14],
    [13, 13.1],
    [14, 12],
  ] as const

  it('uses fuel as the primary score component and time as a secondary component', () => {
    const efficientSlow = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.9,
      missionElapsedSeconds: 14 * 86_400,
    })
    const fuelHeavyFast = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.5,
      missionElapsedSeconds: 86_400,
    })
    const fasterSameFuel = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.9,
      missionElapsedSeconds: 86_400,
    })

    expect(efficientSlow.totalScore).toBeGreaterThan(fuelHeavyFast.totalScore)
    expect(fasterSameFuel.totalScore).toBeGreaterThan(efficientSlow.totalScore)
  })

  it('formats the summary with score components', () => {
    const score = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.5,
      missionElapsedSeconds: 90_000,
    })

    expect(formatReachMoonScoreSummary(score)).toBe(
      'Score 171.2. Time used 1d 1h (+49.7). Fuel left 50% (+121.5). Lunar orbit No close lunar orbit (0).',
    )
    expect(formatReachMoonScoreSummaryDisplay(score)).toEqual({
      fuelBonusPoints: '121.5',
      fuelLeft: '50%',
      lunarOrbitQualityAltitude: 'No close lunar orbit',
      lunarOrbitQualityPoints: '0',
      missionElapsed: '1d 1h',
      timeScorePoints: '49.7',
      totalScore: '171.2',
    })
  })

  it('normalizes score fuel for matching percent text and highscore icons', () => {
    expect(getReachMoonFuelRemainingRatio({ fuelRemainingKg: 16_000 })).toBe(
      0.5,
    )
    expect(getReachMoonFuelRemainingRatio({ fuelRemainingKg: 48_000 })).toBe(1)
    expect(getReachMoonFuelRemainingRatio({ fuelRemainingKg: -1 })).toBe(0)
  })

  it.each(
    fuelTargets,
  )('matches the fuel-left target curve for ratio %s', (fuelRemainingRatio, fuelBonusPoints) => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio,
        missionElapsedSeconds: 86_400,
      }).fuelBonusPoints,
    ).toBe(fuelBonusPoints)
  })

  it.each(
    dayTargets,
  )('matches the elapsed-day target curve for day %s', (elapsedDays, timePenaltyPoints) => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio: 0,
        missionElapsedSeconds: elapsedDays * 86_400,
      }).timePenaltyPoints,
    ).toBe(timePenaltyPoints)
  })

  it('makes a low-fuel two-and-a-half-day run score mostly on time', () => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio: 0.08,
        missionElapsedSeconds: 2.5 * 86_400,
      }),
    ).toMatchObject({
      baseScorePoints: 0,
      fuelBonusPoints: 9.1,
      fuelRemainingKg: 2_560,
      timePenaltyPoints: 42.5,
      totalScore: 51.6,
    })
  })

  it('caps remaining fuel at capacity and caps fuel points at the max', () => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio: 2,
        missionElapsedSeconds: 0,
      }),
    ).toMatchObject({
      baseScorePoints: 0,
      fuelBonusPoints: 200,
      fuelRemainingKg: 32_000,
      timePenaltyPoints: 50,
      totalScore: 250,
    })
  })

  it('scores close safe lunar orbit quality as a separate bonus component', () => {
    expect(
      calculateReachMoonOrbitQualityPoints({
        orbitApoapsisAltitudeMeters: 100_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      }),
    ).toBe(74.9)
    expect(
      calculateReachMoonOrbitQualityPoints({
        orbitApoapsisAltitudeMeters: 1_050_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      }),
    ).toBe(25)
    expect(
      calculateReachMoonOrbitQualityPoints({
        orbitApoapsisAltitudeMeters: 2_000_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      }),
    ).toBe(0)
    expect(
      calculateReachMoonOrbitQualityPoints({
        orbitApoapsisAltitudeMeters: 100_000,
        orbitPeriapsisAltitudeMeters: 15_000,
      }),
    ).toBe(30)
    expect(
      calculateReachMoonOrbitQualityPoints({
        orbitApoapsisAltitudeMeters: 2_000_000,
        orbitPeriapsisAltitudeMeters: 0,
      }),
    ).toBe(-50)
  })

  it('adds lunar orbit quality without changing fuel or time curves', () => {
    const score = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.5,
      lunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 100_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      },
      missionElapsedSeconds: 90_000,
    })

    expect(score).toMatchObject({
      fuelBonusPoints: 121.5,
      lunarOrbitCircularityPoints: 24.9,
      lunarOrbitEccentricity: 0.021,
      lunarOrbitQualityPoints: 74.9,
      timePenaltyPoints: 49.7,
      totalScore: 246.1,
    })
    expect(formatReachMoonScoreSummaryDisplay(score)).toMatchObject({
      lunarOrbitQualityAltitude: 'Ap 100 km / Pe 25 km - near circular',
      lunarOrbitQualityPoints: '74.9',
    })
  })

  it('uses score circularity points for orbit-shape context labels', () => {
    expect(
      formatReachMoonOrbitQualityContext(
        {
          orbitApoapsisAltitudeMeters: 1_180_000,
          orbitPeriapsisAltitudeMeters: 999_999,
        },
        {
          lunarOrbitCircularityPoints: 0,
          lunarOrbitEccentricity: 0.007,
        },
      ),
    ).toBe(
      `Ap ${(1.2).toLocaleString()} Mm / Pe ${(1_000).toLocaleString()} km - very elongated`,
    )
  })

  it('uses shared cosmic-distance formatting for lunar orbit altitudes', () => {
    expect(formatReachMoonOrbitAltitude(135_000)).toBe('140 km')
    expect(formatReachMoonOrbitAltitude(1_180_000)).toBe(
      `${(1.2).toLocaleString()} Mm`,
    )
  })

  it.each([
    [
      'near-circular close orbit',
      420_000,
      390_000,
      { circularity: 25, eccentricity: 0.007, quality: 66.6 },
    ],
    [
      'close but elongated orbit',
      620_000,
      210_000,
      { circularity: 14.5, eccentricity: 0.095, quality: 50.9 },
    ],
    [
      'mostly elongated orbit',
      900_000,
      100_000,
      { circularity: 2.9, eccentricity: 0.179, quality: 31.9 },
    ],
    [
      'high but circular orbit',
      1_400_000,
      1_250_000,
      { circularity: 24.4, eccentricity: 0.024, quality: 40.2 },
    ],
    [
      'unsafe low-periapsis orbit',
      100_000,
      15_000,
      { circularity: 0, eccentricity: 0.024, quality: 30 },
    ],
  ])('scores circularity for %s', (_label, orbitApoapsisAltitudeMeters, orbitPeriapsisAltitudeMeters, expected) => {
    const score = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0,
      lunarOrbitQuality: {
        orbitApoapsisAltitudeMeters,
        orbitPeriapsisAltitudeMeters,
      },
      missionElapsedSeconds: 0,
    })

    expect(score).toMatchObject({
      lunarOrbitCircularityPoints: expected.circularity,
      lunarOrbitEccentricity: expected.eccentricity,
      lunarOrbitQualityPoints: expected.quality,
    })
  })
})

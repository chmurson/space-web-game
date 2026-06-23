import { describe, expect, it } from 'vitest'

import {
  calculateReachMoonScore,
  formatReachMoonScoreSummary,
} from '@/scenario/specific-scenarios/reachMoonScore'

describe('reachMoonScore', () => {
  it('rewards faster completion and remaining fuel', () => {
    const slow = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.25,
      missionElapsedSeconds: 86_400,
    })
    const fast = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.25,
      missionElapsedSeconds: 43_200,
    })
    const moreFuel = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.5,
      missionElapsedSeconds: 86_400,
    })

    expect(fast.totalScore).toBeGreaterThan(slow.totalScore)
    expect(moreFuel.totalScore).toBeGreaterThan(slow.totalScore)
  })

  it('formats the summary with score components', () => {
    const score = calculateReachMoonScore({
      fuelCapacityKg: 32_000,
      fuelRemainingRatio: 0.5,
      missionElapsedSeconds: 90_000,
    })

    expect(formatReachMoonScoreSummary(score)).toBe(
      'Score 1,000. Time used 1d 1h (-100). Fuel left 16,000 kg (+100). Base 1,000.',
    )
  })

  it('makes a low-fuel two-and-a-half-day run land well below the base score', () => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio: 0.08,
        missionElapsedSeconds: 2.5 * 86_400,
      }),
    ).toMatchObject({
      fuelBonusPoints: 16,
      fuelRemainingKg: 2_560,
      timePenaltyPoints: 240,
      totalScore: 776,
    })
  })

  it('caps remaining fuel at capacity and caps fuel bonus at the max bonus', () => {
    expect(
      calculateReachMoonScore({
        fuelCapacityKg: 32_000,
        fuelRemainingRatio: 2,
        missionElapsedSeconds: 0,
      }),
    ).toMatchObject({
      fuelBonusPoints: 200,
      fuelRemainingKg: 32_000,
    })
  })
})

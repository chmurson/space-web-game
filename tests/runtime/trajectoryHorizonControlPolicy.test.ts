import { describe, expect, it } from 'vitest'
import {
  getNextTrajectoryHorizonHours,
  getTrajectoryHorizonPreview,
  getTrajectoryHorizonPreviews,
} from '@/runtime/trajectoryHorizonControlPolicy'

describe('trajectoryHorizonControlPolicy', () => {
  it('steps through compact hour values before whole-day values', () => {
    expect(
      getTrajectoryHorizonPreview({
        action: 'decreaseCoastHorizon',
        currentHours: 4,
        maxHours: 32,
        minHours: 0.5,
      }),
    ).toEqual({ canCommit: true, value: 2 })

    expect(
      getTrajectoryHorizonPreview({
        action: 'increaseCoastHorizon',
        currentHours: 4,
        maxHours: 32,
        minHours: 0.5,
      }),
    ).toEqual({ canCommit: true, value: 8 })
  })

  it('uses whole-day steps instead of fractional-day values', () => {
    expect(
      getNextTrajectoryHorizonHours({
        action: 'increaseCoastHorizon',
        currentHours: 16,
        maxHours: 768,
        minHours: 0.5,
      }),
    ).toBe(24)

    expect(
      getNextTrajectoryHorizonHours({
        action: 'decreaseCoastHorizon',
        currentHours: 48,
        maxHours: 768,
        minHours: 0.5,
      }),
    ).toBe(24)

    expect(
      getTrajectoryHorizonPreviews({
        action: 'increaseCoastHorizon',
        count: 5,
        currentHours: 16,
        maxHours: 768,
        minHours: 0.5,
      }),
    ).toEqual([
      { canCommit: true, value: 24 },
      { canCommit: true, value: 48 },
      { canCommit: true, value: 96 },
      { canCommit: true, value: 192 },
      { canCommit: true, value: 384 },
    ])
  })

  it('clamps controls at the global maximum horizon', () => {
    expect(
      getNextTrajectoryHorizonHours({
        action: 'increaseCoastHorizon',
        currentHours: 384,
        maxHours: 768,
        minHours: 0.5,
      }),
    ).toBe(768)

    expect(
      getTrajectoryHorizonPreview({
        action: 'increaseCoastHorizon',
        currentHours: 768,
        maxHours: 768,
        minHours: 0.5,
      }),
    ).toEqual({ canCommit: false, value: 768 })
  })

  it('returns blocked edge previews at min and max limits', () => {
    expect(
      getTrajectoryHorizonPreview({
        action: 'decreaseCoastHorizon',
        currentHours: 0.5,
        maxHours: 32,
        minHours: 0.5,
      }),
    ).toEqual({ canCommit: false, value: 0.5 })

    expect(
      getTrajectoryHorizonPreview({
        action: 'increaseCoastHorizon',
        currentHours: 32,
        maxHours: 32,
        minHours: 0.5,
      }),
    ).toEqual({ canCommit: false, value: 32 })
  })

  it('uses configured bounds as clean final steps', () => {
    expect(
      getTrajectoryHorizonPreviews({
        action: 'increaseCoastHorizon',
        count: 4,
        currentHours: 8,
        maxHours: 32,
        minHours: 0.5,
      }),
    ).toEqual([
      { canCommit: true, value: 16 },
      { canCommit: true, value: 24 },
      { canCommit: true, value: 32 },
    ])
  })
})

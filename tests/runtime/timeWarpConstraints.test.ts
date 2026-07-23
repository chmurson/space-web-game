import { describe, expect, it } from 'vitest'

import {
  getPredictionCoverageTimeWarpLimit,
  resolveTimeWarpConstraints,
} from '@/runtime/timeWarpConstraints'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

describe('prediction coverage time-warp constraints', () => {
  it.each([
    [0.5, 120],
    [1, 240],
    [2, 480],
    [4, 900],
    [8, 1_800],
    [16, 3_600],
    [24, 7_200],
    [48, 14_400],
    [96, 28_800],
    [192, 54_000],
  ])('snaps %sh of usable coverage down to %sx', (hours, expectedWarp) => {
    expect(
      getPredictionCoverageTimeWarpLimit(hours * 60 * 60, requestedTimeWarps),
    ).toMatchObject({
      maxTimeWarp: expectedWarp,
      rawMaxTimeWarp: (hours * 60 * 60) / 10,
    })
  })

  it('uses a two-hour loop or impact window instead of a longer selected horizon', () => {
    const resolution = resolveTimeWarpConstraints({
      maxTimeWarp: null,
      simulationControlMaxWarp: null,
      timeWarpIndex: requestedTimeWarps.indexOf(54_000),
      timeWarps: requestedTimeWarps,
      usablePredictionCoverageSeconds: 2 * 60 * 60,
    })

    expect(resolution.reason).toBe('prediction-coverage')
    expect(requestedTimeWarps[resolution.timeWarpIndex]).toBe(480)
  })

  it('uses an impact-limited window as the coverage cap', () => {
    expect(
      getPredictionCoverageTimeWarpLimit(450, requestedTimeWarps),
    ).toMatchObject({
      maxTimeWarp: 30,
      rawMaxTimeWarp: 45,
    })
  })

  it('keeps stricter active-control and scenario limits authoritative', () => {
    const requestedIndex = requestedTimeWarps.indexOf(54_000)
    const ampleCoverageSeconds = 192 * 60 * 60

    expect(
      resolveTimeWarpConstraints({
        maxTimeWarp: null,
        simulationControlMaxWarp: 100,
        timeWarpIndex: requestedIndex,
        timeWarps: requestedTimeWarps,
        usablePredictionCoverageSeconds: ampleCoverageSeconds,
      }),
    ).toMatchObject({
      reason: 'active-controls',
      timeWarpIndex: requestedTimeWarps.indexOf(60),
    })

    expect(
      resolveTimeWarpConstraints({
        maxTimeWarp: 240,
        simulationControlMaxWarp: null,
        timeWarpIndex: requestedIndex,
        timeWarps: requestedTimeWarps,
        usablePredictionCoverageSeconds: ampleCoverageSeconds,
      }),
    ).toMatchObject({
      reason: 'scenario-limit',
      timeWarpIndex: requestedTimeWarps.indexOf(240),
    })
  })
})

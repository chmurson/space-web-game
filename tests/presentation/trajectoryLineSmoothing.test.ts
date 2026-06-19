import { describe, expect, it } from 'vitest'

import {
  getBlendedTrajectoryPoints,
  getSmoothedTrajectoryTipPoints,
  getTrajectoryPointsWithStart,
  getUnrevealedTrajectoryTipSeconds,
} from '@/presentation/trajectoryLineSmoothing'

describe('trajectoryLineSmoothing', () => {
  const linePoints = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ]

  it('leaves empty and single-point predictions unchanged', () => {
    const point = [{ x: 1, y: 2 }]

    expect(
      getSmoothedTrajectoryTipPoints([], {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 0.4,
      }),
    ).toEqual([])
    expect(
      getSmoothedTrajectoryTipPoints(point, {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 0.4,
      }),
    ).toBe(point)
  })

  it('anchors rendered prediction points to the current ship position', () => {
    expect(getTrajectoryPointsWithStart(linePoints, { x: -5, y: 2 })).toEqual([
      { x: -5, y: 2 },
      ...linePoints,
    ])
  })

  it('does not create a rendered line when prediction data is empty', () => {
    const points: typeof linePoints = []

    expect(getTrajectoryPointsWithStart(points, { x: -5, y: 2 })).toBe(points)
  })

  it('keeps the ship anchor live while blending fixed samples between refreshes', () => {
    expect(
      getBlendedTrajectoryPoints(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 40, y: 0 },
        ],
        [
          { x: -5, y: 2 },
          { x: 10, y: 0 },
          { x: 30, y: 0 },
        ],
        0.25,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 12.5, y: 0 },
      { x: 32.5, y: 0 },
    ])
  })

  it('uses current samples when previous prediction shape does not match', () => {
    expect(getBlendedTrajectoryPoints(linePoints, [{ x: 1, y: 1 }], 0.5)).toBe(
      linePoints,
    )
  })

  it('trims only the unrevealed part of the final segment', () => {
    expect(
      getSmoothedTrajectoryTipPoints(linePoints, {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 0.4,
      }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 16, y: 0 },
    ])

    expect(
      getSmoothedTrajectoryTipPoints(linePoints, {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 0.15,
      }).at(-1),
    ).toEqual({ x: 18.5, y: 0 })
  })

  it('reveals the calculated endpoint once the refresh interval has elapsed', () => {
    expect(
      getSmoothedTrajectoryTipPoints(linePoints, {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 0,
      }),
    ).toBe(linePoints)
  })

  it('supports half-second prediction samples without extending past calculated data', () => {
    expect(
      getSmoothedTrajectoryTipPoints(linePoints, {
        predictionStepSeconds: 0.5,
        unrevealedPredictionSeconds: 0.4,
      }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ])
  })

  it('can trim whole trailing sample segments while keeping two visible points', () => {
    expect(
      getSmoothedTrajectoryTipPoints(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 30, y: 0 },
        ],
        {
          predictionStepSeconds: 0.5,
          unrevealedPredictionSeconds: 0.6,
        },
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 18, y: 0 },
    ])

    const twoPointLine = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]

    expect(
      getSmoothedTrajectoryTipPoints(twoPointLine, {
        predictionStepSeconds: 1,
        unrevealedPredictionSeconds: 1,
      }),
    ).toBe(twoPointLine)
  })

  it('scales the trim for five-minute time warp without jumping to the full endpoint', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
      { x: 50, y: 0 },
    ]

    expect(
      getSmoothedTrajectoryTipPoints(points, {
        predictionStepSeconds: 30,
        unrevealedPredictionSeconds: 120,
      }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
  })

  it('scales unrevealed tip time by the active time warp', () => {
    expect(
      getUnrevealedTrajectoryTipSeconds({
        predictionRefreshAgeSeconds: 0,
        predictionRefreshIntervalSeconds: 0.4,
        timeWarp: 300,
      }),
    ).toBe(120)

    expect(
      getUnrevealedTrajectoryTipSeconds({
        predictionRefreshAgeSeconds: 0.2,
        predictionRefreshIntervalSeconds: 0.4,
        timeWarp: 300,
      }),
    ).toBeCloseTo(60)
  })
})

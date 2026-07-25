import { describe, expect, it } from 'vitest'

import {
  getTrajectoryRenderMaxChordErrorMeters,
  getTrajectoryRenderSampleDistanceMeters,
  selectTrajectoryRenderGeometry,
} from '@/presentation/trajectoryRenderSelection'

const createLinearPoints = (count: number, spacingMeters: number) =>
  Array.from({ length: count }, (_, index) => ({
    x: index * spacingMeters,
    y: 0,
  }))

const createArcPoints = (
  count: number,
  radiusMeters: number,
  arcRadians: number,
) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (arcRadians * index) / (count - 1)
    return {
      x: Math.cos(angle) * radiusMeters,
      y: Math.sin(angle) * radiusMeters,
    }
  })

const getMaximumChordErrorMeters = (
  points: ReadonlyArray<{ x: number; y: number }>,
  selectedPointIndices: readonly number[],
) => {
  let maximumError = 0

  for (let segment = 1; segment < selectedPointIndices.length; segment += 1) {
    const startIndex = selectedPointIndices[segment - 1]
    const endIndex = selectedPointIndices[segment]
    const start = points[startIndex]
    const end = points[endIndex]
    const chordX = end.x - start.x
    const chordY = end.y - start.y
    const chordLength = Math.hypot(chordX, chordY)

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const point = points[index]
      const error =
        chordLength === 0
          ? Math.hypot(point.x - start.x, point.y - start.y)
          : Math.abs(
              (point.x - start.x) * chordY - (point.y - start.y) * chordX,
            ) / chordLength
      maximumError = Math.max(maximumError, error)
    }
  }

  return maximumError
}

describe('trajectoryRenderSelection', () => {
  it('reduces line density as the viewport expands', () => {
    const points = createLinearPoints(41, 500_000)
    const close = selectTrajectoryRenderGeometry({
      farVisible: 'none',
      nearPointCount: 0,
      points,
      viewportSize: 50,
    })
    const system = selectTrajectoryRenderGeometry({
      farVisible: 'none',
      nearPointCount: 0,
      points,
      viewportSize: 1_000,
    })

    expect(getTrajectoryRenderSampleDistanceMeters(50)).toBe(500_000)
    expect(getTrajectoryRenderSampleDistanceMeters(1_000)).toBe(12_000_000)
    expect(close.visiblePointIndices).toEqual(
      Array.from({ length: points.length }, (_, index) => index),
    )
    expect(system.visiblePointIndices).toEqual([0, 24, 40])
    expect(system.visiblePointIndices.length).toBeLessThan(
      close.visiblePointIndices.length,
    )
    expect(points).toHaveLength(41)
  })

  it('retains extra points for a tight curved arc at the same path spacing', () => {
    const radiusMeters = 1_000_000
    const arcPoints = createArcPoints(121, radiusMeters, Math.PI * 1.5)
    const arcLengthMeters = radiusMeters * Math.PI * 1.5
    const linearPoints = createLinearPoints(121, arcLengthMeters / 120)
    const selectionOptions = {
      farVisible: 'none' as const,
      nearPointCount: 0,
      viewportHeight: 600,
      viewportSize: 100,
    }

    const curved = selectTrajectoryRenderGeometry({
      ...selectionOptions,
      mandatoryPointIndices: [60],
      points: arcPoints,
    })
    const linear = selectTrajectoryRenderGeometry({
      ...selectionOptions,
      points: linearPoints,
    })

    expect(curved.visiblePointIndices.length).toBeGreaterThan(
      linear.visiblePointIndices.length,
    )
    expect(curved.visiblePointIndices).toEqual(
      expect.arrayContaining([0, 60, arcPoints.length - 1]),
    )
    expect(
      getMaximumChordErrorMeters(arcPoints, curved.visiblePointIndices),
    ).toBeLessThanOrEqual(
      getTrajectoryRenderMaxChordErrorMeters(selectionOptions),
    )
  })

  it('keeps endpoints and explicit mandatory source points', () => {
    const selection = selectTrajectoryRenderGeometry({
      farVisible: 'none',
      mandatoryPointIndices: [3, 7, 7, -1, 99],
      nearPointCount: 0,
      points: createLinearPoints(11, 100_000),
      viewportSize: 1_000,
    })

    expect(selection.visiblePointIndices).toEqual([0, 3, 7, 10])
  })

  it('preserves current and retained-stale tier boundaries while slicing', () => {
    const points = createLinearPoints(6, 500_000)
    const current = selectTrajectoryRenderGeometry({
      farVisible: 'current',
      nearPointCount: 3,
      points,
      viewportSize: 1_000,
    })
    const retainedStale = selectTrajectoryRenderGeometry({
      farVisible: 'retained-stale',
      nearPointCount: 3,
      points,
      viewportSize: 1_000,
    })

    expect(current.visiblePointIndices).toEqual([0, 2, 3, 5])
    expect(current.staleFarPointIndices).toEqual([])
    expect(retainedStale.visiblePointIndices).toEqual([0, 2])
    expect(retainedStale.staleFarPointIndices).toEqual([2, 3, 5])
  })

  it('retains stale-far trimming before selecting sparse geometry', () => {
    const selection = selectTrajectoryRenderGeometry({
      farVisible: 'retained-stale',
      nearPointCount: 2,
      points: [
        { x: 0, y: 0 },
        { x: 1_000_000, y: 0 },
        { x: 400_000, y: 0 },
        { x: 800_000, y: 0 },
        { x: 1_200_000, y: 0 },
        { x: 2_000_000, y: 0 },
      ],
      viewportSize: 1_000,
    })

    expect(selection.visiblePointIndices).toEqual([0, 1])
    expect(selection.staleFarPointIndices).toEqual([1, 4, 5])
  })

  it('restores deterministic detail when zooming back in', () => {
    const points = createLinearPoints(49, 250_000)
    const selectAtViewport = (viewportSize: number) =>
      selectTrajectoryRenderGeometry({
        farVisible: 'none',
        nearPointCount: 0,
        points,
        viewportSize,
      })

    const system = selectAtViewport(1_000)
    const close = selectAtViewport(50)
    const systemAgain = selectAtViewport(1_000)

    expect(system.visiblePointIndices).toEqual([0, 48])
    expect(close.visiblePointIndices).toHaveLength(25)
    expect(close.visiblePointIndices).toEqual(
      expect.arrayContaining(system.visiblePointIndices),
    )
    expect(systemAgain).toEqual(system)
  })

  it('keeps the impact-gradient start mandatory on a sparse line', () => {
    const selection = selectTrajectoryRenderGeometry({
      farVisible: 'none',
      mandatoryPointIndices: [31],
      nearPointCount: 0,
      points: createLinearPoints(49, 250_000),
      viewportSize: 1_000,
    })

    expect(selection.visiblePointIndices).toEqual([0, 31, 48])
  })
})

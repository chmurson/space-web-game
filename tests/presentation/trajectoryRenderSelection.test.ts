import { describe, expect, it } from 'vitest'

import {
  getTrajectoryRenderSampleDistanceMeters,
  selectTrajectoryRenderGeometry,
} from '@/presentation/trajectoryRenderSelection'

const createLinearPoints = (count: number, spacingMeters: number) =>
  Array.from({ length: count }, (_, index) => ({
    x: index * spacingMeters,
    y: 0,
  }))

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

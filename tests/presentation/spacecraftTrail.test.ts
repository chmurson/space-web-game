import { describe, expect, it } from 'vitest'

import {
  createSpacecraftTrailPoint,
  getSpacecraftTrailDetail,
  getSpacecraftTrailRenderPosition,
  getSpacecraftTrailRenderSampleDistanceMeters,
  getSpacecraftTrailTargetRelativePosition,
  selectSpacecraftTrailRenderPoints,
  spacecraftTrailCaptureMinSampleDistanceMeters,
  spacecraftTrailMaxPoints,
  updateSpacecraftTrailPoints,
} from '@/presentation/spacecraftTrail'
import type { SpacecraftTrailPoint } from '@/scene/createGameScene'
import type { Body } from '@/simulation/types'

const createBody = (id: string, position: { x: number; y: number }): Body => ({
  id,
  name: id,
  mass: 1,
  radius: 1,
  position,
  velocity: { x: 0, y: 0 },
  color: '#fff',
})

const createOrbitTrailPoints = (
  body: Body,
  revolutions: number,
  stepRadians: number,
) => {
  const radius = 10_000_000
  const points: SpacecraftTrailPoint[] = []
  const maxAngle = revolutions * Math.PI * 2

  for (let angle = 0; angle <= maxAngle + 0.0001; angle += stepRadians) {
    points.push(
      createSpacecraftTrailPoint({
        bodies: [body],
        elapsed: points.length,
        spacecraftPosition: {
          x: body.position.x + Math.cos(angle) * radius,
          y: body.position.y + Math.sin(angle) * radius,
        },
      }),
    )
  }

  return points
}

describe('spacecraftTrail', () => {
  it('keeps target-relative samples aligned with the target current position', () => {
    const sampledEarth = createBody('earth', { x: 100, y: 50 })
    const point = createSpacecraftTrailPoint({
      bodies: [sampledEarth],
      elapsed: 0,
      spacecraftPosition: { x: 125, y: 70 },
    })

    const currentTarget = { id: 'earth', position: { x: 200, y: 90 } }
    const relativePosition = getSpacecraftTrailTargetRelativePosition(
      point,
      currentTarget,
    )

    expect(relativePosition).toEqual({ x: 25, y: 20 })
    expect({
      x: currentTarget.position.x + relativePosition.x,
      y: currentTarget.position.y + relativePosition.y,
    }).toEqual({ x: 225, y: 110 })
  })

  it('uses absolute sample positions when trail rendering has no target frame', () => {
    const sampledEarth = createBody('earth', { x: 100, y: 50 })
    const point = createSpacecraftTrailPoint({
      bodies: [sampledEarth],
      elapsed: 0,
      spacecraftPosition: { x: 125, y: 70 },
    })

    expect(getSpacecraftTrailRenderPosition(point, null)).toEqual({
      x: 125,
      y: 70,
    })
    expect(getSpacecraftTrailRenderPosition(point, sampledEarth)).toEqual({
      x: 25,
      y: 20,
    })
  })

  it('trims repeated target-bound orbits to roughly the latest two loops', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = createOrbitTrailPoints(earth, 2.5, Math.PI / 2)
    const result = updateSpacecraftTrailPoints(trailPoints, {
      bodies: [earth],
      elapsed: 100,
      spacecraftPosition: trailPoints.at(-1)?.position ?? { x: 0, y: 0 },
      target: earth,
      trimAroundTarget: true,
    })

    expect(result.trailPoints.length).toBeLessThan(trailPoints.length)
    expect(result.trailPoints[0].position.x).toBeCloseTo(-10_000_000)
    expect(result.trailPoints.at(-1)?.position.x).toBeCloseTo(-10_000_000)
  })

  it('preserves transfer context when orbit trimming is disabled', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = createOrbitTrailPoints(earth, 2.5, Math.PI / 2)
    const result = updateSpacecraftTrailPoints(trailPoints, {
      bodies: [earth],
      elapsed: 100,
      spacecraftPosition: trailPoints.at(-1)?.position ?? { x: 0, y: 0 },
      target: earth,
      trimAroundTarget: false,
    })

    expect(result.trailPoints).toHaveLength(trailPoints.length)
  })

  it('keeps trail point count bounded', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = Array.from(
      { length: spacecraftTrailMaxPoints + 5 },
      (_, index) =>
        createSpacecraftTrailPoint({
          bodies: [earth],
          elapsed: index,
          spacecraftPosition: { x: index * 3_000_000, y: 0 },
        }),
    )
    const result = updateSpacecraftTrailPoints(trailPoints, {
      bodies: [earth],
      elapsed: 1_000,
      spacecraftPosition: trailPoints.at(-1)?.position ?? { x: 0, y: 0 },
      target: earth,
      trimAroundTarget: false,
    })

    expect(result.trailPoints).toHaveLength(spacecraftTrailMaxPoints)
    expect(result.trailPoints[0].position.x).toBe(15_000_000)
  })

  it('captures trail points at the fixed dense spacing', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = [
      createSpacecraftTrailPoint({
        bodies: [earth],
        elapsed: 0,
        spacecraftPosition: { x: 0, y: 0 },
      }),
    ]

    const belowThreshold = updateSpacecraftTrailPoints(trailPoints, {
      bodies: [earth],
      elapsed: 1,
      spacecraftPosition: {
        x: spacecraftTrailCaptureMinSampleDistanceMeters - 1,
        y: 0,
      },
      target: earth,
      trimAroundTarget: false,
    })
    const aboveThreshold = updateSpacecraftTrailPoints(trailPoints, {
      bodies: [earth],
      elapsed: 1,
      spacecraftPosition: {
        x: spacecraftTrailCaptureMinSampleDistanceMeters,
        y: 0,
      },
      target: earth,
      trimAroundTarget: false,
    })

    expect(belowThreshold.trailPoints).toHaveLength(1)
    expect(aboveThreshold.trailPoints).toHaveLength(2)
  })

  it('decimates captured trail points for sparse rendering', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = [0, 400_000, 1_000_000, 1_400_000, 2_000_000].map(
      (x, index) =>
        createSpacecraftTrailPoint({
          bodies: [earth],
          elapsed: index,
          spacecraftPosition: { x, y: 0 },
        }),
    )

    const sparseRenderPoints = selectSpacecraftTrailRenderPoints(trailPoints, {
      renderSampleDistanceMeters: 1_000_000,
      target: earth,
    })
    const denseRenderPoints = selectSpacecraftTrailRenderPoints(trailPoints, {
      renderSampleDistanceMeters: 500_000,
      target: earth,
    })

    expect(sparseRenderPoints.map((point) => point.position.x)).toEqual([
      0, 1_000_000, 2_000_000,
    ])
    expect(denseRenderPoints.map((point) => point.position.x)).toEqual([
      0, 1_000_000, 2_000_000,
    ])
  })

  it('keeps intermediate render points when they reach the render spacing', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = [0, 400_000, 800_000, 1_200_000].map((x, index) =>
      createSpacecraftTrailPoint({
        bodies: [earth],
        elapsed: index,
        spacecraftPosition: { x, y: 0 },
      }),
    )

    const renderPoints = selectSpacecraftTrailRenderPoints(trailPoints, {
      renderSampleDistanceMeters: 500_000,
      target: earth,
    })

    expect(renderPoints.map((point) => point.position.x)).toEqual([
      0, 800_000, 1_200_000,
    ])
  })

  it('always includes the newest captured point when rendering', () => {
    const earth = createBody('earth', { x: 0, y: 0 })
    const trailPoints = [0, 2_100_000, 2_200_000].map((x, index) =>
      createSpacecraftTrailPoint({
        bodies: [earth],
        elapsed: index,
        spacecraftPosition: { x, y: 0 },
      }),
    )

    const renderPoints = selectSpacecraftTrailRenderPoints(trailPoints, {
      renderSampleDistanceMeters: 2_000_000,
      target: earth,
    })

    expect(renderPoints.map((point) => point.position.x)).toEqual([
      0, 2_100_000, 2_200_000,
    ])
  })

  it('decimates transfer render points by absolute position without a target frame', () => {
    const moon = createBody('moon', { x: 100_000_000, y: 0 })
    const trailPoints = [0, 1_000_000, 2_000_000].map((x, index) => ({
      elapsed: index,
      position: { x, y: 0 },
      targetRelativePositions: {
        moon: { x: 0, y: 0 },
      },
    }))

    const inertialRenderPoints = selectSpacecraftTrailRenderPoints(
      trailPoints,
      {
        renderSampleDistanceMeters: 1_000_000,
        target: null,
      },
    )
    const targetRelativeRenderPoints = selectSpacecraftTrailRenderPoints(
      trailPoints,
      {
        renderSampleDistanceMeters: 1_000_000,
        target: moon,
      },
    )

    expect(inertialRenderPoints.map((point) => point.position.x)).toEqual([
      0, 1_000_000, 2_000_000,
    ])
    expect(targetRelativeRenderPoints.map((point) => point.position.x)).toEqual(
      [0, 2_000_000],
    )
  })

  it('interpolates trail density between viewport stops', () => {
    expect(getSpacecraftTrailRenderSampleDistanceMeters(1000)).toBe(12_000_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(750)).toBe(10_000_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(250)).toBe(4_000_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(150)).toBeCloseTo(
      2_666_666.67,
      2,
    )
    expect(getSpacecraftTrailRenderSampleDistanceMeters(100)).toBe(2_000_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(40)).toBe(750_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(15)).toBe(250_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(10)).toBe(250_000)
    expect(getSpacecraftTrailRenderSampleDistanceMeters(1500)).toBe(12_000_000)
  })

  it('reports the active trail detail level for the current viewport', () => {
    expect(getSpacecraftTrailDetail(150)).toEqual({
      captureSampleDistanceMeters: 250_000,
      label: 'wide',
      level: 3,
      levelCount: 7,
      renderSampleDistanceMeters: 2_666_666.6666666665,
    })
    const closeDetail = getSpacecraftTrailDetail(25)
    expect(closeDetail).toMatchObject({
      captureSampleDistanceMeters: 250_000,
      label: 'close',
      level: 6,
      levelCount: 7,
    })
    expect(closeDetail.renderSampleDistanceMeters).toBeCloseTo(416_666.67, 2)
    expect(getSpacecraftTrailDetail(10)).toEqual({
      captureSampleDistanceMeters: 250_000,
      label: 'inspection',
      level: 7,
      levelCount: 7,
      renderSampleDistanceMeters: 250_000,
    })
  })
})

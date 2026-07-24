import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import {
  createBodyDistanceContext,
  getBodySurfaceDistanceMeters,
} from '@/presentation/bodyDistanceContext'
import { EARTH_MASS, EARTH_RADIUS, G } from '@/simulation/constants'
import type { Body, SimulationState, Spacecraft } from '@/simulation/types'

const earth: Body = {
  color: '#2f80ed',
  id: 'earth',
  mass: EARTH_MASS,
  name: 'Earth',
  position: { x: 0, y: 0 },
  radius: EARTH_RADIUS,
  velocity: { x: 0, y: 0 },
}

const createSpacecraft = (overrides: Partial<Spacecraft> = {}): Spacecraft => ({
  dryMass: 10_000,
  fuel: 1,
  fuelCapacity: 1,
  fuelMass: 8_000,
  fuelUsed: 0,
  heading: 0,
  position: { x: EARTH_RADIUS + 400_000, y: 0 },
  velocity: {
    x: 0,
    y: Math.sqrt((G * EARTH_MASS) / (EARTH_RADIUS + 400_000)),
  },
  ...overrides,
})

const createState = (spacecraft: Spacecraft): SimulationState => ({
  bodies: [earth],
  controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
  elapsed: 0,
  spacecraft,
})

describe('createBodyDistanceContext', () => {
  it('measures physical spacecraft-to-surface distance and clamps interiors', () => {
    expect(
      getBodySurfaceDistanceMeters(earth, {
        x: EARTH_RADIUS + 84_000_000,
        y: 0,
      }),
    ).toBe(84_000_000)
    expect(getBodySurfaceDistanceMeters(earth, { x: 0, y: 0 })).toBe(0)
  })

  it('formats body name and altitude context', () => {
    const spacecraft = createSpacecraft()
    const targetMetrics = getCaptureMetricsForState(
      createState(spacecraft),
      earth,
    )

    const distanceContext = createBodyDistanceContext({
      target: earth,
      targetMetrics,
    })

    expect(distanceContext).toMatchObject({
      altitudeLabel: '400 km',
      bodyId: 'earth',
      detailAccessibleLabel: 'altitude 400 km',
    })
  })

  it('formats megameter altitude context', () => {
    const spacecraft = createSpacecraft({
      position: { x: EARTH_RADIUS + 84_000_000, y: 0 },
    })
    const targetMetrics = getCaptureMetricsForState(
      createState(spacecraft),
      earth,
    )

    expect(
      createBodyDistanceContext({
        target: earth,
        targetMetrics,
      }),
    ).toMatchObject({
      altitudeLabel: '84 Mm',
      detailAccessibleLabel: 'altitude 84 Mm',
    })
  })
})

import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import { createBodyDistanceContext } from '@/presentation/bodyDistanceContext'
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
  it('formats altitude with bound periapsis and apoapsis context', () => {
    const spacecraft = createSpacecraft()
    const targetMetrics = getCaptureMetricsForState(
      createState(spacecraft),
      earth,
    )

    expect(
      createBodyDistanceContext({
        predictedClosestApproach: null,
        spacecraft,
        target: earth,
        targetMetrics,
      }),
    ).toMatchObject({
      accessibleLabel:
        'Earth, altitude 400 km, closest point 400 km, farthest point 400 km',
      altitudeLabel: 'alt 400 km',
      bodyId: 'earth',
      detailAccessibleLabel:
        'altitude 400 km, closest point 400 km, farthest point 400 km',
      tooltipLabel: 'Earth · alt 400 km · Pe 400 km · Ap 400 km',
    })
  })

  it('omits apoapsis for unbound flyby context', () => {
    const spacecraft = createSpacecraft({
      position: { x: EARTH_RADIUS + 84_000_000, y: 0 },
      velocity: { x: 0, y: 12_000 },
    })
    const targetMetrics = getCaptureMetricsForState(
      createState(spacecraft),
      earth,
    )

    expect(
      createBodyDistanceContext({
        predictedClosestApproach: {
          altitude: 42_000_000,
          bodyName: 'Earth',
          time: 3_600,
        },
        spacecraft,
        target: earth,
        targetMetrics: {
          ...targetMetrics,
          specificEnergy: Math.abs(targetMetrics.specificEnergy),
        },
      }).tooltipLabel,
    ).toBe('Earth · alt 84 Mm · Pe 42 Mm')
  })

  it('uses analytic periapsis for unbound flyby context when prediction is unavailable', () => {
    const spacecraft = createSpacecraft({
      position: { x: EARTH_RADIUS + 84_000_000, y: 0 },
      velocity: { x: 0, y: 12_000 },
    })
    const targetMetrics = getCaptureMetricsForState(
      createState(spacecraft),
      earth,
    )

    const context = createBodyDistanceContext({
      predictedClosestApproach: null,
      spacecraft,
      target: earth,
      targetMetrics: {
        ...targetMetrics,
        specificEnergy: Math.abs(targetMetrics.specificEnergy),
      },
    })

    expect(context.tooltipLabel).toContain('Pe ')
    expect(context.tooltipLabel).not.toContain(' Ap ')
  })
})

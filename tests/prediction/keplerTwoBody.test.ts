import { describe, expect, it } from 'vitest'

import {
  computeKeplerTwoBodyTrajectoryPrediction,
  propagateKeplerTwoBody,
} from '@/prediction/keplerTwoBody'
import { EARTH_MASS, EARTH_RADIUS, G } from '@/simulation/constants'
import { idleControls } from '@/simulation/state'
import type { Body, SimulationState } from '@/simulation/types'
import { length } from '@/simulation/vector'

const earth: Body = {
  id: 'earth',
  name: 'Earth',
  mass: EARTH_MASS,
  radius: EARTH_RADIUS,
  position: { x: 1_000_000, y: -2_000_000 },
  velocity: { x: 120, y: -80 },
  color: '#fff',
}

const orbitRadius = EARTH_RADIUS + 400_000
const orbitSpeed = Math.sqrt((G * EARTH_MASS) / orbitRadius)
const spacecraft = {
  position: {
    x: earth.position.x + orbitRadius,
    y: earth.position.y,
  },
  velocity: {
    x: earth.velocity.x,
    y: earth.velocity.y + orbitSpeed,
  },
  dryMass: 10_000,
}

const createState = (
  predictionSpacecraft: typeof spacecraft = spacecraft,
): SimulationState => ({
  bodies: [earth],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    ...predictionSpacecraft,
    fuel: 1,
    fuelCapacity: 0,
    fuelMass: 0,
    fuelUsed: 0,
    heading: 0,
  },
})

const createPredictionConfig = (
  horizonSeconds: number,
  stepSeconds: number,
) => ({
  horizonSeconds,
  maxIntegrationStepSeconds: stepSeconds,
  maxLoopRevolutions: 2.5,
  refreshInterval: 0.4,
  stepSeconds,
})

describe('propagateKeplerTwoBody', () => {
  it('preserves the initial state at zero elapsed time', () => {
    expect(propagateKeplerTwoBody(earth, spacecraft, 0)).toEqual({
      position: spacecraft.position,
      velocity: spacecraft.velocity,
    })
  })

  it('returns to the same circular orbit after one orbital period', () => {
    const stationaryEarth = { ...earth, velocity: { x: 0, y: 0 } }
    const stationarySpacecraft = {
      ...spacecraft,
      velocity: { x: 0, y: orbitSpeed },
    }
    const period = 2 * Math.PI * Math.sqrt(orbitRadius ** 3 / (G * earth.mass))
    const propagated = propagateKeplerTwoBody(
      stationaryEarth,
      stationarySpacecraft,
      period,
    )

    expect(
      length({
        x: propagated.position.x - stationarySpacecraft.position.x,
        y: propagated.position.y - stationarySpacecraft.position.y,
      }),
    ).toBeLessThan(1e-3)
    expect(
      length({
        x: propagated.velocity.x - stationarySpacecraft.velocity.x,
        y: propagated.velocity.y - stationarySpacecraft.velocity.y,
      }),
    ).toBeLessThan(1e-6)
  })

  it('moves with a translating central body', () => {
    const propagated = propagateKeplerTwoBody(earth, spacecraft, 1_000)
    const earthShift = {
      x: earth.position.x + earth.velocity.x * 1_000,
      y: earth.position.y + earth.velocity.y * 1_000,
    }

    expect(propagated.position.x).not.toBe(earthShift.x)
    expect(
      length({
        x: propagated.position.x - earthShift.x,
        y: propagated.position.y - earthShift.y,
      }),
    ).toBeCloseTo(orbitRadius, -2)
  })
})

describe('computeKeplerTwoBodyTrajectoryPrediction', () => {
  it('samples a complete closed orbit even when its period exceeds the horizon', () => {
    const period = 2 * Math.PI * Math.sqrt(orbitRadius ** 3 / (G * earth.mass))
    const computation = computeKeplerTwoBodyTrajectoryPrediction(
      createState(),
      earth,
      createPredictionConfig(600, 300),
    )
    const lastPoint = computation.result.relativePoints.at(-1)
    const firstPoint = computation.result.relativePoints[0]
    const initialRelativePosition = {
      x: spacecraft.position.x - earth.position.x,
      y: spacecraft.position.y - earth.position.y,
    }

    expect(computation.terminationReason).toBe('closed-orbit')
    expect(computation.predictionTime).toBeCloseTo(period, 8)
    expect(computation.result.relativePoints.length).toBeGreaterThanOrEqual(128)
    expect(computation.result.absolutePoints).toHaveLength(
      computation.result.relativePoints.length + 1,
    )
    expect(firstPoint).not.toEqual(initialRelativePosition)
    expect(lastPoint).toBeDefined()
    expect(
      length({
        x: (lastPoint?.x ?? 0) - initialRelativePosition.x,
        y: (lastPoint?.y ?? 0) - initialRelativePosition.y,
      }),
    ).toBeLessThan(1e-3)
  })

  it('keeps an intersecting bound orbit as an impact trajectory', () => {
    const impactSpacecraft = {
      ...spacecraft,
      velocity: {
        x: earth.velocity.x,
        y: earth.velocity.y + orbitSpeed * 0.75,
      },
    }
    const computation = computeKeplerTwoBodyTrajectoryPrediction(
      createState(impactSpacecraft),
      earth,
      createPredictionConfig(3_600, 10),
    )

    expect(computation.terminationReason).toBe('impact')
    expect(computation.result.impact).toMatchObject({
      bodyName: earth.name,
    })
    expect(computation.predictionTime).toBeLessThan(3_600)
  })

  it('keeps an escape path open and horizon-bounded', () => {
    const escapeSpeed = Math.sqrt((2 * G * earth.mass) / orbitRadius)
    const escapeSpacecraft = {
      ...spacecraft,
      velocity: {
        x: earth.velocity.x,
        y: earth.velocity.y + escapeSpeed * 1.01,
      },
    }
    const computation = computeKeplerTwoBodyTrajectoryPrediction(
      createState(escapeSpacecraft),
      earth,
      createPredictionConfig(600, 60),
    )

    expect(computation.terminationReason).toBe('horizon')
    expect(computation.predictionTime).toBe(600)
    expect(computation.result.relativePoints).toHaveLength(10)
  })
})

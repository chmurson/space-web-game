import { describe, expect, it } from 'vitest'

import {
  computeKeplerTwoBodyTrajectoryPrediction,
  propagateKeplerTwoBody,
  sampleKeplerTwoBodyTrajectory,
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

const createCircularOrbitState = (): SimulationState => ({
  bodies: [{ ...earth, velocity: { x: 0, y: 0 } }],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    ...spacecraft,
    fuel: 1,
    fuelCapacity: 1,
    fuelMass: 1,
    fuelUsed: 0,
    heading: 0,
    velocity: { x: 0, y: orbitSpeed },
  },
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

  it('returns a best-effort finite state when iteration does not converge', () => {
    const propagated = propagateKeplerTwoBody(
      earth,
      {
        dryMass: spacecraft.dryMass,
        position: spacecraft.position,
        velocity: {
          x: earth.velocity.x - 11_000,
          y: earth.velocity.y,
        },
      },
      1_000_000,
    )

    expect(Number.isFinite(propagated.position.x)).toBe(true)
    expect(Number.isFinite(propagated.position.y)).toBe(true)
    expect(Number.isFinite(propagated.velocity.x)).toBe(true)
    expect(Number.isFinite(propagated.velocity.y)).toBe(true)
  })
})

describe('sampleKeplerTwoBodyTrajectory', () => {
  it.each([0, -1])('rejects a non-positive sample step (%s)', (sampleStep) => {
    expect(() =>
      sampleKeplerTwoBodyTrajectory(earth, spacecraft, 60, sampleStep),
    ).toThrow('sampleStepSeconds must be positive')
  })
})

describe('computeKeplerTwoBodyTrajectoryPrediction', () => {
  it('honors the configured loop limit only when loop trimming is allowed', () => {
    const state = createCircularOrbitState()
    const target = state.bodies[0]
    if (!target) {
      throw new Error('Expected circular-orbit target')
    }
    const orbitalPeriod =
      2 * Math.PI * Math.sqrt(orbitRadius ** 3 / (G * earth.mass))
    const stepSeconds = orbitalPeriod / 32
    const predictionConfig = {
      horizonSeconds: orbitalPeriod * 2,
      maxIntegrationStepSeconds: stepSeconds,
      maxLoopRevolutions: 0.5,
      refreshInterval: 0.4,
      stepSeconds,
    }

    const trimmed = computeKeplerTwoBodyTrajectoryPrediction(
      state,
      target,
      predictionConfig,
      true,
    )
    const untrimmed = computeKeplerTwoBodyTrajectoryPrediction(
      state,
      target,
      predictionConfig,
      false,
    )

    expect(trimmed.terminationReason).toBe('loop-limit')
    expect(trimmed.predictionTime).toBeLessThan(
      orbitalPeriod / 2 + stepSeconds * 1.1,
    )
    expect(trimmed.predictionTime).toBeLessThan(predictionConfig.horizonSeconds)
    expect(untrimmed.terminationReason).toBe('horizon')
    expect(untrimmed.predictionTime).toBeCloseTo(
      predictionConfig.horizonSeconds,
      6,
    )
  })
})

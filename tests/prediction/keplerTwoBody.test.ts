import { describe, expect, it } from 'vitest'

import {
  computeKeplerTwoBodyTrajectoryPrediction,
  propagateKeplerTwoBody,
  sampleKeplerTwoBodyTrajectory,
} from '@/prediction/keplerTwoBody'
import { EARTH_MASS, EARTH_RADIUS, G } from '@/simulation/constants'
import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
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
  body: Body,
  coastSpacecraft = spacecraft,
): SimulationState => ({
  bodies: [body],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    ...coastSpacecraft,
    fuel: 0,
    fuelCapacity: 0,
    fuelMass: 0,
    fuelUsed: 0,
    heading: 0,
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
  it.each([
    0, -1,
  ])('preserves non-positive step validation (%s)', (stepSeconds) => {
    expect(() =>
      computeKeplerTwoBodyTrajectoryPrediction(
        createState(earth),
        earth,
        {
          horizonSeconds: 60,
          maxIntegrationStepSeconds: 60,
          maxLoopRevolutions: 1,
          refreshInterval: 0.4,
          stepSeconds,
        },
        false,
        semiImplicitEuler,
      ),
    ).toThrow('sampleStepSeconds must be positive')
  })

  it('honors loop trimming and the configured revolution limit', () => {
    const stationaryEarth = { ...earth, velocity: { x: 0, y: 0 } }
    const stationarySpacecraft = {
      ...spacecraft,
      velocity: { x: 0, y: orbitSpeed },
    }
    const state = createState(stationaryEarth, stationarySpacecraft)
    const period = 2 * Math.PI * Math.sqrt(orbitRadius ** 3 / (G * earth.mass))
    const baseConfig = {
      horizonSeconds: period * 4,
      maxIntegrationStepSeconds: 60,
      maxLoopRevolutions: 1,
      refreshInterval: 0.4,
      stepSeconds: period / 64,
    }

    const untrimmed = computeKeplerTwoBodyTrajectoryPrediction(
      state,
      stationaryEarth,
      baseConfig,
      false,
      semiImplicitEuler,
    )
    const oneLoop = computeKeplerTwoBodyTrajectoryPrediction(
      state,
      stationaryEarth,
      baseConfig,
      true,
      semiImplicitEuler,
    )
    const twoLoops = computeKeplerTwoBodyTrajectoryPrediction(
      state,
      stationaryEarth,
      { ...baseConfig, maxLoopRevolutions: 2 },
      true,
      semiImplicitEuler,
    )

    expect(untrimmed.terminationReason).toBe('horizon')
    expect(untrimmed.predictionTime).toBeCloseTo(baseConfig.horizonSeconds)
    expect(oneLoop.terminationReason).toBe('loop-limit')
    expect(oneLoop.predictionTime).toBeLessThan(untrimmed.predictionTime)
    expect(twoLoops.terminationReason).toBe('loop-limit')
    expect(twoLoops.predictionTime).toBeGreaterThan(oneLoop.predictionTime)
    expect(oneLoop.result.integration.stepCount).toBe(0)
    expect(twoLoops.result.integration.stepCount).toBe(0)
  })
})

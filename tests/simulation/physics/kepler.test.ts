import { describe, expect, it } from 'vitest'

import {
  getClosedKeplerTwoBodyOrbitPeriod,
  propagateKeplerTwoBody,
} from '@/prediction/keplerTwoBody'
import { physicsEngines } from '@/simulation/physics'
import { kepler } from '@/simulation/physics/kepler'
import {
  createEarthKeplerOrbitDebugScenario,
  createEarthMoonScenario,
} from '@/simulation/scenarios/earthMoon'
import { idleControls } from '@/simulation/state'
import type { Scenario, SimulationState } from '@/simulation/types'

const createState = (scenario: Scenario): SimulationState => ({
  bodies: scenario.bodies,
  controls: idleControls(),
  elapsed: 0,
  spacecraft: scenario.spacecraft,
})

const distance = (
  left: { x: number; y: number },
  right: { x: number; y: number },
) => Math.hypot(left.x - right.x, left.y - right.y)

describe('kepler physics engine', () => {
  it('is registered as a real one-body engine', () => {
    expect(physicsEngines.kepler).toBe(kepler)
    expect(kepler.name).toBe('Kepler two-body')
  })

  it('matches direct two-body propagation through one complete orbit', () => {
    const initialState = createState(createEarthKeplerOrbitDebugScenario())
    const body = initialState.bodies[0]
    if (!body) {
      throw new Error('Expected the one-body Kepler test scenario.')
    }
    const period = getClosedKeplerTwoBodyOrbitPeriod(
      body,
      initialState.spacecraft,
    )
    if (!period) {
      throw new Error('Expected a closed Kepler orbit.')
    }

    let liveState = initialState
    let maxPositionMismatch = 0
    while (liveState.elapsed + 1 < period) {
      const dt = 1
      liveState = kepler.step(liveState, dt)
      const predicted = propagateKeplerTwoBody(
        body,
        initialState.spacecraft,
        liveState.elapsed,
      )
      maxPositionMismatch = Math.max(
        maxPositionMismatch,
        distance(liveState.spacecraft.position, predicted.position),
      )
    }
    liveState = kepler.step(liveState, period - liveState.elapsed)

    expect(maxPositionMismatch).toBeLessThan(0.1)
    expect(
      distance(liveState.spacecraft.position, initialState.spacecraft.position),
    ).toBeLessThan(0.1)
    expect(
      distance(liveState.spacecraft.velocity, initialState.spacecraft.velocity),
    ).toBeLessThan(0.001)
  })

  it('applies thrust, turning, and finite-fuel accounting before propagation', () => {
    const state = createState(createEarthKeplerOrbitDebugScenario())
    state.controls = { main: 1, reverse: 0, strafe: 0, turn: 1 }
    state.spacecraft = {
      ...state.spacecraft,
      dryMass: 1_000,
      fuelCapacity: 14,
      fuelMass: 1_000,
      heading: 0,
    }
    const idleState = kepler.step({ ...state, controls: idleControls() }, 1)
    const controlledState = kepler.step(state, 1)

    expect(controlledState.spacecraft.heading).toBeCloseTo(0.45)
    expect(controlledState.spacecraft.fuel).toBeCloseTo(0.4)
    expect(controlledState.spacecraft.fuelUsed).toBeCloseTo(8.4)
    expect(
      distance(
        controlledState.spacecraft.velocity,
        idleState.spacecraft.velocity,
      ),
    ).toBeGreaterThan(20)
  })

  it('applies reverse and strafe input through the Kepler step', () => {
    const state = createState(createEarthKeplerOrbitDebugScenario())
    const dt = 0.1
    const idleState = kepler.step(state, dt)
    const controlledState = kepler.step(
      {
        ...state,
        controls: { main: 0, reverse: 1, strafe: 1, turn: 0 },
      },
      dt,
    )

    expect(
      controlledState.spacecraft.velocity.x - idleState.spacecraft.velocity.x,
    ).toBeCloseTo(0.138_889, 5)
    expect(
      controlledState.spacecraft.velocity.y - idleState.spacecraft.velocity.y,
    ).toBeCloseTo(-0.194_444, 5)
  })

  it('validates exactly one positive-mass body', () => {
    const multiBodyState = createState(createEarthMoonScenario())
    const zeroBodyState = { ...multiBodyState, bodies: [] }
    const validState = createState(createEarthKeplerOrbitDebugScenario())
    const validBody = validState.bodies[0]
    if (!validBody) {
      throw new Error('Expected a valid one-body Kepler state.')
    }
    const masslessBodyState = {
      ...validState,
      bodies: [{ ...validBody, mass: 0 }],
    }

    expect(() => kepler.validateState?.(validState)).not.toThrow()
    expect(() => kepler.validateState?.(multiBodyState)).toThrow(
      'The Kepler engine requires exactly one massive body.',
    )
    expect(() => kepler.validateState?.(masslessBodyState)).toThrow(
      'The Kepler engine requires exactly one massive body.',
    )
    expect(() => kepler.step(multiBodyState, 1)).toThrow(
      'The Kepler engine requires exactly one massive body.',
    )
    expect(() => kepler.step(zeroBodyState, 1)).toThrow(
      'The Kepler engine requires exactly one massive body.',
    )
  })
})

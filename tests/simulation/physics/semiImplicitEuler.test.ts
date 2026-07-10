import { describe, expect, it } from 'vitest'

import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
import type { ControlInput, SimulationState } from '@/simulation/types'

const createState = (
  overrides: {
    controls?: Partial<ControlInput>
    fuel?: number
    fuelCapacity?: number
    fuelMass?: number
  } = {},
): SimulationState => ({
  bodies: [],
  controls: { main: 0, reverse: 0, strafe: 0, turn: 1, ...overrides.controls },
  elapsed: 0,
  spacecraft: {
    dryMass: 1_000,
    fuel: overrides.fuel ?? 1,
    fuelCapacity: overrides.fuelCapacity ?? 0,
    fuelMass: overrides.fuelMass ?? 100,
    fuelUsed: 0,
    heading: 0,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
  },
})

describe('semiImplicitEuler', () => {
  it('keeps spacecraft heading normalized during repeated turning', () => {
    let state = createState()

    for (let index = 0; index < 5_000; index += 1) {
      state = semiImplicitEuler.step(state, 1)
    }

    expect(state.spacecraft.heading).toBeGreaterThanOrEqual(-Math.PI)
    expect(state.spacecraft.heading).toBeLessThanOrEqual(Math.PI)
  })

  it('consumes finite fuel for main thrust', () => {
    const state = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 0 },
        fuelCapacity: 14,
        fuelMass: 1_000,
      }),
      1,
    )

    expect(state.spacecraft.fuel).toBeCloseTo(0.5)
    expect(state.spacecraft.fuelUsed).toBeCloseTo(7)
    expect(state.spacecraft.velocity.x).toBeCloseTo(60)
  })

  it('consumes finite fuel for attitude turning', () => {
    const state = semiImplicitEuler.step(
      createState({
        controls: { main: 0, turn: 1 },
        fuelCapacity: 7,
      }),
      1,
    )

    expect(state.spacecraft.fuel).toBeCloseTo(0.8)
    expect(state.spacecraft.fuelUsed).toBeCloseTo(1.4)
    expect(state.spacecraft.heading).toBeCloseTo(0.9)
  })

  it('ramps angular velocity toward the requested turn speed', () => {
    const state = semiImplicitEuler.step(createState(), 0.1)

    expect(state.spacecraft.angularVelocity).toBeCloseTo(0.18)
    expect(state.spacecraft.heading).toBeCloseTo(0.018)
  })

  it('brakes immediately but lets angular velocity decay smoothly after release', () => {
    const turning = semiImplicitEuler.step(createState(), 0.2)
    const released = semiImplicitEuler.step(
      { ...turning, controls: { ...turning.controls, turn: 0 } },
      0.02,
    )

    expect(turning.spacecraft.angularVelocity).toBeCloseTo(0.36)
    expect(released.spacecraft.angularVelocity).toBeCloseTo(0.288)
    expect(released.spacecraft.heading).toBeGreaterThan(
      turning.spacecraft.heading,
    )
  })

  it('clamps finite fuel at zero and scales the final thrust frame', () => {
    const state = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 0 },
        fuel: 0.5,
        fuelCapacity: 7,
        fuelMass: 1_000,
      }),
      1,
    )

    expect(state.spacecraft.fuel).toBe(0)
    expect(state.spacecraft.fuelUsed).toBeCloseTo(3.5)
    expect(state.spacecraft.velocity.x).toBeCloseTo(40)
  })

  it('blocks thrust and turning when finite fuel is depleted', () => {
    const state = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 1 },
        fuel: 0,
        fuelCapacity: 14,
      }),
      1,
    )

    expect(state.spacecraft.fuel).toBe(0)
    expect(state.spacecraft.fuelUsed).toBe(0)
    expect(state.spacecraft.velocity.x).toBe(0)
    expect(state.spacecraft.heading).toBe(0)
  })

  it('keeps unlimited-fuel scenarios from consuming fuel', () => {
    const state = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 1 },
        fuelCapacity: 0,
      }),
      1,
    )

    expect(state.spacecraft.fuel).toBe(1)
    expect(state.spacecraft.fuelUsed).toBe(0)
    expect(state.spacecraft.heading).toBeCloseTo(0.9)
    expect(state.spacecraft.velocity.x).not.toBe(0)
  })

  it('accelerates more as finite fuel mass burns off', () => {
    const fullTank = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 0 },
        fuel: 1,
        fuelCapacity: 1_000,
        fuelMass: 1_000,
      }),
      1,
    )
    const halfTank = semiImplicitEuler.step(
      createState({
        controls: { main: 1, turn: 0 },
        fuel: 0.5,
        fuelCapacity: 1_000,
        fuelMass: 1_000,
      }),
      1,
    )

    expect(halfTank.spacecraft.velocity.x).toBeGreaterThan(
      fullTank.spacecraft.velocity.x,
    )
    expect(fullTank.spacecraft.velocity.x).toBeCloseTo(60)
    expect(halfTank.spacecraft.velocity.x).toBeCloseTo(80)
  })
})

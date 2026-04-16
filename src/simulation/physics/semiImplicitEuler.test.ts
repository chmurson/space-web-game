import { describe, expect, it } from 'vitest'

import { semiImplicitEuler } from './semiImplicitEuler'
import type { SimulationState } from '../types'

const createState = (): SimulationState => ({
  bodies: [],
  controls: { main: 0, reverse: 0, strafe: 0, turn: 1 },
  elapsed: 0,
  spacecraft: {
    dryMass: 1_000,
    fuel: 1,
    fuelCapacity: 1,
    fuelMass: 100,
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
})

import { describe, expect, it, vi } from 'vitest'

import { stepSimulationFrame } from '@/runtime/simulationStep'
import { EARTH_MASS, EARTH_RADIUS } from '@/simulation/constants'
import { kepler } from '@/simulation/physics/kepler'
import { idleControls } from '@/simulation/state'
import type { SimulationState } from '@/simulation/types'

const createState = (): SimulationState => ({
  bodies: [
    {
      color: '#2f80ed',
      id: 'earth',
      mass: EARTH_MASS,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: EARTH_RADIUS,
      velocity: { x: 0, y: 0 },
    },
  ],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    dryMass: 10_000,
    fuel: 1,
    fuelCapacity: 0,
    fuelMass: 8_000,
    fuelUsed: 0,
    heading: Math.PI,
    position: { x: EARTH_RADIUS + 400_000, y: 0 },
    velocity: { x: 0, y: 7_670 },
  },
})

const createStepOptions = (state: SimulationState) => ({
  assistMode: 'off' as const,
  autopilotRotationRate: 0.9,
  crashedBodyName: null,
  getAssistTarget: () => {
    const body = state.bodies[0]
    if (!body) {
      throw new Error('Expected a Kepler integration test body.')
    }
    return body
  },
  getAutopilotTurn: () => 0,
  getCaptureMetrics: () => ({
    circularSpeed: 0,
    distance: 0,
    insideRange: false,
    relativeSpeed: 0,
    roughAssistRange: 0,
    specificEnergy: 0,
    surfaceDistance: 0,
  }),
  getCircularizePlan: () => ({
    burnHeading: 0,
    deltaV: 0,
    desiredVelocityHeading: 0,
    distance: 0,
    radialSpeed: 0,
    tangentialSpeed: 0,
  }),
  keyboardInput: {
    clear: () => {},
    getManualControls: idleControls,
    hasManualTurn: () => false,
    press: () => {},
    release: () => {},
    setVirtualKey: () => {},
    setVirtualTurn: () => {},
  },
  maxControlWarp: 100,
  physicsEngine: kepler,
  realDt: 0.1,
  shouldCaptureBurn: () => false,
  state,
  targetHeading: null,
  timeWarpIndex: 1,
  timeWarps: [1, 10],
})

describe('Kepler runtime integration', () => {
  it('advances through the existing time-warp substep path', () => {
    const state = createState()
    const engineStep = vi.fn(kepler.step)
    const result = stepSimulationFrame({
      ...createStepOptions(state),
      physicsEngine: { ...kepler, step: engineStep },
      realDt: 0.25,
    })

    expect(result.timeWarpIndex).toBe(1)
    expect(result.state.elapsed).toBeCloseTo(2.5)
    expect(result.crashedBodyName).toBeNull()
    expect(engineStep.mock.calls.length).toBeGreaterThan(1)
    for (const [, dt] of engineStep.mock.calls) {
      expect(dt).toBeLessThanOrEqual(1)
    }
  })

  it('uses existing collision and crash freeze behavior', () => {
    const state = createState()
    state.spacecraft.position = { x: EARTH_RADIUS + 100, y: 0 }
    state.spacecraft.velocity = { x: -1_000, y: 0 }
    const crashResult = stepSimulationFrame({
      ...createStepOptions(state),
      realDt: 0.1,
      timeWarpIndex: 1,
    })

    expect(crashResult.crashedBodyName).toBe('Earth')
    expect(crashResult.state.controls).toEqual(idleControls())
    expect(crashResult.state.spacecraft.position).toEqual({
      x: EARTH_RADIUS,
      y: 0,
    })
    expect(crashResult.state.spacecraft.velocity).toEqual({ x: 0, y: 0 })

    const engineStep = vi.fn(kepler.step)
    const frozenResult = stepSimulationFrame({
      ...createStepOptions(crashResult.state),
      crashedBodyName: 'Earth',
      physicsEngine: { ...kepler, step: engineStep },
    })

    expect(engineStep).not.toHaveBeenCalled()
    expect(frozenResult.state.elapsed).toBe(crashResult.state.elapsed)
    expect(frozenResult.state.controls).toEqual(idleControls())
  })
})

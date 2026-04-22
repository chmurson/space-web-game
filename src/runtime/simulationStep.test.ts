import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from './appRuntimeState'
import {
  resolveSimulationTimeWarp,
  stepSimulationFrame,
} from './simulationStep'

const createRuntimeState = (): AppRuntimeState['simulation']['state'] => ({
  elapsed: 0,
  bodies: [
    {
      id: 'earth',
      name: 'Earth',
      mass: 5.9722e24,
      radius: 6_371_000,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      color: '#2f80ed',
    },
  ],
  controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
  spacecraft: {
    position: { x: 7_371_000, y: 0 },
    velocity: { x: 0, y: 7_500 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 10_000,
    fuelMass: 8_000,
    fuelCapacity: 32_000,
  },
})

describe('stepSimulationFrame', () => {
  it('reports an active-controls clamp when thrust keeps warp at 100x', () => {
    const result = resolveSimulationTimeWarp({
      assistMode: 'off',
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
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
        getManualControls: () => ({ main: 1, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
      },
      maxControlWarp: 100,
      maxTimeWarp: null,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: null,
      timeWarpIndex: 5,
      timeWarps: [1, 10, 50, 100, 500, 2000],
    })

    expect(result.reason).toBe('active-controls')
    expect(result.timeWarpIndex).toBe(3)
    expect(result.simulationControls.controls.main).toBe(1)
  })

  it('caps time warp when turning through target-heading guidance', () => {
    const result = stepSimulationFrame({
      assistMode: 'off',
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: () => 1,
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
        getManualControls: () => ({ main: 0, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
      },
      maxControlWarp: 100,
      physicsEngine: {
        name: 'test',
        step: (state) => state,
      },
      realDt: 1 / 60,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: Math.PI / 2,
      timeWarpIndex: 5,
      timeWarps: [1, 10, 50, 100, 500, 2000],
    })

    expect(result.timeWarpIndex).toBe(3)
  })

  it('clears the target heading once target-heading rotation completes', () => {
    const result = stepSimulationFrame({
      assistMode: 'off',
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
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
        getManualControls: () => ({ main: 0, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
      },
      maxControlWarp: 100,
      physicsEngine: {
        name: 'test',
        step: (state) => state,
      },
      realDt: 1 / 60,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: Math.PI / 2,
      timeWarpIndex: 0,
      timeWarps: [1, 10, 50, 100, 500, 2000],
    })

    expect(result.targetHeading).toBeNull()
    expect(result.state.controls.turn).toBe(0)
  })
})

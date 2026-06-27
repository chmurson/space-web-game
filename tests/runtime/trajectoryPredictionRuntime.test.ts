import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import { createTrajectoryPredictionRuntime } from '@/runtime/trajectoryPredictionRuntime'
import { idleControls } from '@/simulation/state'
import type { Body, PhysicsEngine, SimulationState } from '@/simulation/types'

const earth: Body = {
  id: 'earth',
  name: 'Earth',
  mass: 0,
  radius: 1,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#2f80ed',
}

const moon: Body = {
  id: 'moon',
  name: 'Moon',
  mass: 0,
  radius: 1,
  position: { x: 1_000, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#9aa0a6',
}

const createState = (): SimulationState => ({
  elapsed: 0,
  bodies: [earth, moon],
  controls: idleControls(),
  spacecraft: {
    position: { x: 10, y: 0 },
    velocity: { x: 10, y: 0 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 1,
    fuelMass: 1,
    fuelCapacity: 1,
  },
})

const physicsEngine: PhysicsEngine = {
  name: 'constant velocity',
  step: (state, dt) => ({
    ...state,
    elapsed: state.elapsed + dt,
    spacecraft: {
      ...state.spacecraft,
      position: {
        x: state.spacecraft.position.x + state.spacecraft.velocity.x * dt,
        y: state.spacecraft.position.y + state.spacecraft.velocity.y * dt,
      },
    },
  }),
}

describe('createTrajectoryPredictionRuntime', () => {
  it('refreshes immediately when the assist target changes', () => {
    const state = createState()
    const predictionRuntime = createTrajectoryPredictionRuntime()
    let target = earth
    const options = {
      assistMode: 'off' as const,
      getAssistPredictionControls: () => idleControls(),
      getAssistTarget: () => target,
      getCaptureMetrics: (body: Body) => getCaptureMetricsForState(state, body),
      physicsEngine,
      predictionConfig: {
        horizonSeconds: 10,
        maxIntegrationStepSeconds: 10,
        maxLoopRevolutions: 1,
        refreshInterval: 999,
        stepSeconds: 10,
      },
      state,
    }

    predictionRuntime.refresh(options)
    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'earth',
      targetRelativePredictionPoints: [{ x: 110, y: 0 }],
    })

    target = moon
    expect(predictionRuntime.maybeRefresh(0, options)).toBe(true)

    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'moon',
      targetRelativePredictionPoints: [{ x: -890, y: 0 }],
    })
  })
})

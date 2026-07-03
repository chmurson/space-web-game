import { describe, expect, it, vi } from 'vitest'

import type { AssistMode } from '@/assist/orbitalAssist'
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

const createPredictionConfig = () => ({
  horizonSeconds: 10,
  maxIntegrationStepSeconds: 10,
  maxLoopRevolutions: 1,
  refreshInterval: 999,
  stepSeconds: 10,
})

const createRuntimeHarness = () => {
  let assistMode: AssistMode = 'off'
  let state = createState()
  let target = earth
  const engineStep = vi.fn(physicsEngine.step)
  const engine: PhysicsEngine = {
    name: physicsEngine.name,
    step: engineStep,
  }
  const predictionRuntime = createTrajectoryPredictionRuntime()

  const getOptions = () => ({
    assistMode,
    getAssistPredictionControls: () => idleControls(),
    getAssistTarget: () => target,
    getCaptureMetrics: (body: Body) => getCaptureMetricsForState(state, body),
    physicsEngine: engine,
    predictionConfig: createPredictionConfig(),
    state,
  })

  return {
    engineStep,
    getOptions,
    predictionRuntime,
    setAssistMode: (nextAssistMode: AssistMode) => {
      assistMode = nextAssistMode
    },
    setState: (nextState: SimulationState) => {
      state = nextState
    },
    setTarget: (nextTarget: Body) => {
      target = nextTarget
    },
    state: () => state,
  }
}

describe('createTrajectoryPredictionRuntime', () => {
  it('refreshes immediately when the assist target changes', () => {
    const { getOptions, predictionRuntime, setTarget } = createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'earth',
      targetRelativePredictionPoints: [{ x: 110, y: 0 }],
    })

    setTarget(moon)
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'moon',
      targetRelativePredictionPoints: [{ x: -890, y: 0 }],
    })
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'target-change',
    )
  })

  it('skips unchanged prediction inputs before the refresh interval elapses', () => {
    const { engineStep, getOptions, predictionRuntime } = createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    const callCount = engineStep.mock.calls.length

    expect(predictionRuntime.maybeRefresh(0.1, getOptions())).toBe(false)
    expect(engineStep).toHaveBeenCalledTimes(callCount)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      absolutePointCount: 2,
      eventMarkerCount: 0,
      refreshReason: 'initial',
      relativePointCount: 1,
      sampleStepSeconds: 10,
    })
  })

  it('refreshes unchanged prediction inputs after the refresh interval elapses', () => {
    const { getOptions, predictionRuntime } = createRuntimeHarness()

    predictionRuntime.refresh(getOptions())

    expect(predictionRuntime.maybeRefresh(999, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'timed-refresh',
    )
  })

  it('refreshes when the prediction horizon changes', () => {
    const { getOptions, predictionRuntime } = createRuntimeHarness()
    const options = getOptions()
    predictionRuntime.refresh(options)

    expect(
      predictionRuntime.maybeRefresh(0, {
        ...options,
        predictionConfig: {
          ...options.predictionConfig,
          horizonSeconds: 20,
        },
      }),
    ).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'horizon-change',
    )
  })

  it('refreshes when spacecraft state changes materially', () => {
    const { getOptions, predictionRuntime, setState, state } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        position: { x: 250, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'spacecraft-change',
    )
  })

  it('refreshes when controls change materially', () => {
    const { getOptions, predictionRuntime, setState, state } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'controls-change',
    )
  })

  it('refreshes when assist mode changes', () => {
    const { getOptions, predictionRuntime, setAssistMode } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    setAssistMode('capture')

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'assist-change',
    )
  })

  it('refreshes when relevant body state changes', () => {
    const { getOptions, predictionRuntime, setState, state } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    setState({
      ...state(),
      bodies: [
        { ...earth, position: { x: 250, y: 0 } },
        state().bodies[1] ?? moon,
      ],
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'body-state-change',
    )
  })
})

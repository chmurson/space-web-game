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
  let predictionConfig = createPredictionConfig()
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
    predictionConfig,
    state,
  })

  return {
    engineStep,
    getOptions,
    predictionRuntime,
    setAssistMode: (nextAssistMode: AssistMode) => {
      assistMode = nextAssistMode
    },
    setPredictionConfig: (nextPredictionConfig: typeof predictionConfig) => {
      predictionConfig = nextPredictionConfig
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

const createLongHorizonPredictionConfig = () => ({
  horizonSeconds: 1_200,
  maxIntegrationStepSeconds: 300,
  maxLoopRevolutions: 1,
  refreshInterval: 999,
  stepSeconds: 300,
})

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

  it('reports refreshes from the last second', () => {
    const { getOptions, predictionRuntime, setTarget } = createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      predictionRuntime.refresh(getOptions())
      expect(predictionRuntime.getDiagnostics().refreshCountLastSecond).toBe(1)

      now = 500
      setTarget(moon)
      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
      expect(predictionRuntime.getDiagnostics().refreshCountLastSecond).toBe(2)

      now = 1_499
      expect(predictionRuntime.getDiagnostics().refreshCountLastSecond).toBe(1)

      now = 1_501
      expect(predictionRuntime.getDiagnostics().refreshCountLastSecond).toBe(0)
    } finally {
      nowSpy.mockRestore()
    }
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
        position: { x: 6_000, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'spacecraft-change',
    )
  })

  it('keeps normal spacecraft drift on the timed refresh cadence', () => {
    const { engineStep, getOptions, predictionRuntime, setState, state } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())
    const callCount = engineStep.mock.calls.length
    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        position: { x: 2_400, y: 0 },
        velocity: { x: 12, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0.1, getOptions())).toBe(false)
    expect(engineStep).toHaveBeenCalledTimes(callCount)
    expect(predictionRuntime.maybeRefresh(999, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'timed-refresh',
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
        { ...earth, position: { x: 6_000, y: 0 } },
        state().bodies[1] ?? moon,
      ],
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'body-state-change',
    )
  })

  it('keeps short horizons on the single-tier prediction path', () => {
    const { getOptions, predictionRuntime } = createRuntimeHarness()

    predictionRuntime.refresh(getOptions())

    expect(predictionRuntime.getState()).toMatchObject({
      absolutePredictionPoints: [
        { x: 10, y: 0 },
        { x: 110, y: 0 },
      ],
      targetRelativePredictionEnd: { x: 110, y: 0 },
      targetRelativePredictionPoints: [{ x: 110, y: 0 }],
    })
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      absolutePointCount: 2,
      horizonSeconds: 10,
      relativePointCount: 1,
    })
  })

  it('refreshes the near horizon first and keeps the previous far tier visible', () => {
    const {
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.refresh(getOptions())
    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 3_010, y: 0 },
        { x: 6_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 6_010, y: 0 },
        { x: 12_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      horizonSeconds: 1_200,
      refreshReason: 'spacecraft-change',
      relativePointCount: 4,
    })
  })

  it('applies the pending far tier only for the current prediction inputs', () => {
    const {
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 30, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 9_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 9_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 27_010, y: 0 },
        { x: 36_010, y: 0 },
      ],
    )
  })
})

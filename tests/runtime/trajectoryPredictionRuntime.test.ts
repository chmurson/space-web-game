import { describe, expect, it, vi } from 'vitest'

import type { AssistMode } from '@/assist/orbitalAssist'
import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import type {
  FarTrajectoryPredictionRequestPayload,
  FarTrajectoryPredictionResultPayload,
} from '@/prediction/farTrajectoryPrediction'
import { createTrajectoryPredictionRuntime } from '@/runtime/trajectoryPredictionRuntime'
import type {
  TrajectoryPredictionFarWorkerClientFactory,
  TrajectoryPredictionFarWorkerClientHandlers,
} from '@/runtime/trajectoryPredictionWorkerClient'
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

type FakeFarWorkerClient = {
  handlers: TrajectoryPredictionFarWorkerClientHandlers
  requests: FarTrajectoryPredictionRequestPayload[]
  terminated: boolean
}

const createFarWorkerResult = (
  request: FarTrajectoryPredictionRequestPayload,
  calculationMs = 4,
): FarTrajectoryPredictionResultPayload => {
  const target = request.state.bodies.find(
    (body) => body.id === request.targetId,
  )
  if (!target) {
    throw new Error(`Missing target ${request.targetId}`)
  }

  const absolutePoints = [{ ...request.state.spacecraft.position }]
  const relativePoints: Array<{ x: number; y: number }> = []
  const stepDurations: number[] = []
  let predictionTime = 0

  while (predictionTime < request.predictionConfig.horizonSeconds) {
    const nextPredictionTime = Math.min(
      predictionTime + request.predictionConfig.stepSeconds,
      request.predictionConfig.horizonSeconds,
    )
    const dt = nextPredictionTime - predictionTime
    predictionTime = nextPredictionTime
    stepDurations.push(dt)

    const absolutePoint = {
      x:
        request.state.spacecraft.position.x +
        request.state.spacecraft.velocity.x * predictionTime,
      y:
        request.state.spacecraft.position.y +
        request.state.spacecraft.velocity.y * predictionTime,
    }
    absolutePoints.push(absolutePoint)
    relativePoints.push({
      x: absolutePoint.x - target.position.x,
      y: absolutePoint.y - target.position.y,
    })
  }

  return {
    assistedPoints: [],
    calculationMs,
    coastPrediction: {
      absoluteEndPoint: absolutePoints.at(-1) ?? null,
      absolutePoints,
      closestApproach: null,
      eventMarkers: [],
      impact: null,
      integration: {
        averageStepSeconds:
          stepDurations.reduce((total, dt) => total + dt, 0) /
          stepDurations.length,
        minStepSeconds: Math.min(...stepDurations),
        stepCount: stepDurations.length,
      },
      relativePoints,
    },
    inputKey: request.inputKey,
    jobId: request.jobId,
    semanticInputKey: request.semanticInputKey,
    targetId: request.targetId,
  }
}

const createFarWorkerHarness = () => {
  const clients: FakeFarWorkerClient[] = []
  const createFarWorkerClient =
    vi.fn<TrajectoryPredictionFarWorkerClientFactory>((handlers) => {
      const client: FakeFarWorkerClient = {
        handlers,
        requests: [],
        terminated: false,
      }
      clients.push(client)

      return {
        postRequest: (request) => {
          client.requests.push(request)
        },
        terminate: () => {
          client.terminated = true
        },
      }
    })
  const getClient = (index: number) => {
    const client = clients[index]
    if (!client) {
      throw new Error(`Missing fake worker client ${index}`)
    }
    return client
  }
  const getRequest = (clientIndex: number, requestIndex: number) => {
    const request = getClient(clientIndex).requests[requestIndex]
    if (!request) {
      throw new Error(
        `Missing fake worker request ${clientIndex}/${requestIndex}`,
      )
    }
    return request
  }

  return {
    clients,
    completeRequest: (
      clientIndex: number,
      requestIndex: number,
      calculationMs?: number,
    ) => {
      const request = getRequest(clientIndex, requestIndex)
      getClient(clientIndex).handlers.handleResult(
        createFarWorkerResult(request, calculationMs),
      )
    },
    createFarWorkerClient,
    failRequest: (clientIndex: number, requestIndex: number) => {
      const request = getRequest(clientIndex, requestIndex)
      getClient(clientIndex).handlers.handleError({
        jobId: request.jobId,
        message: 'worker failed',
      })
    },
    getRequest,
  }
}

const createRuntimeHarness = () => {
  let assistMode: AssistMode = 'off'
  let predictionConfig = createPredictionConfig()
  let state = createState()
  let target = earth
  let timeWarp = 1
  const farWorker = createFarWorkerHarness()
  const engineStep = vi.fn(physicsEngine.step)
  const engine: PhysicsEngine = {
    name: physicsEngine.name,
    step: engineStep,
  }
  const predictionRuntime = createTrajectoryPredictionRuntime({
    createFarWorkerClient: farWorker.createFarWorkerClient,
  })

  const getOptions = () => ({
    assistMode,
    autopilotRotationRate: 0.9,
    getAssistPredictionControls: () => idleControls(),
    getAssistTarget: () => target,
    getCaptureMetrics: (body: Body) => getCaptureMetricsForState(state, body),
    physicsEngine: engine,
    predictionConfig,
    state,
    timeWarp,
  })

  return {
    engineStep,
    farWorker,
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
    setTimeWarp: (nextTimeWarp: number) => {
      timeWarp = nextTimeWarp
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
    const eventCount = predictionRuntime.getDiagnostics().events.length

    expect(predictionRuntime.maybeRefresh(0.1, getOptions())).toBe(false)
    expect(engineStep).toHaveBeenCalledTimes(callCount)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      absolutePointCount: 2,
      events: expect.arrayContaining([
        expect.objectContaining({
          event: 'refresh',
          farApplied: false,
          farVisible: 'none',
          splitHorizon: false,
        }),
      ]),
      eventMarkerCount: 0,
      refreshReason: 'initial',
      relativePointCount: 1,
      sampleStepSeconds: 10,
    })
    expect(predictionRuntime.getDiagnostics().events).toHaveLength(eventCount)
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

  it('caps the diagnostic event log at the most recent 100 entries', () => {
    const { getOptions, predictionRuntime, setPredictionConfig } =
      createRuntimeHarness()

    predictionRuntime.refresh(getOptions())

    for (let index = 0; index < 105; index += 1) {
      setPredictionConfig({
        ...createPredictionConfig(),
        horizonSeconds: 20 + index,
      })
      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    }

    expect(predictionRuntime.getDiagnostics().events).toHaveLength(100)
    expect(predictionRuntime.getDiagnostics().events[0]).toMatchObject({
      reason: 'horizon-change',
    })
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
    expect(predictionRuntime.getDiagnostics().nearCalculationTravel).toEqual({
      distanceSinceCalculationMeters: 2_390,
      horizonDistanceMeters: 100,
      horizonRatio: 23.9,
      lastCalculationGapMeters: null,
      lastCalculationGapRatio: null,
      lastStepDistanceMeters: 2_390,
      lastStepHorizonRatio: 23.9,
    })
    expect(predictionRuntime.maybeRefresh(999, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
      'timed-refresh',
    )
    expect(predictionRuntime.getDiagnostics().nearCalculationTravel).toEqual({
      distanceSinceCalculationMeters: 0,
      horizonDistanceMeters: 120,
      horizonRatio: 0,
      lastCalculationGapMeters: 2_390,
      lastCalculationGapRatio: 23.9,
      lastStepDistanceMeters: 0,
      lastStepHorizonRatio: 0,
    })
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

  it('queues the far horizon in a worker with a lean serializable payload', () => {
    const {
      engineStep,
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())

    predictionRuntime.refresh(getOptions())

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 3_010, y: 0 },
        { x: 6_010, y: 0 },
      ],
    )
    expect(engineStep).toHaveBeenCalledTimes(2)
    expect(farWorker.createFarWorkerClient).toHaveBeenCalledTimes(1)
    const request = farWorker.getRequest(0, 0)
    expect(Object.keys(request).sort()).toEqual([
      'assistMode',
      'autopilotRotationRate',
      'inputKey',
      'jobId',
      'predictionConfig',
      'semanticInputKey',
      'state',
      'targetId',
    ])
    expect(request).toMatchObject({
      assistMode: 'off',
      autopilotRotationRate: 0.9,
      jobId: 1,
      predictionConfig: createLongHorizonPredictionConfig(),
      targetId: 'earth',
    })
    expect(request.state.bodies[0]).toEqual({
      id: 'earth',
      mass: 0,
      name: 'Earth',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    })
    expect('color' in request.state.bodies[0]).toBe(false)
    expect('physicsEngine' in request).toBe(false)
    expect('getAssistPredictionControls' in request).toBe(false)
    expect('target' in request).toBe(false)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationMs: null,
      farPointCount: 0,
      farVisible: 'none',
      hasFarTier: false,
      nearPointCount: 2,
      pendingFar: false,
      splitHorizon: true,
    })

    farWorker.completeRequest(0, 0)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 3_010, y: 0 },
        { x: 6_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farCalculationAverageMs: 4,
      farCalculationMs: 4,
      farCalculationSampleCount: 1,
      farPointCount: 4,
      farVisible: 'current',
      hasFarTier: true,
      nearPointCount: 2,
      relativePointCount: 4,
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: false,
      changedParts: [],
      event: 'far-complete',
      farApplied: true,
      farCalculationMs: 4,
      farVisible: 'current',
      pendingFar: false,
    })
  })

  it('coalesces timed far requests while the cooldown override is active', () => {
    const { farWorker, getOptions, predictionRuntime, setPredictionConfig } =
      createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      setPredictionConfig(createLongHorizonPredictionConfig())
      expect(
        predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(10),
      ).toBe(true)

      predictionRuntime.refresh(getOptions())
      farWorker.completeRequest(0, 0)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCalculationSampleCount: 1,
        farCoalescingMinIntervalOverrideSeconds: 10,
        farCoalescingMinIntervalSeconds: 10,
        farCoalescingSkippedCount: 0,
      })

      now = 1_000
      expect(predictionRuntime.maybeRefresh(999, getOptions())).toBe(true)
      expect(farWorker.clients[0]?.requests).toHaveLength(1)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCoalescingLastSkipReason: 'cooldown',
        farCoalescingLastSkipStage: 'request',
        farCoalescingSkippedCount: 1,
        farVisible: 'current',
        refreshReason: 'timed-refresh',
      })

      now = 11_000
      expect(predictionRuntime.maybeRefresh(999, getOptions())).toBe(true)
      expect(farWorker.clients[0]?.requests).toHaveLength(2)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('uses a timewarp-only far cooldown while actively thrusting', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      setTimeWarp,
      state,
    } = createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      setPredictionConfig(createLongHorizonPredictionConfig())
      setTimeWarp(1)
      setState({
        ...state(),
        controls: { ...state().controls, main: 1 },
      })

      predictionRuntime.refresh(getOptions())
      farWorker.completeRequest(0, 0)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCalculationSampleCount: 1,
        farCoalescingMinIntervalSeconds: 1,
      })

      now = 500
      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          velocity: { x: 20, y: 0 },
        },
      })

      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
      expect(farWorker.clients[0]?.requests).toHaveLength(1)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCoalescingLastSkipReason: 'cooldown',
        farCoalescingLastSkipStage: 'request',
        farCoalescingMinIntervalSeconds: 1,
        farCoalescingSkippedCount: 1,
        refreshReason: 'spacecraft-change',
      })

      now = 1_100
      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          velocity: { x: 30, y: 0 },
        },
      })

      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
      expect(farWorker.clients[0]?.requests).toHaveLength(2)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('queues the completed burn state while active far work is still running', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      setTimeWarp,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    setTimeWarp(60)

    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    setState({
      ...state(),
      controls: idleControls(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 30, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(farWorker.clients[0]?.requests).toHaveLength(1)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      pendingFar: true,
      refreshReason: 'spacecraft-change',
    })

    farWorker.completeRequest(0, 0)
    expect(farWorker.clients[0]?.requests).toHaveLength(2)
    expect(predictionRuntime.getDiagnostics().farCalculationSampleCount).toBe(0)
    expect(farWorker.getRequest(0, 1).state).toMatchObject({
      controls: idleControls(),
      spacecraft: {
        velocity: { x: 30, y: 0 },
      },
    })

    farWorker.completeRequest(0, 1)
    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 9_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 27_010, y: 0 },
        { x: 36_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farVisible: 'current',
      pendingFar: false,
    })
  })

  it('refreshes coasting far work after its cooldown despite continuous drift refreshes', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      setTimeWarp,
      state,
    } = createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      setPredictionConfig({
        ...createLongHorizonPredictionConfig(),
        horizonSeconds: 48 * 3_600,
        refreshInterval: 0.4,
      })
      setTimeWarp(3_600)

      predictionRuntime.refresh(getOptions())
      farWorker.completeRequest(0, 0)
      expect(
        predictionRuntime.getDiagnostics().farCoalescingMinIntervalSeconds,
      ).toBe(1)

      now = 500
      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          position: { x: 5_010, y: 0 },
        },
      })
      expect(predictionRuntime.maybeRefresh(0.5, getOptions())).toBe(true)
      expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
        'spacecraft-change',
      )
      expect(farWorker.clients[0]?.requests).toHaveLength(1)

      now = 1_100
      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          position: { x: 10_010, y: 0 },
        },
      })
      expect(predictionRuntime.maybeRefresh(0.6, getOptions())).toBe(true)
      expect(predictionRuntime.getDiagnostics().refreshReason).toBe(
        'spacecraft-change',
      )
      expect(farWorker.clients[0]?.requests).toHaveLength(2)

      now = 1_200
      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          position: { x: 15_010, y: 0 },
        },
      })
      expect(predictionRuntime.maybeRefresh(0.1, getOptions())).toBe(true)
      expect(predictionRuntime.getDiagnostics().pendingFar).toBe(false)
      expect(farWorker.clients[0]?.requests).toHaveLength(2)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('coalesces immediate far work for coasting drift with turn-only controls', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    setState({
      ...state(),
      controls: { ...state().controls, turn: 1 },
    })

    predictionRuntime.refresh(getOptions())
    farWorker.completeRequest(0, 0)

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(farWorker.clients[0]?.requests).toHaveLength(1)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      farCoalescingLastSkipReason: 'cooldown',
      farCoalescingLastSkipStage: 'request',
      farCoalescingSkippedCount: 1,
      farVisible: 'retained-stale',
      refreshReason: 'spacecraft-change',
    })

    setState({
      ...state(),
      bodies: [
        state().bodies[0] ?? earth,
        { ...moon, position: { x: 7_000, y: 0 } },
      ],
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(farWorker.clients[0]?.requests).toHaveLength(1)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      farCoalescingSkippedCount: 2,
      refreshReason: 'body-state-change',
    })
  })

  it('coalesces pending far results that complete before the override interval', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      setPredictionConfig(createLongHorizonPredictionConfig())
      predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(10)
      setState({
        ...state(),
        controls: { ...state().controls, main: 1 },
      })
      predictionRuntime.refresh(getOptions())

      setState({
        ...state(),
        spacecraft: {
          ...state().spacecraft,
          velocity: { x: 20, y: 0 },
        },
      })
      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
      expect(farWorker.clients[0]?.requests).toHaveLength(1)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        activeFar: true,
        pendingFar: true,
      })

      farWorker.completeRequest(0, 0)
      expect(farWorker.clients[0]?.requests).toHaveLength(2)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        activeFar: true,
        farCalculationSampleCount: 1,
      })

      now = 1_000
      farWorker.completeRequest(0, 1)

      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        activeFar: false,
        farCalculationSampleCount: 1,
        farCoalescingLastSkipReason: 'cooldown',
        farCoalescingLastSkipStage: 'result',
        farCoalescingSkippedCount: 1,
      })
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('does not coalesce semantic far refreshes during the cooldown', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setTarget,
    } = createRuntimeHarness()
    const nowSpy = vi.spyOn(performance, 'now')
    let now = 0
    nowSpy.mockImplementation(() => now)

    try {
      setPredictionConfig(createLongHorizonPredictionConfig())
      predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(10)
      predictionRuntime.refresh(getOptions())
      farWorker.completeRequest(0, 0)

      now = 1_000
      setTarget(moon)
      expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

      expect(farWorker.clients[0]?.requests).toHaveLength(2)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCoalescingSkippedCount: 0,
        refreshReason: 'target-change',
      })

      farWorker.completeRequest(0, 1)
      expect(predictionRuntime.getDiagnostics()).toMatchObject({
        farCalculationSampleCount: 2,
        farCoalescingSkippedCount: 0,
        farVisible: 'current',
      })
      expect(predictionRuntime.getState().targetId).toBe('moon')
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('uses the last configured warp factor bucket above the largest warp factor ceiling', () => {
    const { getOptions, predictionRuntime, setPredictionConfig, setTimeWarp } =
      createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())

    setTimeWarp(18_000)
    predictionRuntime.refresh(getOptions())
    const largestConfiguredWarpInterval =
      predictionRuntime.getDiagnostics().farCoalescingMinIntervalSeconds

    setTimeWarp(999_999)
    predictionRuntime.maybeRefresh(0, getOptions())

    expect(
      predictionRuntime.getDiagnostics().farCoalescingMinIntervalSeconds,
    ).toBe(largestConfiguredWarpInterval)
  })

  it('calculates the default cooldown from horizon travel time at current warp', () => {
    const { getOptions, predictionRuntime, setPredictionConfig, setTimeWarp } =
      createRuntimeHarness()
    setPredictionConfig({
      ...createLongHorizonPredictionConfig(),
      horizonSeconds: 768 * 3_600,
    })
    setTimeWarp(18_000)

    predictionRuntime.refresh(getOptions())

    expect(
      predictionRuntime.getDiagnostics().farCoalescingMinIntervalSeconds,
    ).toBeCloseTo(6.4)
  })

  it('accepts a worker result after spacecraft drift and then replaces it with the newer pending job', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(0)
    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
    })
    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    const nearFirstPredictionWithStaleFarTail = [
      { x: 6_010, y: 0 },
      { x: 12_010, y: 0 },
    ]
    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      nearFirstPredictionWithStaleFarTail,
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      integrationTiers: {
        far: null,
        near: expect.objectContaining({
          averageStepSeconds: expect.any(Number),
          minStepSeconds: expect.any(Number),
          stepCount: expect.any(Number),
        }),
      },
      horizonSeconds: 1_200,
      farPointCount: 0,
      farVisible: 'none',
      hasFarTier: false,
      nearCalculationAgeSeconds: expect.any(Number),
      nearCalculationAverageMs: expect.any(Number),
      nearCalculationMs: expect.any(Number),
      nearCalculationSampleCount: 2,
      nearCalculationTravel: {
        distanceSinceCalculationMeters: 0,
        horizonDistanceMeters: 12_000,
        horizonRatio: 0,
        lastCalculationGapMeters: 0,
        lastCalculationGapRatio: 0,
        lastStepDistanceMeters: 0,
        lastStepHorizonRatio: 0,
      },
      nearCalculationWindows: {
        averageLastSecondMs: expect.any(Number),
        averageLastTenSecondsMs: expect.any(Number),
        averageLastThirtySecondsMs: expect.any(Number),
        countLastSecond: 2,
        countLastTenSeconds: 2,
        countLastThirtySeconds: 2,
      },
      nearPointCount: 2,
      pendingFar: true,
      refreshReason: 'spacecraft-change',
      relativePointCount: 2,
      splitHorizon: true,
      visiblePointCount: 2,
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: true,
      changedParts: ['spacecraft'],
      event: 'refresh',
      farApplied: false,
      farCalculationMs: null,
      farVisible: 'none',
      nearCalculationMs: expect.any(Number),
      pendingFar: true,
    })

    farWorker.completeRequest(0, 0)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 6_010, y: 0 },
        { x: 12_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationAgeSeconds: expect.any(Number),
      farCalculationAverageMs: 4,
      farCalculationMs: 4,
      farCalculationSampleCount: 1,
      farCalculationWindows: {
        averageLastSecondMs: 4,
        averageLastTenSecondsMs: 4,
        averageLastThirtySecondsMs: 4,
        countLastSecond: 1,
        countLastTenSeconds: 1,
        countLastThirtySeconds: 1,
      },
      integrationTiers: {
        far: expect.objectContaining({
          averageStepSeconds: expect.any(Number),
          minStepSeconds: expect.any(Number),
          stepCount: expect.any(Number),
        }),
        near: expect.objectContaining({
          averageStepSeconds: expect.any(Number),
          minStepSeconds: expect.any(Number),
          stepCount: expect.any(Number),
        }),
      },
      farPointCount: 4,
      farVisible: 'retained-stale',
      horizonSeconds: 1_200,
      nearCalculationAgeSeconds: expect.any(Number),
      nearCalculationAverageMs: expect.any(Number),
      nearCalculationMs: expect.any(Number),
      nearCalculationSampleCount: 2,
      nearCalculationTravel: {
        distanceSinceCalculationMeters: 0,
        horizonDistanceMeters: 12_000,
        horizonRatio: 0,
        lastCalculationGapMeters: 0,
        lastCalculationGapRatio: 0,
        lastStepDistanceMeters: 0,
        lastStepHorizonRatio: 0,
      },
      nearCalculationWindows: {
        averageLastSecondMs: expect.any(Number),
        averageLastTenSecondsMs: expect.any(Number),
        averageLastThirtySecondsMs: expect.any(Number),
        countLastSecond: 2,
        countLastTenSeconds: 2,
        countLastThirtySeconds: 2,
      },
      nearPointCount: 2,
      pendingFar: false,
      refreshReason: 'timed-refresh',
      relativePointCount: 4,
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: true,
      changedParts: [],
      event: 'far-complete',
      farApplied: true,
      farCalculationMs: 4,
      farVisible: 'retained-stale',
      nearCalculationMs: null,
      pendingFar: false,
    })
    expect(farWorker.getRequest(0, 1).jobId).toBeGreaterThan(
      farWorker.getRequest(0, 0).jobId,
    )

    farWorker.completeRequest(0, 1, 5)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 6_010, y: 0 },
        { x: 12_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 24_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farCalculationAverageMs: 4.5,
      farCalculationMs: 5,
      farCalculationSampleCount: 2,
      farVisible: 'current',
      pendingFar: false,
    })
  })

  it('accepts a worker result after body drift and then replaces it with the newer pending job', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(0)
    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
    })
    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      bodies: [
        state().bodies[0] ?? earth,
        { ...moon, position: { x: 7_000, y: 0 } },
      ],
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationSampleCount: 0,
      farVisible: 'none',
      pendingFar: true,
      refreshReason: 'body-state-change',
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      changedParts: ['bodies'],
      event: 'refresh',
      farApplied: false,
      pendingFar: true,
      reason: 'body-state-change',
    })

    farWorker.completeRequest(0, 0)

    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationAverageMs: 4,
      farCalculationMs: 4,
      farCalculationSampleCount: 1,
      farVisible: 'retained-stale',
      pendingFar: false,
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      event: 'far-complete',
      farApplied: true,
      farVisible: 'retained-stale',
      pendingFar: false,
    })
    expect(farWorker.getRequest(0, 1).jobId).toBeGreaterThan(
      farWorker.getRequest(0, 0).jobId,
    )

    farWorker.completeRequest(0, 1, 5)

    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farCalculationAverageMs: 4.5,
      farCalculationMs: 5,
      farCalculationSampleCount: 2,
      farVisible: 'current',
      pendingFar: false,
    })
  })

  it('ignores a worker result from before a manual refresh boundary', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(0)
    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })
    predictionRuntime.refresh(getOptions(), 'manual')

    farWorker.completeRequest(0, 0)

    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationSampleCount: 0,
      farVisible: 'none',
      pendingFar: false,
    })
    expect(farWorker.getRequest(0, 1).jobId).toBeGreaterThan(
      farWorker.getRequest(0, 0).jobId,
    )

    farWorker.completeRequest(0, 1)

    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farCalculationMs: 4,
      farCalculationSampleCount: 1,
      farVisible: 'current',
      pendingFar: false,
    })
  })

  it('extends the near horizon when recent movement exceeds the near-span budget', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig({
      ...createLongHorizonPredictionConfig(),
      horizonSeconds: 18_000,
    })
    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 100, y: 0 },
      },
    })

    predictionRuntime.refresh(getOptions())
    farWorker.completeRequest(0, 0)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      nearCalculationTravel: {
        horizonDistanceMeters: 60_000,
        lastStepHorizonRatio: 0,
      },
      nearPointCount: 2,
    })

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        position: { x: 5_010, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      farVisible: 'retained-stale',
      nearCalculationTravel: {
        distanceSinceCalculationMeters: 0,
        horizonDistanceMeters: 500_000,
        horizonRatio: 0,
        lastCalculationGapMeters: 5_000,
        lastStepDistanceMeters: 5_000,
        lastStepHorizonRatio: 0.01,
      },
      nearPointCount: 17,
      refreshReason: 'spacecraft-change',
      splitHorizon: true,
    })
    expect(
      predictionRuntime.getDiagnostics().nearCalculationTravel
        .lastCalculationGapRatio,
    ).toBeCloseTo(5_000 / 60_000)

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        position: { x: 10_010, y: 0 },
      },
    })

    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      nearCalculationTravel: {
        horizonDistanceMeters: 500_000,
        lastCalculationGapMeters: 5_000,
        lastCalculationGapRatio: 0.01,
        lastStepDistanceMeters: 5_000,
        lastStepHorizonRatio: 0.01,
      },
      nearPointCount: 17,
      refreshReason: 'spacecraft-change',
    })
  })

  it('keeps active far work and replaces only the waiting pending request', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(0)
    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
    })
    predictionRuntime.refresh(getOptions())
    farWorker.completeRequest(0, 0)

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
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: true,
      changedParts: ['spacecraft'],
      event: 'refresh',
      farApplied: false,
      farVisible: 'retained-stale',
      pendingFar: true,
    })

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 9_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 40, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: true,
      changedParts: ['spacecraft'],
      event: 'far-replaced',
      farApplied: false,
      farVisible: 'retained-stale',
      pendingFar: true,
    })

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 12_010, y: 0 },
        { x: 24_010, y: 0 },
        { x: 9_010, y: 0 },
        { x: 12_010, y: 0 },
      ],
    )

    farWorker.completeRequest(0, 1)
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      activeFar: true,
      changedParts: [],
      event: 'far-complete',
      farApplied: true,
      farVisible: 'retained-stale',
      pendingFar: false,
    })
    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 12_010, y: 0 },
        { x: 24_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 24_010, y: 0 },
      ],
    )

    expect(farWorker.clients[0]?.requests).toHaveLength(3)
    expect(farWorker.getRequest(0, 2).jobId).toBeGreaterThan(
      farWorker.getRequest(0, 1).jobId,
    )
    farWorker.completeRequest(0, 2)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 12_010, y: 0 },
        { x: 24_010, y: 0 },
        { x: 36_010, y: 0 },
        { x: 48_010, y: 0 },
      ],
    )
  })

  it('ignores stale worker results after the semantic prediction target changes', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setTarget,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    predictionRuntime.refresh(getOptions())
    const earthRequest = farWorker.getRequest(0, 0)

    setTarget(moon)
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)
    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'moon',
      targetRelativePredictionPoints: [
        { x: 2_010, y: 0 },
        { x: 5_010, y: 0 },
      ],
    })

    farWorker.completeRequest(0, 0)

    expect(farWorker.clients[0]?.requests).toHaveLength(2)
    expect(farWorker.getRequest(0, 1)).toMatchObject({
      jobId: earthRequest.jobId + 1,
      targetId: 'moon',
    })
    expect(predictionRuntime.getState()).toMatchObject({
      targetId: 'moon',
      targetRelativePredictionPoints: [
        { x: 2_010, y: 0 },
        { x: 5_010, y: 0 },
      ],
    })
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farCalculationSampleCount: 0,
      farVisible: 'none',
      pendingFar: false,
      refreshReason: 'target-change',
    })
    expect(predictionRuntime.getDiagnostics().events.at(-1)).toMatchObject({
      event: 'refresh',
      reason: 'target-change',
    })
  })

  it('recreates the worker after an active far job fails and continues with the pending request', () => {
    const {
      farWorker,
      getOptions,
      predictionRuntime,
      setPredictionConfig,
      setState,
      state,
    } = createRuntimeHarness()
    setPredictionConfig(createLongHorizonPredictionConfig())
    setState({
      ...state(),
      controls: { ...state().controls, main: 1 },
    })
    predictionRuntime.refresh(getOptions())

    setState({
      ...state(),
      spacecraft: {
        ...state().spacecraft,
        velocity: { x: 20, y: 0 },
      },
    })
    expect(predictionRuntime.maybeRefresh(0, getOptions())).toBe(true)

    farWorker.failRequest(0, 0)

    expect(farWorker.clients[0]?.terminated).toBe(true)
    expect(farWorker.createFarWorkerClient).toHaveBeenCalledTimes(2)
    expect(farWorker.getRequest(1, 0)).toMatchObject({
      jobId: 2,
      targetId: 'earth',
    })
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: true,
      farVisible: 'none',
      pendingFar: false,
    })

    farWorker.completeRequest(1, 0)

    expect(predictionRuntime.getState().targetRelativePredictionPoints).toEqual(
      [
        { x: 6_010, y: 0 },
        { x: 12_010, y: 0 },
        { x: 18_010, y: 0 },
        { x: 24_010, y: 0 },
      ],
    )
    expect(predictionRuntime.getDiagnostics()).toMatchObject({
      activeFar: false,
      farCalculationMs: 4,
      farVisible: 'current',
    })
  })
})

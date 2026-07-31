import { afterEach, describe, expect, it, vi } from 'vitest'

import { writeDebugScenarioSnapshot } from '@/debugScenarioSnapshot'
import {
  createDevtoolsBridge,
  createDevtoolsSnapshot,
} from '@/devtools/devtoolsBridge'
import type { UIUserAction } from '@/input/uiUserActions'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createGameQueries } from '@/runtime/gameQueries'
import type {
  TrajectoryPredictionDiagnosticEvent,
  TrajectoryPredictionDiagnostics,
} from '@/runtime/trajectoryPredictionRuntime'
import { getConstrainedTimeWarpIndex } from '@/scenario/scenarioDirectives'
import {
  type CameraFollowSubject,
  createDefaultScenarioDirectives,
} from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'

const timeWarps = [1, 10, 30, 60]
const predictionSampling = {
  maxIntegrationStepSeconds: 8,
  refreshInterval: 0.4,
  stepOptionsSeconds: [30, 60],
  targetMaxSteps: 1200,
}

const getTimeWarpDiagnostics = () => ({
  constraintReason: 'prediction-coverage' as const,
  effectiveTimeWarp: 30,
  effectiveTimeWarpIndex: 2,
  predictionCoverageLimit: {
    maxTimeWarp: 30,
    maxTimeWarpIndex: 2,
    rawMaxTimeWarp: 42,
    remainingCoverageSeconds: 420,
  },
  requestedTimeWarp: 60,
  requestedTimeWarpIndex: 3,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const createTrajectoryPredictionDiagnostics = (
  events: TrajectoryPredictionDiagnosticEvent[] = [],
): TrajectoryPredictionDiagnostics => ({
  absolutePointCount: 12,
  activeFar: false,
  activeFarInputKeyShort: null,
  assistedPointCount: 8,
  elapsedSinceRefreshSeconds: 0.2,
  events,
  eventMarkerCount: 2,
  farCalculationAgeSeconds: 0.8,
  farCalculationAverageMs: 5.1,
  farCalculationMs: 5.6,
  farCalculationSampleCount: 3,
  farCalculationWindows: {
    averageLastSecondMs: 5.6,
    averageLastTenSecondsMs: 5.2,
    averageLastThirtySecondsMs: 5.1,
    countLastSecond: 1,
    countLastTenSeconds: 2,
    countLastThirtySeconds: 3,
  },
  farCoalescingLastSkipReason: null,
  farCoalescingLastSkipStage: null,
  farCoalescingMinIntervalOverrideSeconds: null,
  farCoalescingMinIntervalSeconds: 0.5,
  farCoalescingSkippedCount: 0,
  farInputKeyShort: 'far-key',
  farPointCount: 10,
  farReuseDivergence: null,
  farReuseExtendedPointCount: 2,
  farReuseExtendedSeconds: 120,
  farReuseFallbackReason: null,
  farReuseHistory: [
    {
      divergence: null,
      elapsedSeconds: 240,
      extendedPointCount: 2,
      extendedSeconds: 120,
      fallbackReason: null,
      horizonSeconds: 43_200,
      mode: 'trim-extend',
      retainedPointCount: 8,
      retainedSeconds: 43_080,
      trimmedPointCount: 2,
      trimmedSeconds: 120,
      validation: 'performed',
      validationSeconds: 120,
    },
  ],
  farReuseMode: 'trim-extend',
  farReuseRetainedPointCount: 8,
  farReuseRetainedSeconds: 43_080,
  farReuseTrimmedPointCount: 2,
  farReuseTrimmedSeconds: 120,
  farReuseValidation: 'performed',
  farReuseValidationSeconds: 120,
  farVisible: 'current',
  geometryUpdateMs: 1.2,
  hasFarTier: true,
  horizonSeconds: 43_200,
  inputKey: 'test-key',
  inputKeyShort: 'test',
  integrationStepSeconds: 8,
  integrationTiers: {
    far: {
      averageStepSeconds: 2,
      minStepSeconds: 1,
      stepCount: 20,
    },
    near: {
      averageStepSeconds: 4,
      minStepSeconds: 2,
      stepCount: 10,
    },
  },
  nearCalculationAgeSeconds: 0.1,
  nearCalculationAverageMs: 2.4,
  nearCalculationMs: 2.1,
  nearCalculationSampleCount: 6,
  nearCalculationTravel: {
    distanceSinceCalculationMeters: 1_000,
    horizonDistanceMeters: 10_000,
    horizonRatio: 0.1,
    lastCalculationGapMeters: 900,
    lastCalculationGapRatio: 0.09,
    lastStepDistanceMeters: 250,
    lastStepHorizonRatio: 0.025,
  },
  nearCalculationWindows: {
    averageLastSecondMs: 2.1,
    averageLastTenSecondsMs: 2.3,
    averageLastThirtySecondsMs: 2.4,
    countLastSecond: 1,
    countLastTenSeconds: 4,
    countLastThirtySeconds: 6,
  },
  nearFallbackReason: null,
  nearPointCount: 4,
  nearSource: 'accepted-window',
  pendingFar: false,
  pendingFarInputKeyShort: null,
  predictionAnchorElapsed: 120,
  predictionRefreshMs: 3.4,
  predictionTerminationReason: 'horizon',
  refreshCountLastSecond: 2,
  refreshIntervalSeconds: 0.4,
  refreshReason: 'target-change',
  relativePointCount: 10,
  remainingUsableCoverageSeconds: 43_080,
  retainedFarPointCount: 8,
  retainedNearPointCount: 4,
  sampleStepSeconds: 60,
  splitHorizon: true,
  visiblePointCount: 10,
})

const createRuntime = (): AppRuntimeState => ({
  info: { userPins: [] },
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 1,
    assistTargetSelectionMode: 'auto',
    coastPredictionHorizonHours: 12,
    crashedBodyName: null,
    state: {
      bodies: [
        {
          color: '#2f80ed',
          id: 'earth',
          mass: 1,
          name: 'Earth',
          position: { x: 10, y: 20 },
          radius: 6,
          velocity: { x: 3, y: 4 },
        },
        {
          color: '#9aa0a6',
          id: 'moon',
          mass: 0.01,
          name: 'Moon',
          position: { x: 50, y: 60 },
          radius: 2,
          velocity: { x: 0, y: 2 },
        },
      ],
      controls: { main: 1, reverse: 0, strafe: 0, turn: -1 },
      elapsed: 42,
      spacecraft: {
        dryMass: 3,
        fuel: 7,
        fuelCapacity: 10,
        fuelMass: 2,
        fuelUsed: 1,
        heading: 0.5,
        position: { x: 11, y: 22 },
        velocity: { x: 6, y: 8 },
      },
    },
    targetHeading: 1.2,
    targetHeadingTurn: null,
    timeWarpIndex: 2,
    viewportSize: 800,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Test scenario description',
      title: 'Test scenario',
    },
    session: createRuntimeScenarioSession('test-scenario', { phase: 'test' }),
  },
  ui: {
    camera: {
      follow: 'spacecraft',
      panOffset: { x: 1, y: 2 },
    },
    spacecraftLabelIntroUntil: 0,
    touchThrustControl: {
      engaged: false,
      interactive: true,
      revealed: true,
      visible: true,
    },
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: 'ready',
    fpsIndicatorEnabled: false,
  },
})

const createQueries = (runtime: AppRuntimeState) =>
  createGameQueries({
    autoSelectNearestSurface: true,
    autoSelectConfig: { switchRangeMultiplier: 2 },
    autopilotRotationRate: 0.1,
    getPredictedTrajectoryEnd: () => null,
    getPredictedTrajectoryPoints: () => [],
    hasCompleteAutoTargetPrediction: () => true,
    maxPredictionLoopRevolutions: 2.5,
    predictionSampling,
    runtime,
  })

const createBridgeHarness = (
  runtime = createRuntime(),
  getAssistTarget = createQueries(runtime).getAssistTarget,
) => {
  const dispatchedActions: UIUserAction[] = []
  let farCoalescingOverrideSeconds: number | null = null
  const setCameraFollow = vi.fn((follow: CameraFollowSubject) => {
    if (runtime.scenario.directives.cameraControlsLocked) {
      return false
    }

    runtime.ui.camera.follow = follow
    return true
  })
  const recenterCamera = vi.fn(() => {
    if (runtime.scenario.directives.cameraControlsLocked) {
      return false
    }

    runtime.ui.camera.panOffset = { x: 0, y: 0 }
    return true
  })
  const bridge = createDevtoolsBridge({
    dispatchRuntimeAction: (action) => {
      dispatchedActions.push(action)
      if (action === 'toggleDebugMode') {
        runtime.debug.debugModeEnabled = !runtime.debug.debugModeEnabled
      }
    },
    getAppMode: () => 'game',
    getAssistTarget,
    getTrajectoryPredictionDiagnostics: () =>
      createTrajectoryPredictionDiagnostics(),
    getTimeWarpDiagnostics,
    runtime,
    maxPredictionLoopRevolutions: 2.5,
    predictionSampling,
    runtimeActions: {
      recenterCamera,
      selectTimeWarpIndex: vi.fn((index: number) => {
        const constrainedIndex = getConstrainedTimeWarpIndex(
          index,
          timeWarps,
          runtime.scenario.directives.maxTimeWarp,
        )
        runtime.simulation.timeWarpIndex = constrainedIndex
        return constrainedIndex
      }),
      setCameraFollow,
    },
    setTrajectoryPredictionFarCoalescingMinIntervalOverrideSeconds: vi.fn(
      (value) => {
        farCoalescingOverrideSeconds = value
        return true
      },
    ),
    timeWarps,
  })

  return {
    bridge,
    dispatchedActions,
    getFarCoalescingOverrideSeconds: () => farCoalescingOverrideSeconds,
    recenterCamera,
    runtime,
    setCameraFollow,
  }
}

describe('createDevtoolsSnapshot', () => {
  it('creates a serializable runtime summary for the devtools panel', () => {
    const runtime = createRuntime()
    runtime.simulation.assistTargetSelectionMode = 'manual'
    runtime.scenario.directives.hiddenUIElements.add('trajectory')
    const queries = createQueries(runtime)

    const snapshot = createDevtoolsSnapshot({
      getAppMode: () => 'game',
      getAssistTarget: queries.getAssistTarget,
      maxPredictionLoopRevolutions: 2.5,
      predictionSampling,
      runtime,
      getTrajectoryPredictionDiagnostics: () =>
        createTrajectoryPredictionDiagnostics([
          {
            activeFar: false,
            activeFarInputKeyShort: null,
            changedParts: ['target'],
            dtMs: null,
            elapsedSinceRefreshSeconds: 0.2,
            event: 'refresh',
            farApplied: true,
            farCalculationMs: 5.6,
            farInputKeyShort: 'far-key',
            farPointCount: 10,
            farVisible: 'current',
            horizonSeconds: 43_200,
            inputKeyShort: 'test',
            nearCalculationMs: 2.1,
            nearPointCount: 4,
            pendingFar: false,
            pendingFarInputKeyShort: null,
            reason: 'target-change',
            refreshIntervalSeconds: 0.4,
            splitHorizon: true,
            t: 12,
            visiblePointCount: 10,
          },
        ]),
      getTimeWarpDiagnostics,
      timeWarps,
    })

    expect(snapshot.appMode).toBe('game')
    expect(snapshot.camera).toMatchObject({
      follow: 'spacecraft',
      panOffset: { x: 1, y: 2 },
    })
    expect(snapshot.protocolVersion).toBe(2)
    expect(snapshot.scenario).toMatchObject({
      scenarioId: 'test-scenario',
      state: { phase: 'test' },
      title: 'Test scenario',
    })
    expect(snapshot.scenario.directives.hiddenUIElements).toEqual([
      'trajectory',
    ])
    expect(snapshot.simulation.assistTarget).toEqual({
      id: 'moon',
      name: 'Moon',
    })
    expect(snapshot.simulation.assistTargetIndex).toBe(1)
    expect(snapshot.simulation.timeWarp).toBe(30)
    expect(snapshot.simulation.timeWarpConstraint).toEqual(
      getTimeWarpDiagnostics(),
    )
    expect(snapshot.simulation.predictionSampling).toMatchObject({
      currentMaxIntegrationStepSeconds: 8,
      currentStepSeconds: 60,
      maxIntegrationStepSeconds: 8,
      refreshInterval: 0.4,
      targetMaxSteps: 1200,
    })
    expect(snapshot.simulation.trajectoryPrediction).toMatchObject({
      absolutePointCount: 12,
      events: [{ event: 'refresh', farApplied: true }],
      eventMarkerCount: 2,
      farCoalescingMinIntervalSeconds: 0.5,
      farReuseExtendedPointCount: 2,
      farReuseExtendedSeconds: 120,
      farReuseFallbackReason: null,
      farReuseHistory: [
        expect.objectContaining({
          elapsedSeconds: 240,
          extendedPointCount: 2,
          retainedPointCount: 8,
          trimmedPointCount: 2,
        }),
      ],
      farReuseMode: 'trim-extend',
      farReuseRetainedPointCount: 8,
      farReuseRetainedSeconds: 43_080,
      farReuseTrimmedPointCount: 2,
      farReuseTrimmedSeconds: 120,
      farReuseValidation: 'performed',
      farReuseValidationSeconds: 120,
      farVisible: 'current',
      pendingFar: false,
      nearCalculationTravel: {
        distanceSinceCalculationMeters: 1_000,
        horizonDistanceMeters: 10_000,
        horizonRatio: 0.1,
        lastCalculationGapMeters: 900,
        lastCalculationGapRatio: 0.09,
        lastStepDistanceMeters: 250,
        lastStepHorizonRatio: 0.025,
      },
      refreshReason: 'target-change',
    })
    expect(snapshot.simulation.spacecraft.speed).toBe(10)
    expect(snapshot.simulation.bodies[0]?.speed).toBe(5)
    expect(snapshot.recentDebugSnapshots).toEqual([])
  })

  it('includes recent debug snapshot link metadata without saved state', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      location: {
        href: 'https://space.example/game?devtools=1',
      },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    const runtime = createRuntime()
    writeDebugScenarioSnapshot(
      {
        version: 3,
        savedAt: '2026-07-19T10:00:00.000Z',
        elapsed: runtime.simulation.state.elapsed,
        bodies: runtime.simulation.state.bodies,
        spacecraft: runtime.simulation.state.spacecraft,
      },
      'Lunar approach',
    )

    const [recentSnapshot] =
      createBridgeHarness(runtime).bridge.getSnapshot().recentDebugSnapshots
    const url = new URL(recentSnapshot.url)

    expect(recentSnapshot).toMatchObject({
      id: 'debug-snapshot-2026-07-19T10:00:00.000Z',
      name: 'Lunar approach',
      savedAt: '2026-07-19T10:00:00.000Z',
    })
    expect(recentSnapshot).not.toHaveProperty('snapshot')
    expect(url.searchParams.get('devtools')).toBe('1')
    expect(url.searchParams.get('scenario')).toBe(recentSnapshot.id)
  })

  it('uses the effective automatic target for target-dependent diagnostics', () => {
    const runtime = createRuntime()
    const earth = runtime.simulation.state.bodies[0]
    if (!earth) {
      throw new Error('Expected Earth test body')
    }
    earth.mass = 1e15

    const snapshot = createBridgeHarness(runtime).bridge.getSnapshot()

    expect(snapshot.simulation.assistTarget).toEqual({
      id: 'earth',
      name: 'Earth',
    })
    expect(snapshot.simulation.assistTargetIndex).toBe(1)
    expect(snapshot.simulation.bodies[1]?.id).toBe('moon')
    expect(
      snapshot.simulation.predictionSampling.currentMaxIntegrationStepSeconds,
    ).toBe(2)
  })

  it('uses a forced target that differs from automatic and raw selections', () => {
    const runtime = createRuntime()
    runtime.simulation.state.bodies.push({
      color: '#c56a4a',
      id: 'mars',
      mass: 1e15,
      name: 'Mars',
      position: { x: 100, y: 100 },
      radius: 50,
      velocity: { x: 6, y: 8 },
    })
    const queries = createQueries(runtime)

    expect(queries.getAssistTarget().id).toBe('earth')
    runtime.scenario.directives.forcedAssistTargetId = 'mars'

    const snapshot = createBridgeHarness(
      runtime,
      queries.getAssistTarget,
    ).bridge.getSnapshot()

    expect(snapshot.simulation.assistTarget).toEqual({
      id: 'mars',
      name: 'Mars',
    })
    expect(snapshot.simulation.assistTargetIndex).toBe(1)
    expect(snapshot.simulation.bodies[1]?.id).toBe('moon')
    expect(
      snapshot.simulation.predictionSampling.currentMaxIntegrationStepSeconds,
    ).toBe(2)
  })
})

describe('createDevtoolsBridge', () => {
  it('dispatches validated UI actions through the app action path', () => {
    const { bridge, dispatchedActions } = createBridgeHarness()

    const response = bridge.handleRequest({
      action: 'increaseTimeWarp',
      type: 'dispatch-ui-action',
    })

    expect(response.ok).toBe(true)
    expect(dispatchedActions).toEqual(['increaseTimeWarp'])
  })

  it('rejects unknown UI actions', () => {
    const { bridge, dispatchedActions } = createBridgeHarness()

    const response = bridge.handleRequest({
      action: 'deleteUniverse',
      type: 'dispatch-ui-action',
    })

    expect(response.ok).toBe(false)
    expect(dispatchedActions).toEqual([])
  })

  it('sets time warp with scenario directive constraints', () => {
    const runtime = createRuntime()
    runtime.scenario.directives.maxTimeWarp = 10
    const { bridge } = createBridgeHarness(runtime)

    const response = bridge.handleRequest({
      index: 3,
      type: 'set-time-warp-index',
    })

    expect(response.ok).toBe(true)
    expect(runtime.simulation.timeWarpIndex).toBe(1)
    expect(response.snapshot.simulation.timeWarp).toBe(10)
  })

  it('routes camera Follow and Recenter changes through runtime actions', () => {
    const { bridge, recenterCamera, runtime, setCameraFollow } =
      createBridgeHarness()

    const followResponse = bridge.handleRequest({
      follow: 'target',
      type: 'set-camera-follow',
    })

    expect(followResponse.ok).toBe(true)
    expect(setCameraFollow).toHaveBeenCalledWith('target')
    expect(runtime.ui.camera.follow).toBe('target')
    expect(runtime.ui.camera.panOffset).toEqual({ x: 1, y: 2 })

    runtime.ui.camera.panOffset = { x: 7, y: -3 }
    const recenterResponse = bridge.handleRequest({
      type: 'recenter-camera',
    })

    expect(recenterResponse.ok).toBe(true)
    expect(recenterCamera).toHaveBeenCalledOnce()
    expect(runtime.ui.camera.follow).toBe('target')
    expect(runtime.ui.camera.panOffset).toEqual({ x: 0, y: 0 })
  })

  it('sets debug flags through the matching toggle action', () => {
    const { bridge, dispatchedActions, runtime } = createBridgeHarness()

    const response = bridge.handleRequest({
      flag: 'debugModeEnabled',
      type: 'set-debug-flag',
      value: true,
    })

    expect(response.ok).toBe(true)
    expect(runtime.debug.debugModeEnabled).toBe(true)
    expect(dispatchedActions).toEqual(['toggleDebugMode'])
  })

  it('does not dispatch when enabling an already enabled debug flag', () => {
    const runtime = createRuntime()
    runtime.debug.debugModeEnabled = true
    const { bridge, dispatchedActions } = createBridgeHarness(runtime)

    const response = bridge.handleRequest({
      flag: 'debugModeEnabled',
      type: 'set-debug-flag',
      value: true,
    })

    expect(response.ok).toBe(true)
    expect(runtime.debug.debugModeEnabled).toBe(true)
    expect(dispatchedActions).toEqual([])
  })

  it('does not dispatch when disabling an already disabled debug flag', () => {
    const runtime = createRuntime()
    runtime.debug.debugModeEnabled = false
    const { bridge, dispatchedActions } = createBridgeHarness(runtime)

    const response = bridge.handleRequest({
      flag: 'debugModeEnabled',
      type: 'set-debug-flag',
      value: false,
    })

    expect(response.ok).toBe(true)
    expect(runtime.debug.debugModeEnabled).toBe(false)
    expect(dispatchedActions).toEqual([])
  })

  it('rejects the removed performance debug flag', () => {
    const { bridge, dispatchedActions } = createBridgeHarness()

    const response = bridge.handleRequest({
      flag: 'performanceDebugEnabled',
      type: 'set-debug-flag',
      value: true,
    })

    expect(response.ok).toBe(false)
    expect(response).toMatchObject({
      error: 'set-debug-flag requires a writable debug flag',
    })
    expect(dispatchedActions).toEqual([])
  })

  it('sets and clears the far coalescing override', () => {
    const { bridge, getFarCoalescingOverrideSeconds } = createBridgeHarness()

    const setResponse = bridge.handleRequest({
      type: 'set-far-coalescing-min-interval-override',
      value: 2.5,
    })

    expect(setResponse.ok).toBe(true)
    expect(getFarCoalescingOverrideSeconds()).toBe(2.5)

    const clearResponse = bridge.handleRequest({
      type: 'set-far-coalescing-min-interval-override',
      value: null,
    })

    expect(clearResponse.ok).toBe(true)
    expect(getFarCoalescingOverrideSeconds()).toBe(null)
  })

  it('rejects invalid far coalescing override values', () => {
    const { bridge, getFarCoalescingOverrideSeconds } = createBridgeHarness()

    const response = bridge.handleRequest({
      type: 'set-far-coalescing-min-interval-override',
      value: -1,
    })

    expect(response.ok).toBe(false)
    expect(getFarCoalescingOverrideSeconds()).toBe(null)
  })
})

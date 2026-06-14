import { describe, expect, it, vi } from 'vitest'

import {
  createDevtoolsBridge,
  createDevtoolsSnapshot,
} from '@/devtools/devtoolsBridge'
import type { UIUserAction } from '@/input/uiUserActions'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'

const timeWarps = [1, 10, 30, 60]

const createRuntime = (): AppRuntimeState => ({
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
    camera: { mode: 'centered', panOffset: { x: 1, y: 2 } },
    spacecraftLabelIntroUntil: 0,
    targetHeadingScreenPosition: { x: 300, y: 200 },
    targetHeadingSelectionEpoch: 3,
    targetHeadingWorldPosition: { x: 30, y: 40 },
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
    performanceDebugEnabled: false,
  },
})

const createBridgeHarness = (runtime = createRuntime()) => {
  const dispatchedActions: UIUserAction[] = []
  const setCameraMode = vi.fn((mode: 'centered' | 'unlocked') => {
    if (runtime.scenario.directives.cameraModeChangesLocked) {
      return false
    }

    runtime.ui.camera.mode = mode
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
    runtime,
    runtimeActions: { setCameraMode },
    timeWarps,
  })

  return { bridge, dispatchedActions, runtime, setCameraMode }
}

describe('createDevtoolsSnapshot', () => {
  it('creates a serializable runtime summary for the devtools panel', () => {
    const runtime = createRuntime()
    runtime.scenario.directives.hiddenUIElements.add('trajectory')

    const snapshot = createDevtoolsSnapshot({
      getAppMode: () => 'game',
      runtime,
      timeWarps,
    })

    expect(snapshot.appMode).toBe('game')
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
    expect(snapshot.simulation.timeWarp).toBe(30)
    expect(snapshot.simulation.spacecraft.speed).toBe(10)
    expect(snapshot.simulation.bodies[0]?.speed).toBe(5)
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

  it('routes camera mode changes through runtime actions', () => {
    const { bridge, runtime, setCameraMode } = createBridgeHarness()

    const response = bridge.handleRequest({
      mode: 'unlocked',
      type: 'set-camera-mode',
    })

    expect(response.ok).toBe(true)
    expect(setCameraMode).toHaveBeenCalledWith('unlocked')
    expect(runtime.ui.camera.mode).toBe('unlocked')
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
})

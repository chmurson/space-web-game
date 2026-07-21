import { describe, expect, it, vi } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '@/domain/viewportPresets'
import * as sceneUpdates from '@/render/sceneUpdates'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { GameHighLevelActionsMediator } from '@/runtime/highLevelActions/gameHighLevelActionDispatcher'
import {
  apoapsisInfoPin,
  createBodyInfoPin,
  periapsisInfoPin,
} from '@/runtime/infoPins'
import {
  createNavigationTimeWarpController,
  type NavigationTimeWarpController,
} from '@/runtime/navigationTimeWarpController'
import { createRuntimeActions } from '@/runtime/runtimeActions'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
} from '@/scenario/scenarioSession'
import { RENDER_SCALE } from '@/simulation/constants'
import type { Body } from '@/simulation/types'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

const globalScenarioDirectiveLimits = {
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: requestedTimeWarps,
}

const runtimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: 1,
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minCoastPredictionHorizonHours: 0.5,
  minViewportSize: EARTH_VIEWPORT_SIZE,
}

const createRuntime = (): AppRuntimeState => ({
  info: { userPins: [] },
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 1,
    assistTargetSelectionMode: 'auto',
    coastPredictionHorizonHours: 24,
    crashedBodyName: 'Earth',
    state: {
      elapsed: 100,
      bodies: [
        {
          id: 'earth',
          name: 'Earth',
          mass: 1,
          radius: 1,
          position: { x: 10, y: 20 },
          velocity: { x: 30, y: 40 },
          color: '#2f80ed',
        },
        {
          id: 'moon',
          name: 'Moon',
          mass: 1,
          radius: 1,
          position: { x: 50, y: 60 },
          velocity: { x: 70, y: 80 },
          color: '#9aa0a6',
        },
      ],
      controls: { main: 1, reverse: 0, strafe: 0, turn: 1 },
      spacecraft: {
        position: { x: 50, y: 60 },
        velocity: { x: 70, y: 80 },
        heading: 0.4,
        fuel: 1,
        fuelUsed: 2,
        dryMass: 3,
        fuelMass: 4,
        fuelCapacity: 5,
      },
    },
    targetHeading: 1,
    targetHeadingTurn: null,
    timeWarpIndex: 4,
    viewportSize: 600,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Tutorial description',
      title: 'Tutorial',
    },
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
    }),
  },
  ui: {
    camera: { mode: 'centered', panOffset: { x: 0, y: 0 } },
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
  },
})

const createTestRuntimeActions = (
  runtime: AppRuntimeState,
  options: {
    autoSelectNearestSurface?: boolean
    createRipple?: Parameters<typeof createRuntimeActions>[0]['createRipple']
    getFollowCameraViewportBottomInset?: () => number
    navigationTimeWarpController?: NavigationTimeWarpController
  } = {},
) =>
  createRuntimeActions({
    app: {} as HTMLDivElement,
    autoSelectNearestSurface: options.autoSelectNearestSurface ?? true,
    cameraDistance: 700,
    cameraElevation: 1,
    createRipple: options.createRipple ?? (() => {}),
    gameScene: { trailPoints: [] } as never,
    getAssistTargetUiState: () => ({
      activeTarget:
        runtime.simulation.state.bodies[runtime.simulation.assistTargetIndex] ??
        getRequiredBody(runtime, 0),
      mode:
        runtime.simulation.assistTargetSelectionMode === 'auto'
          ? 'auto'
          : 'manual',
      recommendedTarget: null,
    }),
    getFollowCameraViewportBottomInset:
      options.getFollowCameraViewportBottomInset,
    maxCoastPredictionHorizonHours: 48,
    maxViewport: EARTH_MOON_VIEWPORT_SIZE,
    minCoastPredictionHorizonHours: 0.5,
    minViewport: EARTH_VIEWPORT_SIZE,
    navigationTimeWarpController:
      options.navigationTimeWarpController ??
      createNavigationTimeWarpController({
        maxControlWarp: 100,
        timeWarps: requestedTimeWarps,
      }),
    renderer: { setSize: () => {} },
    ripples: [],
    runtime,
    globalScenarioDirectiveLimits,
    runtimeScenarioOptions,
    timeWarps: requestedTimeWarps,
    updateUserSettings: () => {},
    gameHighLevelActions: new GameHighLevelActionsMediator(),
  })

const getTestGlobals = () =>
  globalThis as unknown as {
    window?: {
      innerHeight: number
      innerWidth: number
    }
  }

const setWindowSize = (width: number, height: number) => {
  const globals = getTestGlobals()
  if (!globals.window) {
    globals.window = {
      innerHeight: height,
      innerWidth: width,
    }
    return
  }

  globals.window.innerWidth = width
  globals.window.innerHeight = height
}

const getRequiredBody = (runtime: AppRuntimeState, index: number): Body => {
  const body = runtime.simulation.state.bodies[index]
  if (!body) {
    throw new Error(`Expected test body at index ${index}`)
  }

  return body
}

describe('createRuntimeActions', () => {
  it('toggles valid player pins and clears only player ownership', () => {
    const runtime = createRuntime()
    runtime.scenario.directives.infoPins = [createBodyInfoPin('moon')]
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.toggleUserInfoPin(createBodyInfoPin('earth'))).toBe(
      true,
    )
    expect(runtimeActions.toggleUserInfoPin(apoapsisInfoPin)).toBe(true)
    expect(runtime.info.userPins).toEqual([
      createBodyInfoPin('earth'),
      apoapsisInfoPin,
    ])
    expect(runtimeActions.toggleUserInfoPin(createBodyInfoPin('moon'))).toBe(
      false,
    )
    expect(runtimeActions.toggleUserInfoPin(createBodyInfoPin('missing'))).toBe(
      false,
    )

    expect(runtimeActions.clearUserInfoPins()).toBe(true)
    expect(runtime.info.userPins).toEqual([])
    expect(runtime.scenario.directives.infoPins).toEqual([
      createBodyInfoPin('moon'),
    ])
    expect(runtimeActions.clearUserInfoPins()).toBe(false)
  })

  it('handles the clear action without requesting a trajectory refresh', () => {
    const runtime = createRuntime()
    runtime.info.userPins = [periapsisInfoPin]
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.handleUIUserAction('clearInfoPins')).toEqual({
      refreshTrajectoryPrediction: false,
    })
    expect(runtime.info.userPins).toEqual([])
  })

  it('resets time warp to the initial index when resetting the scenario', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.handleUIUserAction('resetScenario')

    expect(runtime.simulation.timeWarpIndex).toBe(0)
  })

  it('restores the active checkpoint when requested explicitly', () => {
    const runtime = createRuntime()
    runtime.scenario.session.checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      viewportSize: 320,
      world: {
        elapsed: 42,
        bodies: [
          {
            id: 'earth',
            name: 'Earth',
            mass: 10,
            radius: 20,
            position: { x: 1, y: 2 },
            velocity: { x: 3, y: 4 },
            color: '#2f80ed',
          },
        ],
        controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
        spacecraft: {
          position: { x: 5, y: 6 },
          velocity: { x: 7, y: 8 },
          heading: 0.2,
          fuel: 9,
          fuelUsed: 10,
          dryMass: 11,
          fuelMass: 12,
          fuelCapacity: 13,
        },
      },
    })
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.restartFromCheckpoint()).toBe(true)
    expect(runtime.simulation.crashedBodyName).toBeNull()
    expect(runtime.simulation.timeWarpIndex).toBe(0)
    expect(runtime.simulation.state.elapsed).toBe(42)
    expect(runtime.simulation.viewportSize).toBe(320)
  })

  it('switches between centered and unlocked camera modes', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.setCameraMode('unlocked')).toBe(true)
      expect(runtime.ui.camera).toEqual({
        mode: 'unlocked',
        panOffset: runtime.simulation.state.spacecraft.position,
      })

      expect(runtimeActions.panCamera({ x: 10, y: -5 })).toBe(true)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 60, y: 55 })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 60, y: 55 },
        }),
      )

      expect(runtimeActions.setCameraMode('centered')).toBe(true)
      expect(runtime.ui.camera.mode).toBe('centered')
      expect(runtimeActions.panCamera({ x: 1, y: 1 })).toBe(false)
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('zooms an unlocked camera around a world focal point in one update', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.ui.camera = {
      mode: 'unlocked',
      panOffset: { x: 100, y: 200 },
    }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      runtimeActions.zoomCamera(0.5, { x: 300, y: 500 })

      expect(runtime.simulation.viewportSize).toBe(300)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 200, y: 350 })
      expect(updateCameraViewSpy).toHaveBeenCalledTimes(1)
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 200, y: 350 },
          preserveStarfieldWorldPosition: true,
        }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('keeps ordinary zoom centered without preserving starfield position', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      runtimeActions.zoomCamera(0.5)

      expect(runtime.simulation.viewportSize).toBe(300)
      expect(updateCameraViewSpy).toHaveBeenCalledTimes(1)
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: runtime.simulation.state.spacecraft.position,
          preserveStarfieldWorldPosition: false,
        }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('centers the target camera mode on the active assist target', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.simulation.state.bodies[1] = {
      ...getRequiredBody(runtime, 1),
      position: { x: 150, y: 160 },
    }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.setCameraMode('target')).toBe(true)
      expect(runtime.ui.camera.mode).toBe('target')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 150, y: 160 },
        }),
      )

      expect(runtimeActions.setCameraMode('unlocked')).toBe(true)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 150, y: 160 })
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('applies the mobile viewport inset only to follow camera modes', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(390, 844)
      const runtimeActions = createTestRuntimeActions(runtime, {
        getFollowCameraViewportBottomInset: () => 260,
      })

      runtimeActions.updateCamera()
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 260 }),
      )

      runtimeActions.setCameraMode('target')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 260 }),
      )

      runtimeActions.setCameraMode('unlocked')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 0 }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('preserves clipped body and starfield framing when entering free roam', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      const viewportHeight = 844
      const viewportBottomInset = 260
      setWindowSize(390, viewportHeight)
      const runtimeActions = createTestRuntimeActions(runtime, {
        getFollowCameraViewportBottomInset: () => viewportBottomInset,
      })

      expect(runtimeActions.setCameraMode('unlocked')).toBe(true)

      const expectedOffset =
        (runtime.simulation.viewportSize *
          0.5 *
          (viewportBottomInset / viewportHeight) *
          Math.hypot(Math.SQRT2 * Math.cos(1), Math.sin(1))) /
        (Math.SQRT2 * Math.sin(1) * RENDER_SCALE)
      expect(runtime.ui.camera.panOffset.x).toBeCloseTo(
        runtime.simulation.state.spacecraft.position.x + expectedOffset,
      )
      expect(runtime.ui.camera.panOffset.y).toBeCloseTo(
        runtime.simulation.state.spacecraft.position.y + expectedOffset,
      )
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: runtime.ui.camera.panOffset,
          preserveStarfieldWorldPosition: true,
          viewportBottomInset: 0,
        }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('cycles camera modes through free roam, spacecraft, and target', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.simulation.state.bodies[1] = {
      ...getRequiredBody(runtime, 1),
      position: { x: 150, y: 160 },
    }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.handleUIUserAction('cycleCameraMode')).toEqual({
        refreshTrajectoryPrediction: false,
      })
      expect(runtime.ui.camera.mode).toBe('target')

      runtimeActions.handleUIUserAction('cycleCameraMode')
      expect(runtime.ui.camera).toEqual({
        mode: 'unlocked',
        panOffset: { x: 150, y: 160 },
      })

      runtimeActions.handleUIUserAction('cycleCameraMode')
      expect(runtime.ui.camera.mode).toBe('centered')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: runtime.simulation.state.spacecraft.position,
        }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('does not change camera mode while scenario directives lock changes', () => {
    const runtime = createRuntime()
    runtime.scenario.directives.cameraModeChangesLocked = true
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.setCameraMode('unlocked')).toBe(false)
    expect(runtime.ui.camera.mode).toBe('centered')
    expect(updateCameraViewSpy).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('unlocks the camera with the follow target framed above the crash panel', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.scenario.directives.cameraModeChangesLocked = true
    runtime.ui.camera.panOffset = { x: 999, y: 999 }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      runtimeActions.unlockCameraAtFollowTarget()

      const expectedOffset =
        (runtime.simulation.viewportSize * 0.5 * 0.38 * Math.sin(1)) /
        (Math.SQRT2 * RENDER_SCALE)

      expect(runtime.ui.camera.mode).toBe('unlocked')
      expect(runtime.ui.camera.panOffset.x).toBeCloseTo(
        runtime.simulation.state.spacecraft.position.x + expectedOffset,
      )
      expect(runtime.ui.camera.panOffset.y).toBeCloseTo(
        runtime.simulation.state.spacecraft.position.y + expectedOffset,
      )
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: runtime.ui.camera.panOffset,
        }),
      )
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('stores a world-space target heading anchor for camera-relative feedback', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.setTargetHeading(1.2, 300, 200, { x: 12, y: 34 })

    expect(runtime.simulation.targetHeading).toBe(1.2)
    expect(runtime.ui.targetHeadingScreenPosition).toEqual({ x: 300, y: 200 })
    expect(runtime.ui.targetHeadingWorldPosition).toEqual({ x: 12, y: 34 })
    expect(runtime.ui.targetHeadingSelectionEpoch).toBe(1)
    expect(runtime.simulation.assistMode).toBe('off')
  })

  it('shows a planned target heading without committing the turn until confirmation', () => {
    const runtime = createRuntime()
    const createRipple = vi.fn()
    const runtimeActions = createTestRuntimeActions(runtime, { createRipple })

    runtime.simulation.targetHeading = null
    runtime.simulation.assistMode = 'capture'
    runtime.simulation.timeWarpIndex = requestedTimeWarps.indexOf(3600)
    runtimeActions.planTargetHeading({
      heading: 1.2,
      screenPosition: { x: 300, y: 200 },
      worldPosition: { x: 12, y: 34 },
    })

    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.simulation.timeWarpIndex).toBe(
      requestedTimeWarps.indexOf(60),
    )
    expect(runtime.ui.targetHeadingPlan).toEqual({
      heading: 1.2,
      screenPosition: { x: 300, y: 200 },
      worldPosition: { x: 12, y: 34 },
    })
    expect(runtime.ui.targetHeadingSelectionEpoch).toBe(0)

    expect(runtimeActions.commitTargetHeadingPlan()).toBe(true)

    expect(runtime.simulation.targetHeading).toBe(1.2)
    expect(runtime.ui.targetHeadingPlan).toBeNull()
    expect(runtime.ui.targetHeadingScreenPosition).toEqual({ x: 300, y: 200 })
    expect(runtime.ui.targetHeadingWorldPosition).toEqual({ x: 12, y: 34 })
    expect(runtime.ui.targetHeadingSelectionEpoch).toBe(1)
    expect(runtime.simulation.assistMode).toBe('off')
    expect(createRipple).not.toHaveBeenCalled()
  })

  it('keeps slower time warp unchanged when planning a target heading', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtime.simulation.timeWarpIndex = 1
    runtimeActions.planTargetHeading({
      heading: 1.2,
      screenPosition: { x: 300, y: 200 },
      worldPosition: { x: 12, y: 34 },
    })

    expect(runtime.simulation.timeWarpIndex).toBe(1)
  })

  it('uses a time-warp action during navigation as the new restore target', () => {
    const runtime = createRuntime()
    const navigationTimeWarpController = createNavigationTimeWarpController({
      maxControlWarp: 100,
      timeWarps: requestedTimeWarps,
    })
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const cappedTimeWarpIndex = requestedTimeWarps.indexOf(60)
    const replacementTimeWarpIndex = requestedTimeWarps.indexOf(120)
    runtime.simulation.timeWarpIndex =
      navigationTimeWarpController.resolveFrame({
        maxTimeWarp: null,
        nowMs: 0,
        simulationNavigationActive: true,
        timeWarpIndex: originalTimeWarpIndex,
      })
    const runtimeActions = createTestRuntimeActions(runtime, {
      navigationTimeWarpController,
    })

    runtimeActions.handleUIUserAction('increaseTimeWarp')

    expect(runtime.simulation.timeWarpIndex).toBe(cappedTimeWarpIndex)
    navigationTimeWarpController.resolveFrame({
      maxTimeWarp: null,
      nowMs: 100,
      simulationNavigationActive: false,
      timeWarpIndex: runtime.simulation.timeWarpIndex,
    })
    expect(
      navigationTimeWarpController.resolveFrame({
        maxTimeWarp: null,
        nowMs: 420,
        simulationNavigationActive: false,
        timeWarpIndex: runtime.simulation.timeWarpIndex,
      }),
    ).toBe(replacementTimeWarpIndex)
  })

  it('clears a planned target heading when cycling assist mode', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.planTargetHeading({
      heading: 1.2,
      screenPosition: { x: 300, y: 200 },
      worldPosition: { x: 12, y: 34 },
    })

    runtimeActions.handleUIUserAction('cycleAssistMode')

    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.simulation.targetHeadingTurn).toBeNull()
    expect(runtime.ui.targetHeadingPlan).toBeNull()
  })

  it('updates the reset target when free roam starts', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.startFreeRoam()

    expect(runtime.scenario.session.scenarioId).toBe('earth-moon')
    expect(runtime.scenario.metadata.title).toBe('Earth-Moon sandbox')

    runtime.simulation.timeWarpIndex = 4
    runtimeActions.resetScenario()

    expect(runtime.simulation.timeWarpIndex).toBe(0)
    expect(runtime.scenario.session.scenarioId).toBe('earth-moon')
  })

  it('starts the Reach the Moon scenario shell', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.startReachMoon()

    expect(runtime.scenario.session.scenarioId).toBe('reach-moon')
    expect(runtime.scenario.metadata.title).toBe('Reach the Moon')
  })

  it('changes coast horizon on the trajectory whole-day ladder', () => {
    const runtime = createRuntime()
    runtime.simulation.coastPredictionHorizonHours = 16
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.handleUIUserAction('increaseCoastHorizon')).toEqual({
      refreshTrajectoryPrediction: true,
    })
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(24)

    runtimeActions.handleUIUserAction('increaseCoastHorizon')
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(48)

    runtimeActions.handleUIUserAction('decreaseCoastHorizon')
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(24)

    runtimeActions.handleUIUserAction('decreaseCoastHorizon')
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(16)
  })

  it('requests a trajectory refresh when cycling the assist target', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.handleUIUserAction('cycleAssistTarget')).toEqual({
      refreshTrajectoryPrediction: true,
    })

    expect(runtime.simulation.assistTargetIndex).toBe(0)
    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
  })

  it('selects a manual assist target by index', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.selectAssistTargetIndex(0)).toBe(true)

    expect(runtime.simulation.assistTargetIndex).toBe(0)
    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
  })

  it('wraps manual assist target selection to available bodies', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.selectAssistTargetIndex(-1)).toBe(true)

    expect(runtime.simulation.assistTargetIndex).toBe(1)
    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
  })

  it('returns to automatic assist target selection when auto targeting is available', () => {
    const runtime = createRuntime()
    runtime.simulation.assistTargetSelectionMode = 'manual'
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.returnToAutomaticAssistTargetSelection()).toBe(true)

    expect(runtime.simulation.assistTargetSelectionMode).toBe('auto')
  })

  it('keeps manual assist target selection when auto targeting is unavailable', () => {
    const runtime = createRuntime()
    runtime.simulation.assistTargetSelectionMode = 'manual'
    const runtimeActions = createTestRuntimeActions(runtime, {
      autoSelectNearestSurface: false,
    })

    expect(runtimeActions.returnToAutomaticAssistTargetSelection()).toBe(false)

    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
  })

  it('switches to the menu background scenario and menu-only overrides', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.enterMainMenuBackground()

    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.ui.spacecraftLabelIntroUntil).toBe(Number.POSITIVE_INFINITY)
    expect(requestedTimeWarps[runtime.simulation.timeWarpIndex]).toBe(240)
  })

  it('syncs directives immediately after acknowledging the tutorial intro prompt', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
      },
      {
        activePromptId: 'phase-one-intro',
        replayPromptId: null,
      },
    )
    const runtimeActions = createTestRuntimeActions(runtime)

    const result = runtimeActions.dispatchScenarioPromptAction({
      kind: 'scenario',
      id: 'start-phase-one-onboarding',
    })

    expect(result).toEqual({ handled: true, effect: undefined })
    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-show-thrust-control',
        gateActive: true,
      },
    })
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: 'intro-show-thrust-control',
      replayPromptId: 'phase-one-intro',
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'timeWarpPill',
        'trajectory',
      ]),
    )
  })

  it('syncs directives immediately after reopening the tutorial intro prompt', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-show-thrust-control',
          completedStepIds: [],
          gateActive: true,
          progress: {
            accumulatedHeadingChangeRadians: 0,
            accumulatedMainThrustMs: 0,
            lastSampleHeading: runtime.simulation.state.spacecraft.heading,
            lastSampleAtMs: 1_000,
            stepStartHeading: runtime.simulation.state.spacecraft.heading,
            stepStartTouchThrustControlEngaged: false,
            stepStartTargetHeadingSelectionEpoch: 0,
            stepStartTimeWarpMultiplier: 1,
          },
        },
      },
      {
        activePromptId: null,
        replayPromptId: 'phase-one-intro',
      },
    )
    const runtimeActions = createTestRuntimeActions(runtime)
    runtime.scenario.directives = createDefaultScenarioDirectives()

    expect(runtimeActions.reopenScenarioPrompt()).toBe(true)
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: 'phase-one-intro',
      replayPromptId: 'phase-one-intro',
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'timeWarpPill',
        'trajectory',
      ]),
    )
  })

  it('rescales the heading target screen position on resize', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window

    try {
      setWindowSize(400, 800)
      const runtime = createRuntime()
      runtime.ui.targetHeadingScreenPosition = { x: 300, y: 200 }
      const renderer = { setSize: vi.fn() }
      const updateCameraViewSpy = vi
        .spyOn(sceneUpdates, 'updateCameraView')
        .mockImplementation(() => {})
      const runtimeActions = createRuntimeActions({
        app: {} as HTMLDivElement,
        autoSelectNearestSurface: true,
        cameraDistance: 700,
        cameraElevation: 1,
        createRipple: () => {},
        gameScene: { trailPoints: [] } as never,
        getAssistTargetUiState: () => ({
          activeTarget: getRequiredBody(runtime, 0),
          mode: 'manual',
          recommendedTarget: null,
        }),
        maxCoastPredictionHorizonHours: 48,
        maxViewport: EARTH_MOON_VIEWPORT_SIZE,
        minCoastPredictionHorizonHours: 0.5,
        minViewport: EARTH_VIEWPORT_SIZE,
        navigationTimeWarpController: createNavigationTimeWarpController({
          maxControlWarp: 100,
          timeWarps: requestedTimeWarps,
        }),
        renderer,
        ripples: [],
        runtime,
        globalScenarioDirectiveLimits,
        runtimeScenarioOptions,
        timeWarps: requestedTimeWarps,
        updateUserSettings: () => {},
        gameHighLevelActions: new GameHighLevelActionsMediator(),
      })

      setWindowSize(800, 400)
      runtimeActions.handleResize()

      expect(renderer.setSize).toHaveBeenCalledWith(800, 400)
      expect(updateCameraViewSpy).toHaveBeenCalledOnce()
      expect(runtime.ui.targetHeadingScreenPosition).toEqual({
        x: 600,
        y: 100,
      })
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })
})

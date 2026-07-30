import { describe, expect, it, vi } from 'vitest'
import {
  getRecentDebugScenarioSnapshots,
  readDebugScenarioSnapshot,
} from '@/debugScenarioSnapshot'
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
    camera: {
      follow: 'spacecraft',
      panOffset: { x: 0, y: 0 },
    },
    spacecraftLabelIntroUntil: 0,
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

const createRendererDouble = (initialPixelRatio = 1) => {
  let pixelRatio = initialPixelRatio

  return {
    getPixelRatio: vi.fn(() => pixelRatio),
    setPixelRatio: vi.fn((nextPixelRatio: number) => {
      pixelRatio = nextPixelRatio
    }),
    setSize: vi.fn(),
  }
}

const createStorageDouble = () => {
  const values = new Map<string, string>()

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

const createTestRuntimeActions = (
  runtime: AppRuntimeState,
  options: {
    autoSelectNearestSurface?: boolean
    getFollowCameraViewportBottomInset?: () => number
    navigationTimeWarpController?: NavigationTimeWarpController
    renderer?: Parameters<typeof createRuntimeActions>[0]['renderer']
  } = {},
) =>
  createRuntimeActions({
    autoSelectNearestSurface: options.autoSelectNearestSurface ?? true,
    cameraDistance: 700,
    cameraElevation: 1,
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
        timeWarps: requestedTimeWarps,
      }),
    renderer: options.renderer ?? createRendererDouble(),
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
      devicePixelRatio: number
      innerHeight: number
      innerWidth: number
    }
  }

const setWindowSize = (width: number, height: number, devicePixelRatio = 1) => {
  const globals = getTestGlobals()
  if (!globals.window) {
    globals.window = {
      devicePixelRatio,
      innerHeight: height,
      innerWidth: width,
    }
    return
  }

  globals.window.devicePixelRatio = devicePixelRatio
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
  it('captures the live state when export is pressed and records the initiated download', async () => {
    const runtime = createRuntime()
    const storage = createStorageDouble()
    const downloadLink = {
      click: vi.fn(),
      download: '',
      hidden: false,
      href: '',
      remove: vi.fn(),
    }
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:runtime-snapshot')
    const revokeObjectURL = vi.fn()
    vi.useFakeTimers()
    vi.setSystemTime('2026-07-30T08:30:00.000Z')
    vi.stubGlobal('window', { localStorage: storage })
    vi.stubGlobal('document', {
      body: { append: vi.fn() },
      createElement: vi.fn(() => downloadLink),
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    try {
      const runtimeActions = createTestRuntimeActions(runtime)
      runtime.simulation.state.elapsed = 321
      runtime.simulation.state.spacecraft.position = { x: 123, y: 456 }

      expect(runtimeActions.exportCurrentDebugSnapshot()).toEqual({
        downloadStarted: true,
        recentEntrySaved: true,
      })

      expect(downloadLink.download).toBe(
        'space-web-game-tutorial-2026-07-30T08-30-00-000Z.json',
      )
      expect(downloadLink.click).toHaveBeenCalledOnce()
      expect(downloadLink.remove).toHaveBeenCalledOnce()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:runtime-snapshot')
      const downloadedBlob = createObjectURL.mock.calls[0]?.[0]
      expect(downloadedBlob).toBeInstanceOf(Blob)
      const downloadedSnapshot = JSON.parse(
        (await downloadedBlob?.text()) ?? '',
      )

      const [recentEntry] = getRecentDebugScenarioSnapshots()
      expect(recentEntry).toMatchObject({
        lastExportedAt: '2026-07-30T08:30:00.000Z',
        snapshot: {
          elapsed: 321,
          runtimeScenario: { scenarioId: 'tutorial' },
          spacecraft: { position: { x: 123, y: 456 } },
        },
      })
      expect(downloadedSnapshot).toEqual(recentEntry.snapshot)
      expect(recentEntry.snapshot).not.toHaveProperty('lastExportedAt')
      expect(readDebugScenarioSnapshot()).toBeNull()
      expect(runtime.debug.debugSnapshotStatus).toBe('snapshot exported')
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('does not record an exported entry when download initiation fails', () => {
    const runtime = createRuntime()
    const storage = createStorageDouble()
    vi.stubGlobal('window', { localStorage: storage })
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        throw new Error('Downloads blocked')
      },
    })

    try {
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.exportCurrentDebugSnapshot()).toEqual({
        downloadStarted: false,
        recentEntrySaved: false,
      })
      expect(getRecentDebugScenarioSnapshots()).toEqual([])
      expect(runtime.debug.debugSnapshotStatus).toBe('snapshot export failed')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports partial success when download starts but the recent entry cannot be saved', () => {
    const runtime = createRuntime()
    const storage = createStorageDouble()
    const originalSetItem = storage.setItem
    storage.setItem = vi.fn((key: string, value: string) => {
      if (key.includes('recentDebugScenarioSnapshots')) {
        throw new Error('Storage quota exceeded')
      }
      originalSetItem(key, value)
    })
    const downloadLink = {
      click: vi.fn(),
      download: '',
      hidden: false,
      href: '',
      remove: vi.fn(),
    }
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:runtime-snapshot')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('window', { localStorage: storage })
    vi.stubGlobal('document', {
      body: { append: vi.fn() },
      createElement: vi.fn(() => downloadLink),
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    try {
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.exportCurrentDebugSnapshot()).toEqual({
        downloadStarted: true,
        recentEntrySaved: false,
      })
      expect(downloadLink.click).toHaveBeenCalledOnce()
      expect(downloadLink.remove).toHaveBeenCalledOnce()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:runtime-snapshot')
      expect(storage.setItem).toHaveBeenCalledOnce()
      expect(storage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('recentDebugScenarioSnapshots'),
        expect.any(String),
      )
      expect(getRecentDebugScenarioSnapshots()).toEqual([])
      expect(runtime.debug.debugSnapshotStatus).toBe(
        'snapshot downloaded; recent entry save failed',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

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
      periapsisInfoPin,
      apoapsisInfoPin,
    ])
    expect(runtimeActions.toggleUserInfoPin(periapsisInfoPin)).toBe(true)
    expect(runtime.info.userPins).toEqual([createBodyInfoPin('earth')])
    expect(runtimeActions.toggleUserInfoPin(periapsisInfoPin)).toBe(true)
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

  it('pans relative to the followed spacecraft and recenters', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.canRecenterCamera()).toBe(false)
      expect(runtimeActions.panCamera({ x: 10, y: -5 })).toBe(true)
      expect(runtimeActions.canRecenterCamera()).toBe(true)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 10, y: -5 })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 60, y: 55 },
        }),
      )

      expect(runtimeActions.recenterCamera()).toBe(true)
      expect(runtimeActions.canRecenterCamera()).toBe(false)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 0, y: 0 })
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

  it('zooms a panned camera around a world focal point in one update', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.ui.camera = {
      follow: 'spacecraft',
      panOffset: { x: 50, y: 140 },
    }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      runtimeActions.zoomCamera(0.5, { x: 300, y: 500 })

      expect(runtime.simulation.viewportSize).toBe(300)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 150, y: 290 })
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

  it('preserves pan while following live targets and switching Follow', () => {
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

      expect(runtimeActions.setCameraFollow('target')).toBe(true)
      expect(runtime.ui.camera.follow).toBe('target')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 150, y: 160 },
        }),
      )

      expect(runtimeActions.panCamera({ x: 10, y: -5 })).toBe(true)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 10, y: -5 })

      runtime.simulation.state.bodies[1] = {
        ...getRequiredBody(runtime, 1),
        position: { x: 180, y: 190 },
      }
      runtimeActions.updateCamera()
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 190, y: 185 },
        }),
      )

      expect(runtimeActions.setCameraFollow('spacecraft')).toBe(true)
      expect(runtime.ui.camera).toEqual({
        follow: 'spacecraft',
        panOffset: { x: 10, y: -5 },
      })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 60, y: 55 },
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

  it('applies the current mobile viewport inset to centered and panned framing', () => {
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

      runtimeActions.setCameraFollow('target')
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 260 }),
      )

      runtimeActions.panCamera({ x: 10, y: -5 })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 260 }),
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

  it('recenters from the current playable viewport framing', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      const viewportHeight = 844
      let viewportBottomInset = 260
      setWindowSize(390, viewportHeight)
      const runtimeActions = createTestRuntimeActions(runtime, {
        getFollowCameraViewportBottomInset: () => viewportBottomInset,
      })

      runtimeActions.panCamera({ x: 17, y: -9 })
      expect(runtimeActions.recenterCamera()).toBe(true)
      expect(runtime.ui.camera.panOffset).toEqual({ x: 0, y: 0 })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: runtime.simulation.state.spacecraft.position,
          viewportBottomInset: 260,
        }),
      )

      viewportBottomInset = 120
      runtimeActions.updateCamera()
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ viewportBottomInset: 120 }),
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

  it('recenters whenever Follow changes and through the explicit action', () => {
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

      runtime.ui.camera.panOffset = { x: 3, y: 4 }
      expect(runtimeActions.handleUIUserAction('toggleCameraFollow')).toEqual({
        refreshTrajectoryPrediction: false,
      })
      expect(runtime.ui.camera).toEqual({
        follow: 'target',
        panOffset: { x: 3, y: 4 },
      })

      runtimeActions.panCamera({ x: 7, y: -2 })
      runtimeActions.handleUIUserAction('recenterCamera')
      expect(runtime.ui.camera).toEqual({
        follow: 'target',
        panOffset: { x: 0, y: 0 },
      })

      runtimeActions.panCamera({ x: 7, y: -2 })
      runtimeActions.handleUIUserAction('toggleCameraFollow')
      expect(runtime.ui.camera).toEqual({
        follow: 'spacecraft',
        panOffset: { x: 7, y: -2 },
      })
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: { x: 57, y: 58 },
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

  it('does not change camera controls while scenario directives lock them', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.scenario.directives.cameraControlsLocked = true
    runtime.ui.camera = {
      follow: 'spacecraft',
      panOffset: { x: 12, y: 24 },
    }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      expect(runtimeActions.setCameraFollow('target')).toBe(false)
      expect(runtimeActions.recenterCamera()).toBe(false)
      expect(runtimeActions.panCamera({ x: 3, y: 4 })).toBe(false)
      runtimeActions.panCameraForCrashInspection()
      runtimeActions.zoomCamera(0.5, { x: 300, y: 500 })
      expect(runtime.ui.camera).toEqual({
        follow: 'spacecraft',
        panOffset: { x: 12, y: 24 },
      })
      expect(runtime.simulation.viewportSize).toBe(300)
      expect(updateCameraViewSpy).toHaveBeenCalledTimes(1)
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
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

  it('pans the camera with the follow target framed above the crash panel', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window
    const runtime = createRuntime()
    runtime.ui.camera.panOffset = { x: 999, y: 999 }
    const updateCameraViewSpy = vi
      .spyOn(sceneUpdates, 'updateCameraView')
      .mockImplementation(() => {})

    try {
      setWindowSize(800, 400)
      const runtimeActions = createTestRuntimeActions(runtime)

      runtimeActions.panCameraForCrashInspection()

      const expectedOffset =
        (runtime.simulation.viewportSize * 0.5 * 0.38 * Math.sin(1)) /
        (Math.SQRT2 * RENDER_SCALE)

      expect(runtime.ui.camera.panOffset.x).toBeCloseTo(expectedOffset)
      expect(runtime.ui.camera.panOffset.y).toBeCloseTo(expectedOffset)
      expect(updateCameraViewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cameraTargetPosition: {
            x: runtime.simulation.state.spacecraft.position.x + expectedOffset,
            y: runtime.simulation.state.spacecraft.position.y + expectedOffset,
          },
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

  it('uses a time-warp action during navigation as the new restore target', () => {
    const runtime = createRuntime()
    const navigationTimeWarpController = createNavigationTimeWarpController({
      timeWarps: requestedTimeWarps,
    })
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const cappedTimeWarpIndex = requestedTimeWarps.indexOf(60)
    const replacementTimeWarpIndex = requestedTimeWarps.indexOf(120)
    runtime.simulation.timeWarpIndex =
      navigationTimeWarpController.resolveFrame({
        maxTimeWarp: null,
        nowMs: 0,
        simulationControlMaxWarp: 100,
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
      simulationControlMaxWarp: null,
      timeWarpIndex: runtime.simulation.timeWarpIndex,
    })
    expect(
      navigationTimeWarpController.resolveFrame({
        maxTimeWarp: null,
        nowMs: 420,
        simulationControlMaxWarp: null,
        timeWarpIndex: runtime.simulation.timeWarpIndex,
      }),
    ).toBe(replacementTimeWarpIndex)
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

  it('resizes the renderer and camera to the new viewport', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window

    try {
      setWindowSize(400, 800)
      const runtime = createRuntime()
      const renderer = createRendererDouble()
      const updateCameraViewSpy = vi
        .spyOn(sceneUpdates, 'updateCameraView')
        .mockImplementation(() => {})
      const runtimeActions = createTestRuntimeActions(runtime, { renderer })

      setWindowSize(800, 400)
      runtimeActions.handleResize()

      expect(renderer.getPixelRatio).toHaveBeenCalledOnce()
      expect(renderer.setPixelRatio).not.toHaveBeenCalled()
      expect(renderer.setSize).toHaveBeenCalledWith(800, 400)
      expect(updateCameraViewSpy).toHaveBeenCalledOnce()
      expect(runtime.simulation.viewportSize).toBe(600)
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('updates a changed pixel ratio before size without changing gameplay state', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window

    try {
      setWindowSize(800, 400, 1.5)
      const runtime = createRuntime()
      const simulationBefore = structuredClone(runtime.simulation)
      const renderer = createRendererDouble()
      const updateCameraViewSpy = vi
        .spyOn(sceneUpdates, 'updateCameraView')
        .mockImplementation(() => {})
      const runtimeActions = createTestRuntimeActions(runtime, { renderer })

      runtimeActions.handleResize()

      expect(renderer.setPixelRatio).toHaveBeenCalledOnce()
      expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
      expect(renderer.setSize).toHaveBeenCalledWith(800, 400)
      expect(renderer.getPixelRatio.mock.invocationCallOrder[0]).toBeLessThan(
        renderer.setPixelRatio.mock.invocationCallOrder[0] ?? 0,
      )
      expect(renderer.setPixelRatio.mock.invocationCallOrder[0]).toBeLessThan(
        renderer.setSize.mock.invocationCallOrder[0] ?? 0,
      )
      expect(renderer.setSize.mock.invocationCallOrder[0]).toBeLessThan(
        updateCameraViewSpy.mock.invocationCallOrder[0] ?? 0,
      )
      expect(updateCameraViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          viewportHeight: 400,
          viewportSize: 600,
          viewportWidth: 800,
        }),
      )
      expect(runtime.simulation).toEqual(simulationBefore)
    } finally {
      if (originalWindow === undefined) {
        delete globals.window
      } else {
        globals.window = originalWindow
      }
      vi.restoreAllMocks()
    }
  })

  it('caps the pixel ratio at two and skips redundant updates', () => {
    const globals = getTestGlobals()
    const originalWindow = globals.window

    try {
      setWindowSize(640, 480, 3)
      const runtime = createRuntime()
      const renderer = createRendererDouble()
      const updateCameraViewSpy = vi
        .spyOn(sceneUpdates, 'updateCameraView')
        .mockImplementation(() => {})
      const runtimeActions = createTestRuntimeActions(runtime, { renderer })

      runtimeActions.handleResize()
      setWindowSize(640, 480, 4)
      runtimeActions.handleResize()

      expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1)
      expect(renderer.setPixelRatio).toHaveBeenCalledWith(2)
      expect(renderer.setSize).toHaveBeenNthCalledWith(1, 640, 480)
      expect(renderer.setSize).toHaveBeenNthCalledWith(2, 640, 480)
      expect(updateCameraViewSpy).toHaveBeenCalledTimes(2)
      expect(runtime.simulation.viewportSize).toBe(600)
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

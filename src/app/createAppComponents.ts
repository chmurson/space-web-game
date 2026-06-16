import * as THREE from 'three'
import { installDevtoolsBridge } from '../devtools/devtoolsBridge'
import { bindKeyboardShortcuts } from '../input/bindKeyboardShortcuts'
import { createKeyboardInput } from '../input/keyboardInput'
import {
  bindPointerCameraInput,
  createScreenPointWorldPicker,
} from '../input/pointerCameraInput'
import type { UIUserAction } from '../input/uiUserActions'
import { createBodyPresentation } from '../presentation/bodyPresentation'
import { createHudPresentation } from '../presentation/hudPresentation'
import { createSpacecraftPresentation } from '../presentation/spacecraftPresentation'
import { createTrajectoryPresentation } from '../presentation/trajectoryPresentation'
import { createRendererProfiler } from '../render/rendererProfiler'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import { createFrameLoop } from '../runtime/frameLoop'
import { createGameQueries } from '../runtime/gameQueries'
import { GameHighLevelActionsMediator } from '../runtime/highLevelActions/gameHighLevelActionDispatcher'
import { registerHighLevelActions } from '../runtime/highLevelActions/registerHighLevelActions'
import { createRuntimeActions } from '../runtime/runtimeActions'
import { defaultMaxControlWarp } from '../runtime/simulationStep'
import {
  getTimeWarpFeedbackPreview,
  getTimeWarpFeedbackPreviews,
} from '../runtime/timeWarpFeedbackPolicy'
import { getTrajectoryHorizonPreviews } from '../runtime/trajectoryHorizonControlPolicy'
import { createTrajectoryPredictionRuntime } from '../runtime/trajectoryPredictionRuntime'
import { parsePromptAction } from '../scenario/scenarioPrompts'
import { createGameScene } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import { createInGameControlsMenu } from '../ui/createInGameControlsMenu'
import { type CrashMenu, createCrashMenu } from '../ui/createCrashMenu'
import { createMainMenu, type MainMenu } from '../ui/createMainMenu'
import {
  createTopMenu,
  type TopMenu,
  type TopMenuAction,
} from '../ui/createTopMenu'
import {
  createUiSettingsDialog,
  type UiSettingsDialog,
} from '../ui/createUiSettingsDialog'
import {
  createOverlayUi,
  type OverlayUiRefs,
} from '../ui/overlayUI/createOverlayUi'
import { createRipple, type Ripple } from '../ui/overlayUpdates'
import { createTouchControls } from '../ui/touchControls/createTouchControls'
import {
  type TouchControlSide,
  type TouchTrajectoryControlState,
  updateUserSettings,
} from '../userSettingsStorage'
import type { AppConfigContext, AppMode } from './createAppConfigContext'

type AppRuntimeCoordinator = {
  dispatchRuntimeAction(action: UIUserAction): void
  getAppMode(): AppMode
  initialize(): void
}

const cameraUnlockNoticeDurationMs = 2400

export type AppComponents = {
  renderer: THREE.WebGLRenderer
  keyboardInput: ReturnType<typeof createKeyboardInput>
  overlayUi: OverlayUiRefs
  runtimeActions: ReturnType<typeof createRuntimeActions>
  frameLoop: ReturnType<typeof createFrameLoop>
  mainMenu: MainMenu
  topMenu: TopMenu
  crashMenu: CrashMenu
  initialize(): void
  start(): void
}

const createRuntimeCoordinator = (options: {
  app: HTMLDivElement
  config: AppConfigContext
  keyboardInput: ReturnType<typeof createKeyboardInput>
  mainMenu: MainMenu
  crashMenu: CrashMenu
  topMenu: TopMenu
  uiSettingsDialog: UiSettingsDialog
  frameLoop: ReturnType<typeof createFrameLoop>
  runtimeActions: ReturnType<typeof createRuntimeActions>
  runtimeState: AppRuntimeState
  gameHighLevelActionsMediator: GameHighLevelActionsMediator
}): AppRuntimeCoordinator => {
  let appMode = options.config.initialAppMode

  const setAppMode = (newAppMode: AppMode) => {
    appMode = newAppMode
  }

  const dispatchRuntimeAction = (action: UIUserAction) => {
    if (appMode !== 'game') {
      return
    }

    const result = options.runtimeActions.handleUIUserAction(action)

    if (result.refreshTrajectoryPrediction) {
      options.frameLoop.refreshTrajectoryPrediction()
    }

    options.crashMenu.syncState({
      hasCheckpoint: options.runtimeState.scenario.session.checkpoint !== null,
    })
    options.topMenu.syncState()
  }

  registerHighLevelActions({
    gameMediator: options.gameHighLevelActionsMediator,
    keyboardInput: options.keyboardInput,
    app: options.app,
    setAppMode,
    frameLoop: options.frameLoop,
    runtimeActions: options.runtimeActions,
    mainMenu: options.mainMenu,
    crashMenu: options.crashMenu,
    topMenu: options.topMenu,
    runtime: options.runtimeState,
  })

  return {
    dispatchRuntimeAction,
    getAppMode: () => appMode,
    initialize: () => {
      if (appMode === 'menu') {
        options.app.classList.add('app-main-menu')
        options.crashMenu.setVisible(false)
        options.mainMenu.syncState()
        options.mainMenu.setVisible(true)
        options.topMenu.close()
        options.uiSettingsDialog.close(false)
        options.frameLoop.refreshTrajectoryPrediction()
        return
      }

      options.crashMenu.setVisible(false)
      options.mainMenu.setVisible(false)
    },
  }
}

const createCameraUnlockNoticePresenter = (overlayUi: OverlayUiRefs) => {
  let hideTimeout: number | null = null
  let finishHideTimeout: number | null = null

  const hide = () => {
    overlayUi.cameraUnlockNotice.dataset.visible = 'false'
    overlayUi.cameraUnlockNotice.setAttribute('aria-hidden', 'true')
    finishHideTimeout = window.setTimeout(() => {
      if (overlayUi.cameraUnlockNotice.dataset.visible !== 'true') {
        overlayUi.cameraUnlockNotice.hidden = true
      }
      finishHideTimeout = null
    }, 180)
    hideTimeout = null
  }

  return {
    show() {
      if (finishHideTimeout !== null) {
        window.clearTimeout(finishHideTimeout)
        finishHideTimeout = null
      }
      overlayUi.cameraUnlockNotice.hidden = false
      overlayUi.cameraUnlockNoticeTitle?.replaceChildren('Camera unlocked')
      overlayUi.cameraUnlockNoticeBody?.replaceChildren()
      overlayUi.cameraUnlockNotice.setAttribute(
        'aria-label',
        'Camera unlocked. Drag anywhere to pan.',
      )
      overlayUi.cameraUnlockNotice.setAttribute('aria-hidden', 'false')
      window.requestAnimationFrame(() => {
        overlayUi.cameraUnlockNotice.dataset.visible = 'true'
      })

      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout)
      }
      hideTimeout = window.setTimeout(hide, cameraUnlockNoticeDurationMs)
    },
  }
}

export const createAppComponents = (options: {
  app: HTMLDivElement
  config: AppConfigContext
  runtimeState: AppRuntimeState
}): AppComponents => {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x05070d)
  options.app.appendChild(renderer.domElement)

  const keyboardInput = createKeyboardInput()
  const rendererProfiler = createRendererProfiler(renderer)
  const gameScene = createGameScene(
    options.runtimeState.simulation.state.bodies,
    options.config.trajectory.rendering,
  )
  const trajectoryPredictionRuntime = createTrajectoryPredictionRuntime()
  const ripples: Ripple[] = []
  const overlayUi = createOverlayUi({
    app: options.app,
    bodies: options.runtimeState.simulation.state.bodies,
    showCycleTargetHint: !options.config.assistTarget.autoSelectNearestSurface,
  })
  const cameraUnlockNotice = createCameraUnlockNoticePresenter(overlayUi)
  const queries = createGameQueries({
    autoSelectNearestSurface:
      options.config.assistTarget.autoSelectNearestSurface,
    autoSelectConfig: {
      switchRangeMultiplier: options.config.assistTarget.switchRangeMultiplier,
    },
    autopilotRotationRate: options.config.controls.autopilotRotationRate,
    getPredictedTrajectoryEnd: () =>
      trajectoryPredictionRuntime.getState().absolutePredictionEnd,
    getPredictedTrajectoryPoints: () =>
      trajectoryPredictionRuntime.getState().absolutePredictionPoints,
    maxPredictionLoopRevolutions:
      options.config.trajectory.maxPredictionLoopRevolutions,
    predictionSampling: options.config.trajectory.predictionSampling,
    runtime: options.runtimeState,
  })
  const trajectoryPresentation = createTrajectoryPresentation({
    gameScene,
    physicsEngine: options.config.physicsEngine,
    queries,
    runtime: options.runtimeState,
    trajectoryPredictionRuntime,
  })
  const pickWorldPointFromScreenPoint = createScreenPointWorldPicker(
    gameScene.camera,
    renderer.domElement,
    RENDER_SCALE,
  )
  const panCameraBetweenScreenPoints = (
    previous: { x: number; y: number },
    next: { x: number; y: number },
  ) => {
    const previousWorld = pickWorldPointFromScreenPoint(previous.x, previous.y)
    const nextWorld = pickWorldPointFromScreenPoint(next.x, next.y)

    if (!previousWorld || !nextWorld) {
      return false
    }

    return runtimeActions.panCamera({
      x: previousWorld.x - nextWorld.x,
      y: previousWorld.y - nextWorld.y,
    })
  }
  const zoomCameraAroundScreenPoint = (
    factor: number,
    focalPoint?: { x: number; y: number },
  ) => {
    if (!focalPoint || runtimeActions.getCameraMode() !== 'unlocked') {
      runtimeActions.zoomCamera(factor)
      return
    }

    const previousWorld = pickWorldPointFromScreenPoint(
      focalPoint.x,
      focalPoint.y,
    )
    runtimeActions.zoomCamera(factor)
    const nextWorld = pickWorldPointFromScreenPoint(focalPoint.x, focalPoint.y)

    if (!previousWorld || !nextWorld) {
      return
    }

    runtimeActions.panCamera({
      x: previousWorld.x - nextWorld.x,
      y: previousWorld.y - nextWorld.y,
    })
  }
  const gameHighLevelActionsMediator = new GameHighLevelActionsMediator()
  const runtimeActions = createRuntimeActions({
    app: options.app,
    autoSelectNearestSurface:
      options.config.assistTarget.autoSelectNearestSurface,
    gameHighLevelActions: gameHighLevelActionsMediator,
    cameraDistance: options.config.camera.distance,
    cameraElevation: options.config.camera.elevation,
    createRipple,
    gameScene,
    maxCoastPredictionHorizonHours:
      options.config.trajectory.maxCoastPredictionHorizonHours,
    maxViewport: options.config.camera.maxViewport,
    minCoastPredictionHorizonHours:
      options.config.trajectory.minCoastPredictionHorizonHours,
    minViewport: options.config.camera.minViewport,
    renderer,
    ripples,
    runtime: options.runtimeState,
    globalScenarioDirectiveLimits: options.config.globalScenarioDirectiveLimits,
    runtimeScenarioOptions: options.config.runtimeScenarioOptions,
    timeWarps: options.config.controls.timeWarps,
    updateUserSettings,
  })
  let dispatchRuntimeAction: (action: UIUserAction) => void = () => {}
  let touchBurnControlSide: TouchControlSide =
    options.config.userSettings.touchBurnControlSide
  let touchTargetControlSide: TouchControlSide =
    options.config.userSettings.touchTargetControlSide
  let touchTrajectoryControlSide: TouchTrajectoryControlState =
    options.config.userSettings.touchTrajectoryControlSide
  let touchWarpControlSide: TouchControlSide =
    options.config.userSettings.touchWarpControlSide
  let uiSettingsOpen = false
  let getAppMode = () => options.config.initialAppMode
  const getGameInteractionsEnabled = () =>
    getAppMode() === 'game' && !uiSettingsOpen
  const touchControls = createTouchControls({
    app: options.app,
    automaticTargetingAvailable:
      options.config.assistTarget.autoSelectNearestSurface,
    commitTrajectoryHorizon: (action) => {
      dispatchRuntimeAction(action)
    },
    commitTimeWarp: (action) => {
      dispatchRuntimeAction(action)
    },
    getCurrentTrajectoryHorizonHours: () =>
      options.runtimeState.simulation.coastPredictionHorizonHours,
    getCurrentTimeWarp: () =>
      options.config.controls.timeWarps[
        options.runtimeState.simulation.timeWarpIndex
      ] ?? 1,
    getInteractionsEnabled: getGameInteractionsEnabled,
    getAssistTargetUiState: queries.getAssistTargetUiState,
    getTargetControlRows: () =>
      options.runtimeState.simulation.state.bodies.map((body, index) => ({
        body,
        distanceMeters: queries.getCaptureMetrics(body).surfaceDistance,
        index,
      })),
    getTrajectoryHorizonPreviews: (action, count) =>
      getTrajectoryHorizonPreviews({
        action,
        count,
        currentHours:
          options.runtimeState.simulation.coastPredictionHorizonHours,
        maxHours:
          options.runtimeState.scenario.directives
            .maxCoastPredictionHorizonHours ??
          options.config.trajectory.maxCoastPredictionHorizonHours,
        minHours: options.config.trajectory.minCoastPredictionHorizonHours,
      }),
    getTimeWarpPreview: (action) => {
      return getTimeWarpFeedbackPreview({
        action,
        assistMode: options.runtimeState.simulation.assistMode,
        crashedBodyName: options.runtimeState.simulation.crashedBodyName,
        currentTimeWarpIndex: options.runtimeState.simulation.timeWarpIndex,
        getAssistTarget: queries.getAssistTarget,
        getAutopilotTurn: queries.getAutopilotTurn,
        getCaptureMetrics: queries.getCaptureMetrics,
        getCircularizePlan: queries.getCircularizePlan,
        keyboardInput,
        maxControlWarp: defaultMaxControlWarp,
        maxTimeWarp: options.runtimeState.scenario.directives.maxTimeWarp,
        shouldCaptureBurn: queries.shouldCaptureBurn,
        state: options.runtimeState.simulation.state,
        targetHeading: options.runtimeState.simulation.targetHeading,
        timeWarps: options.config.controls.timeWarps,
      })
    },
    getTimeWarpPreviews: (action, count) => {
      return getTimeWarpFeedbackPreviews({
        action,
        assistMode: options.runtimeState.simulation.assistMode,
        crashedBodyName: options.runtimeState.simulation.crashedBodyName,
        count,
        currentTimeWarpIndex: options.runtimeState.simulation.timeWarpIndex,
        getAssistTarget: queries.getAssistTarget,
        getAutopilotTurn: queries.getAutopilotTurn,
        getCaptureMetrics: queries.getCaptureMetrics,
        getCircularizePlan: queries.getCircularizePlan,
        keyboardInput,
        maxControlWarp: defaultMaxControlWarp,
        maxTimeWarp: options.runtimeState.scenario.directives.maxTimeWarp,
        shouldCaptureBurn: queries.shouldCaptureBurn,
        state: options.runtimeState.simulation.state,
        targetHeading: options.runtimeState.simulation.targetHeading,
        timeWarps: options.config.controls.timeWarps,
      })
    },
    initialBurnControlSide: touchBurnControlSide,
    initialTargetControlSide: touchTargetControlSide,
    initialTrajectoryControlSide: touchTrajectoryControlSide,
    initialWarpControlSide: touchWarpControlSide,
    keyboardInput,
    getCameraMode: runtimeActions.getCameraMode,
    getCameraModeChangesLocked: runtimeActions.getCameraModeChangesLocked,
    onCameraUnlockedBySwipe: cameraUnlockNotice.show,
    onCameraModeSelected: runtimeActions.setCameraMode,
    onCameraPanGesture: panCameraBetweenScreenPoints,
    onReturnToAutomaticTarget:
      runtimeActions.returnToAutomaticAssistTargetSelection,
    onSelectTargetIndex: runtimeActions.selectAssistTargetIndex,
    onTargetHeadingSelected: (screenX, screenY) => {
      const worldPosition = pickWorldPointFromScreenPoint(screenX, screenY)

      if (worldPosition === null) {
        return
      }

      const spacecraftPosition =
        options.runtimeState.simulation.state.spacecraft.position
      const heading = Math.atan2(
        worldPosition.y - spacecraftPosition.y,
        worldPosition.x - spacecraftPosition.x,
      )

      runtimeActions.setTargetHeading(heading, screenX, screenY, worldPosition)
    },
    onThrustControlUiStateChange: (state) => {
      options.runtimeState.ui.touchThrustControl = state
    },
    onZoom: zoomCameraAroundScreenPoint,
  })
  const handleTopMenuAction = (action: TopMenuAction) => {
    if (action === 'enterMainMenu') {
      gameHighLevelActionsMediator.dispatch({
        type: 'enterMainMenu',
      })
      return
    }

    dispatchRuntimeAction(action)
  }
  const uiSettingsDialog = createUiSettingsDialog({
    app: options.app,
    getTouchBurnControlSide: () => touchBurnControlSide,
    getTouchTargetControlSide: () => touchTargetControlSide,
    getTouchTrajectoryControlSide: () => touchTrajectoryControlSide,
    getTouchWarpControlSide: () => touchWarpControlSide,
    onOpenChange: (open) => {
      uiSettingsOpen = open
      if (open) {
        keyboardInput.clear()
      }
    },
    onTouchBurnControlSideChange: (side) => {
      touchBurnControlSide = side
      touchControls.setBurnControlSide(side)
      updateUserSettings({ touchBurnControlSide: side })
    },
    onTouchTargetControlSideChange: (side) => {
      touchTargetControlSide = side
      touchControls.setTargetControlSide(side)
      updateUserSettings({ touchTargetControlSide: side })
    },
    onTouchTrajectoryControlSideChange: (side) => {
      touchTrajectoryControlSide = side
      touchControls.setTrajectoryControlSide(side)
      updateUserSettings({ touchTrajectoryControlSide: side })
    },
    onTouchWarpControlSideChange: (side) => {
      touchWarpControlSide = side
      touchControls.setWarpControlSide(side)
      updateUserSettings({ touchWarpControlSide: side })
    },
  })

  const topMenu = createTopMenu({
    app: options.app,
    getDebugModeEnabled: () => options.runtimeState.debug.debugModeEnabled,
    getFpsIndicatorEnabled: () =>
      options.runtimeState.debug.fpsIndicatorEnabled,
    onAction: handleTopMenuAction,
  })
  const inGameControlsMenu = createInGameControlsMenu({
    app: options.app,
    getCameraMode: runtimeActions.getCameraMode,
    getCameraModeChangesLocked: runtimeActions.getCameraModeChangesLocked,
    getCoastPredictionHorizonHours: () =>
      options.runtimeState.simulation.coastPredictionHorizonHours,
    getMaxCoastPredictionHorizonHours: () =>
      options.runtimeState.scenario.directives.maxCoastPredictionHorizonHours ??
      options.config.trajectory.maxCoastPredictionHorizonHours,
    getMinCoastPredictionHorizonHours: () =>
      options.config.trajectory.minCoastPredictionHorizonHours,
    onAction: (action) => dispatchRuntimeAction(action),
    onOpenUiSettings: uiSettingsDialog.open,
  })
  const hudPresentation = createHudPresentation({
    defaultViewport: options.config.camera.defaultViewport,
    inGameControlsMenu,
    overlayUi,
    physicsEngineName: options.config.physicsEngine.name,
    queries,
    rendererProfiler,
    runtime: options.runtimeState,
    timeWarps: options.config.controls.timeWarps,
    touchControls,
    trajectoryPresentation,
  })
  const pointerCameraInput = bindPointerCameraInput({
    camera: gameScene.camera,
    getCameraMode: runtimeActions.getCameraMode,
    getCameraModeChangesLocked: runtimeActions.getCameraModeChangesLocked,
    getInteractionsEnabled: getGameInteractionsEnabled,
    getSpacecraftPosition: () =>
      options.runtimeState.simulation.state.spacecraft.position,
    onCameraModeSelected: runtimeActions.setCameraMode,
    onCameraPan: runtimeActions.panCamera,
    onResize: runtimeActions.handleResize,
    onTargetHeadingSelected: (heading, selection) => {
      runtimeActions.setTargetHeading(
        heading,
        selection.screenPosition.x,
        selection.screenPosition.y,
        selection.worldPosition,
      )
    },
    onZoom: runtimeActions.zoomCamera,
    renderScale: RENDER_SCALE,
    rendererElement: renderer.domElement,
    windowTarget: window,
  })
  const mainMenu = createMainMenu({
    app: options.app,
    onFreeRoam: () =>
      gameHighLevelActionsMediator.dispatch({ type: 'startFreeRoam' }),
    onLoadGame: () =>
      gameHighLevelActionsMediator.dispatch({
        type: 'loadLastGame',
        payload: { fromMenu: 'mainMenu' },
      }),
    onTutorial: () =>
      gameHighLevelActionsMediator.dispatch({
        type: 'startTutorial',
        payload: { scenarioId: '' },
      }),
  })
  const crashMenu = createCrashMenu({
    app: options.app,
    onExit: () => {
      gameHighLevelActionsMediator.dispatch({
        type: 'enterMainMenu',
      })
    },
    onLoadGame: () => {
      gameHighLevelActionsMediator.dispatch({
        type: 'loadLastGame',
        payload: {
          fromMenu: 'crashMenu',
        },
      })
    },
    onRestart: () => {
      gameHighLevelActionsMediator.dispatch({
        type: 'restartScenario',
      })
    },
    onRestartFromCheckpoint: () => {
      gameHighLevelActionsMediator.dispatch({
        type: 'restartFromCheckpoint',
      })
    },
  })

  const frameLoop = createFrameLoop({
    bodyPresentation: createBodyPresentation({
      gameScene,
      overlayUi,
    }),
    crashMenu: {
      syncState: () => {
        const visible =
          getAppMode() === 'game' &&
          options.runtimeState.simulation.crashedBodyName !== null
        crashMenu.setVisible(visible)
        crashMenu.syncState({
          hasCheckpoint:
            options.runtimeState.scenario.session.checkpoint !== null,
        })
      },
    },
    gameScene,
    hudPresentation,
    keyboardInput,
    physicsEngine: options.config.physicsEngine,
    queries,
    rendererProfiler,
    ripples,
    runtime: options.runtimeState,
    runtimeActions,
    globalScenarioDirectiveLimits: options.config.globalScenarioDirectiveLimits,
    getGameplayPaused: () => uiSettingsOpen,
    spacecraftPresentation: createSpacecraftPresentation({
      defaultViewport: options.config.camera.defaultViewport,
      gameScene,
      overlayUi,
      pointerCameraInput,
      spacecraftModelZoomThreshold:
        options.config.camera.spacecraftModelZoomThreshold,
    }),
    timeWarps: options.config.controls.timeWarps,
    topMenu,
    touchControls: Boolean(touchControls),
    trajectoryPresentation,
  })
  const coordinator = createRuntimeCoordinator({
    app: options.app,
    config: options.config,
    keyboardInput,
    mainMenu,
    crashMenu,
    topMenu,
    uiSettingsDialog,
    frameLoop,
    runtimeActions,
    runtimeState: options.runtimeState,
    gameHighLevelActionsMediator,
  })
  getAppMode = coordinator.getAppMode
  dispatchRuntimeAction = coordinator.dispatchRuntimeAction

  installDevtoolsBridge({
    dispatchRuntimeAction,
    getAppMode,
    runtime: options.runtimeState,
    runtimeActions,
    timeWarps: options.config.controls.timeWarps,
  })

  bindKeyboardShortcuts({
    autoDiscoverStrongestInfluence:
      options.config.assistTarget.autoSelectNearestSurface,
    getDebugModeEnabled: () => options.runtimeState.debug.debugModeEnabled,
    getInteractionsEnabled: getGameInteractionsEnabled,
    handleAction: dispatchRuntimeAction,
    keyboardInput,
    windowTarget: window,
  })

  const dispatchPromptAction = (serializedAction: string | undefined) => {
    const promptAction = parsePromptAction(serializedAction)
    if (!promptAction) {
      return
    }

    const result = runtimeActions.dispatchScenarioPromptAction(promptAction)
    if (!result.handled) {
      return
    }

    if (result.effect === 'start-free-roam') {
      gameHighLevelActionsMediator.dispatch({
        type: 'startFreeRoam',
      })
    }

    if (result.effect === 'exit-to-menu') {
      gameHighLevelActionsMediator.dispatch({
        type: 'enterMainMenu',
      })
    }

    frameLoop.refreshTrajectoryPrediction()
  }

  overlayUi.scenarioPromptConfirmButton?.addEventListener('click', () => {
    dispatchPromptAction(
      overlayUi.scenarioPromptConfirmButton?.dataset.promptAction,
    )
  })

  overlayUi.scenarioPromptSecondaryButton?.addEventListener('click', () => {
    dispatchPromptAction(
      overlayUi.scenarioPromptSecondaryButton?.dataset.promptAction,
    )
  })

  overlayUi.scenarioPromptCloseButton?.addEventListener('click', () => {
    dispatchPromptAction(
      overlayUi.scenarioPromptCloseButton?.dataset.promptAction,
    )
  })

  overlayUi.scenarioPrompt.addEventListener('click', (event) => {
    if (event.target !== overlayUi.scenarioPrompt) {
      return
    }

    dispatchPromptAction(
      overlayUi.scenarioPromptCloseButton?.dataset.promptAction,
    )
  })

  overlayUi.scenarioPromptRestartButton?.addEventListener('click', () => {
    const restartAction =
      overlayUi.scenarioPromptRestartButton?.dataset.restartAction
    keyboardInput.clear()

    if (restartAction === 'scenario') {
      runtimeActions.resetScenario()
      frameLoop.refreshTrajectoryPrediction()
      return
    }

    if (
      restartAction === 'checkpoint' &&
      runtimeActions.restartFromCheckpoint()
    ) {
      runtimeActions.dispatchScenarioPromptAction({
        kind: 'builtin',
        id: 'dismiss_to_replay',
      })
      frameLoop.refreshTrajectoryPrediction()
    }
  })

  overlayUi.scenarioPromptReplayButton.addEventListener('click', () => {
    if (runtimeActions.reopenScenarioPrompt()) {
      frameLoop.refreshTrajectoryPrediction()
    }
  })

  return {
    renderer,
    keyboardInput,
    overlayUi,
    runtimeActions,
    frameLoop,
    mainMenu,
    topMenu,
    crashMenu,
    initialize: coordinator.initialize,
    start: () => {
      frameLoop.start()
    },
  }
}

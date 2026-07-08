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
import {
  areScenarioAssetsCached,
  loadScenarioAssets,
  type ScenarioAssets,
} from '../render/scenarioAssets'
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
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import { parsePromptAction } from '../scenario/scenarioPrompts'
import {
  applyBodyTextureAssetsToScene,
  applyScenarioRenderConfigToScene,
  createGameScene,
} from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import { type CrashMenu, createCrashMenu } from '../ui/createCrashMenu'
import { createInGameControlsMenu } from '../ui/createInGameControlsMenu'
import { createMainMenu, type MainMenu } from '../ui/createMainMenu'
import { createScenarioLoadingOverlay } from '../ui/createScenarioLoadingOverlay'
import { createTargetRecommendationNoticePresenter } from '../ui/createTargetRecommendationNotice'
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
  type OrbitPointDisplaySettings,
  resolveOrbitPointDisplaySettings,
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

const cameraNoticeDurationMs = 2400

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
  prepareScenarioTransition(options: {
    applyTransition(): boolean
    label: string
    scenarioId: string
  }): Promise<boolean>
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
      crashedBodyName: options.runtimeState.simulation.crashedBodyName,
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
    prepareScenarioTransition: options.prepareScenarioTransition,
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

const getCameraNoticeModeLabel = (mode: CameraControlMode) => {
  if (mode === 'unlocked') {
    return 'Free roam'
  }
  if (mode === 'centered') {
    return 'Spacecraft'
  }
  return 'Target'
}

const createCameraNoticePresenter = (overlayUi: OverlayUiRefs) => {
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

  const show = (options: {
    ariaLabel: string
    body?: string
    title: string
  }) => {
    if (finishHideTimeout !== null) {
      window.clearTimeout(finishHideTimeout)
      finishHideTimeout = null
    }
    overlayUi.cameraUnlockNotice.hidden = false
    overlayUi.cameraUnlockNoticeTitle?.replaceChildren(options.title)
    if (options.body === undefined) {
      overlayUi.cameraUnlockNoticeBody?.replaceChildren()
    } else {
      overlayUi.cameraUnlockNoticeBody?.replaceChildren(options.body)
    }
    overlayUi.cameraUnlockNotice.setAttribute('aria-label', options.ariaLabel)
    overlayUi.cameraUnlockNotice.setAttribute('aria-hidden', 'false')
    window.requestAnimationFrame(() => {
      overlayUi.cameraUnlockNotice.dataset.visible = 'true'
    })

    if (hideTimeout !== null) {
      window.clearTimeout(hideTimeout)
    }
    hideTimeout = window.setTimeout(hide, cameraNoticeDurationMs)
  }

  return {
    showModeChange(mode: CameraControlMode) {
      const label = getCameraNoticeModeLabel(mode)
      show({
        ariaLabel: `Camera mode: ${label}`,
        body: label,
        title: 'Camera mode',
      })
    },
    showUnlockedBySwipe() {
      show({
        ariaLabel: 'Camera unlocked. Drag anywhere to pan.',
        title: 'Camera unlocked',
      })
    },
  }
}

export const createAppComponents = (options: {
  app: HTMLDivElement
  config: AppConfigContext
  runtimeState: AppRuntimeState
  startupAssets: ScenarioAssets
}): AppComponents => {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x05070d)
  options.app.appendChild(renderer.domElement)
  const scenarioLoadingOverlay = createScenarioLoadingOverlay({
    app: options.app,
  })

  const keyboardInput = createKeyboardInput()
  const rendererProfiler = createRendererProfiler(renderer)
  const gameScene = createGameScene(
    options.runtimeState.simulation.state.bodies,
    options.config.trajectory.rendering,
    options.startupAssets,
    options.runtimeState.scenario.render,
  )
  let scenarioTransitionLoading = false
  const prepareScenarioTransition = async (transitionOptions: {
    applyTransition(): boolean
    label: string
    scenarioId: string
  }) => {
    if (scenarioTransitionLoading) {
      return false
    }

    scenarioTransitionLoading = true
    const showOverlay = !areScenarioAssetsCached(transitionOptions.scenarioId)
    if (showOverlay) {
      scenarioLoadingOverlay.setVisible(true, transitionOptions.label)
    }

    try {
      const scenarioAssets = await loadScenarioAssets(
        transitionOptions.scenarioId,
      )
      const transitionResult = transitionOptions.applyTransition()
      if (transitionResult === false) {
        return false
      }

      applyBodyTextureAssetsToScene(
        gameScene,
        options.runtimeState.simulation.state.bodies,
        scenarioAssets,
      )
      applyScenarioRenderConfigToScene(
        gameScene,
        options.runtimeState.scenario.render,
      )
      return true
    } finally {
      scenarioTransitionLoading = false
      if (showOverlay) {
        scenarioLoadingOverlay.setVisible(false)
      }
    }
  }
  const trajectoryPredictionRuntime = createTrajectoryPredictionRuntime()
  const ripples: Ripple[] = []
  const overlayUi = createOverlayUi({
    app: options.app,
    bodies: options.runtimeState.simulation.state.bodies,
    showCycleTargetHint: !options.config.assistTarget.autoSelectNearestSurface,
  })
  const cameraNotice = createCameraNoticePresenter(overlayUi)
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
  let userOrbitPointDisplaySettings: OrbitPointDisplaySettings = {
    ...options.config.userSettings.orbitPointDisplay,
  }
  const getEffectiveOrbitPointDisplaySettings = () =>
    resolveOrbitPointDisplaySettings(
      userOrbitPointDisplaySettings,
      options.runtimeState.scenario.orbitPointDisplay,
    )
  const trajectoryPresentation = createTrajectoryPresentation({
    autopilotRotationRate: options.config.controls.autopilotRotationRate,
    gameScene,
    getOrbitPointDisplaySettings: getEffectiveOrbitPointDisplaySettings,
    physicsEngine: options.config.physicsEngine,
    queries,
    runtime: options.runtimeState,
    timeWarps: options.config.controls.timeWarps,
    trajectoryEventMarkerLabels: overlayUi.trajectoryEventMarkerLabels,
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
    getAssistTargetUiState: queries.getAssistTargetUiState,
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
  let mobileManeuverStartByDrag =
    options.config.userSettings.mobileManeuverStartByDrag
  const targetHeadingPlanLifecycleHandlers = {
    onTargetHeadingPlanCanceled: runtimeActions.clearTargetHeadingPlan,
    onTargetHeadingPlanCommitted: runtimeActions.commitTargetHeadingPlan,
  }
  let uiSettingsOpen = false
  let crashCameraFocusedBodyName: string | null = null
  let getAppMode = () => options.config.initialAppMode
  const getBaseGameInteractionsEnabled = () =>
    getAppMode() === 'game' && !uiSettingsOpen && !scenarioTransitionLoading
  const getGameInteractionsEnabled = () =>
    getBaseGameInteractionsEnabled() &&
    options.runtimeState.simulation.crashedBodyName === null
  const getCameraInteractionsEnabled = getBaseGameInteractionsEnabled
  let spacecraftVisibleInViewport = true
  let targetRecommendationNotice: ReturnType<
    typeof createTargetRecommendationNoticePresenter
  > | null = null
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
    getMobileManeuverStartByDrag: () => mobileManeuverStartByDrag,
    getSpacecraftVisible: () => spacecraftVisibleInViewport,
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
    onCameraUnlockedBySwipe: cameraNotice.showUnlockedBySwipe,
    onCameraModeSelected: runtimeActions.setCameraMode,
    onCameraPanGesture: panCameraBetweenScreenPoints,
    onReturnToAutomaticTarget:
      runtimeActions.returnToAutomaticAssistTargetSelection,
    onSelectTargetIndex: runtimeActions.selectAssistTargetIndex,
    onTargetStateChange: () => {
      targetRecommendationNotice?.acknowledgeCurrentTargetState(
        queries.getAssistTargetUiState(),
      )
    },
    onTargetHeadingPlan: (screenX, screenY) => {
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

      runtimeActions.planTargetHeading({
        heading,
        screenPosition: { x: screenX, y: screenY },
        worldPosition,
      })
    },
    ...targetHeadingPlanLifecycleHandlers,
    onThrustControlUiStateChange: (state) => {
      options.runtimeState.ui.touchThrustControl = state
    },
    onZoom: zoomCameraAroundScreenPoint,
  })
  targetRecommendationNotice = createTargetRecommendationNoticePresenter({
    onOpenTargetControl: touchControls.openTargetControl,
    refs: {
      dismissButton: overlayUi.targetRecommendationNoticeDismissButton,
      element: overlayUi.targetRecommendationNotice,
      message: overlayUi.targetRecommendationNoticeMessage,
      openButton: overlayUi.targetRecommendationNoticeOpenButton,
    },
  })
  const handleTopMenuAction = (action: TopMenuAction) => {
    if (action === 'enterMainMenu') {
      gameHighLevelActionsMediator.dispatch({
        type: 'enterMainMenu',
      })
      return
    }

    if (action === 'resetScenario') {
      keyboardInput.clear()
    }
    dispatchRuntimeAction(action)
  }
  const uiSettingsDialog = createUiSettingsDialog({
    app: options.app,
    getMobileManeuverStartByDrag: () => mobileManeuverStartByDrag,
    getOrbitPointDisplay: () => userOrbitPointDisplaySettings,
    getTouchBurnControlSide: () => touchBurnControlSide,
    getTouchTargetControlSide: () => touchTargetControlSide,
    getTouchTrajectoryControlSide: () => touchTrajectoryControlSide,
    getTouchWarpControlSide: () => touchWarpControlSide,
    onOrbitPointDisplayChange: (settings) => {
      userOrbitPointDisplaySettings = { ...settings }
      updateUserSettings({ orbitPointDisplay: userOrbitPointDisplaySettings })
    },
    onOpenChange: (open) => {
      uiSettingsOpen = open
      if (open) {
        keyboardInput.clear()
      }
    },
    onMobileManeuverStartByDragChange: (startByDrag) => {
      mobileManeuverStartByDrag = startByDrag
      updateUserSettings({ mobileManeuverStartByDrag: startByDrag })
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
    getTrailRenderedSliceCount: () => gameScene.trailRenderedSliceCount,
    inGameControlsMenu,
    overlayUi,
    physicsEngineName: options.config.physicsEngine.name,
    queries,
    rendererProfiler,
    runtime: options.runtimeState,
    targetRecommendationNotice: targetRecommendationNotice ?? undefined,
    timeWarps: options.config.controls.timeWarps,
    touchControls,
    trajectoryPresentation,
  })
  const pointerCameraInput = bindPointerCameraInput({
    camera: gameScene.camera,
    getCameraMode: runtimeActions.getCameraMode,
    getCameraModeChangesLocked: runtimeActions.getCameraModeChangesLocked,
    getInteractionsEnabled: getCameraInteractionsEnabled,
    getSpacecraftPosition: () =>
      options.runtimeState.simulation.state.spacecraft.position,
    getSpacecraftVisible: () => spacecraftVisibleInViewport,
    getTargetHeadingSelectionEnabled: getGameInteractionsEnabled,
    onCameraModeSelected: runtimeActions.setCameraMode,
    onCameraPan: runtimeActions.panCamera,
    onResize: runtimeActions.handleResize,
    onTargetHeadingPlan: (heading, selection) => {
      runtimeActions.planTargetHeading({
        heading,
        screenPosition: selection.screenPosition,
        worldPosition: selection.worldPosition,
      })
    },
    ...targetHeadingPlanLifecycleHandlers,
    onZoom: runtimeActions.zoomCamera,
    renderScale: RENDER_SCALE,
    rendererElement: renderer.domElement,
    windowTarget: window,
  })
  const mainMenu = createMainMenu({
    app: options.app,
    reachMoonFeatureEnabled: options.config.featureFlags.reachMoon,
    onFreeRoam: () =>
      gameHighLevelActionsMediator.dispatch({ type: 'startFreeRoam' }),
    onLoadGame: () =>
      gameHighLevelActionsMediator.dispatch({
        type: 'loadLastGame',
        payload: { fromMenu: 'mainMenu' },
      }),
    onReachMoon: () =>
      gameHighLevelActionsMediator.dispatch({ type: 'startReachMoon' }),
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
      keyboardInput.clear()
      if (runtimeActions.restartFromCheckpoint()) {
        runtimeActions.dispatchScenarioPromptAction({
          kind: 'builtin',
          id: 'dismiss_to_replay',
        })
        crashCameraFocusedBodyName = null
        crashMenu.setVisible(false)
        options.app.classList.remove('app-crashed')
        frameLoop.refreshTrajectoryPrediction()
      }
    },
  })
  const getCrashInspectionTargetNdcY = () => {
    const panelTop =
      crashMenu.element
        .querySelector<HTMLElement>('.crash-menu-panel')
        ?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
    const viewportHeight = Math.max(window.innerHeight, 1)
    const desiredScreenY = Math.min(
      viewportHeight * 0.32,
      Math.max(24, panelTop - 72),
    )
    return THREE.MathUtils.clamp(
      1 - (desiredScreenY / viewportHeight) * 2,
      0.38,
      0.9,
    )
  }

  const frameLoop = createFrameLoop({
    bodyPresentation: createBodyPresentation({
      gameScene,
      overlayUi,
    }),
    crashMenu: {
      syncState: () => {
        const crashedBodyName = options.runtimeState.simulation.crashedBodyName
        const visible = getAppMode() === 'game' && crashedBodyName !== null
        crashMenu.syncState({
          crashedBodyName,
          hasCheckpoint:
            options.runtimeState.scenario.session.checkpoint !== null,
        })
        if (!visible) {
          crashCameraFocusedBodyName = null
        }
        crashMenu.setVisible(visible)
        options.app.classList.toggle('app-crashed', visible)
        if (visible) {
          topMenu.close()
          inGameControlsMenu.close()
          uiSettingsDialog.close(false)
          if (crashCameraFocusedBodyName !== crashedBodyName) {
            runtimeActions.unlockCameraAtFollowTarget(
              getCrashInspectionTargetNdcY(),
            )
            crashCameraFocusedBodyName = crashedBodyName
          }
        }
      },
    },
    gameScene,
    hudPresentation,
    autopilotRotationRate: options.config.controls.autopilotRotationRate,
    getFpsMeterVisible: () =>
      options.runtimeState.debug.fpsIndicatorEnabled &&
      getAppMode() === 'game' &&
      options.runtimeState.simulation.crashedBodyName === null,
    keyboardInput,
    physicsEngine: options.config.physicsEngine,
    queries,
    rendererProfiler,
    ripples,
    runtime: options.runtimeState,
    runtimeActions,
    globalScenarioDirectiveLimits: options.config.globalScenarioDirectiveLimits,
    getGameplayPaused: () => uiSettingsOpen || scenarioTransitionLoading,
    spacecraftPresentation: createSpacecraftPresentation({
      defaultViewport: options.config.camera.defaultViewport,
      gameScene,
      onSpacecraftVisibleChange: (visible) => {
        spacecraftVisibleInViewport = visible
        if (!visible) {
          runtimeActions.clearTargetHeadingPlan()
        }
      },
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
    prepareScenarioTransition,
  })
  getAppMode = coordinator.getAppMode
  dispatchRuntimeAction = coordinator.dispatchRuntimeAction
  overlayUi.debugPanel.setCloseHandler(() => {
    dispatchRuntimeAction('toggleDebugMode')
  })

  installDevtoolsBridge({
    dispatchRuntimeAction,
    getAppMode,
    getTrajectoryPredictionDiagnostics: () =>
      trajectoryPredictionRuntime.getDiagnostics(),
    maxPredictionLoopRevolutions:
      options.config.trajectory.maxPredictionLoopRevolutions,
    predictionSampling: options.config.trajectory.predictionSampling,
    runtime: options.runtimeState,
    runtimeActions,
    setTrajectoryPredictionFarCoalescingMinIntervalOverrideSeconds: (value) =>
      trajectoryPredictionRuntime.setFarCoalescingMinIntervalOverrideSeconds(
        value,
      ),
    timeWarps: options.config.controls.timeWarps,
  })

  const handleKeyboardAction = (action: UIUserAction) => {
    const previousCameraMode = runtimeActions.getCameraMode()
    dispatchRuntimeAction(action)
    const nextCameraMode = runtimeActions.getCameraMode()

    if (action === 'cycleCameraMode' && nextCameraMode !== previousCameraMode) {
      cameraNotice.showModeChange(nextCameraMode)
    }
  }

  bindKeyboardShortcuts({
    autoDiscoverStrongestInfluence:
      options.config.assistTarget.autoSelectNearestSurface,
    getDebugModeEnabled: () => options.runtimeState.debug.debugModeEnabled,
    getInteractionsEnabled: getGameInteractionsEnabled,
    handleAction: handleKeyboardAction,
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

    if (result.effect === 'show-reach-moon-highscores') {
      gameHighLevelActionsMediator.dispatch({
        type: 'showReachMoonHighscores',
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
      gameHighLevelActionsMediator.dispatch({
        type: 'restartScenario',
      })
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

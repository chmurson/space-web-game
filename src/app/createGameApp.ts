import * as THREE from 'three'
import { gameConfig } from '../config/gameConfig'
import { bindKeyboardShortcuts } from '../input/bindKeyboardShortcuts'
import { createKeyboardInput } from '../input/keyboardInput'
import {
  bindPointerCameraInput,
  createScreenPointHeadingPicker,
} from '../input/pointerCameraInput'
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
import { createTrajectoryPredictionRuntime } from '../runtime/trajectoryPredictionRuntime'
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import {
  createDefaultScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
} from '../scenario/scenarioDirectiveTypes'
import { createGameScene } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import { defaultPhysicsEngine, physicsEngines } from '../simulation/physics'
import { createCrashMenu } from '../ui/createCrashMenu'
import { createMainMenu } from '../ui/createMainMenu'
import { createTopMenu } from '../ui/createTopMenu'
import { createTouchControls } from '../ui/createTouchControls'
import { createOverlayUi } from '../ui/overlayUI/createOverlayUi'
import { createRipple, type Ripple } from '../ui/overlayUpdates'
import { readUserSettings, updateUserSettings } from '../userSettingsStorage'

type AppMode = 'menu' | 'game'

export const createGameApp = (app: HTMLDivElement) => {
  const urlParams = new URLSearchParams(window.location.search)
  let appMode: 'menu' | 'game' = urlParams.has('scenario') ? 'game' : 'menu'
  const setAppMode = (newAppMode: AppMode) => {
    appMode = newAppMode
  }
  const requestedEngine = urlParams.get('engine') ?? ''
  const physicsEngine = physicsEngines[requestedEngine] ?? defaultPhysicsEngine
  const requestedScenario = urlParams.get('scenario') ?? 'earth-moon'
  const scenario = createRequestedRuntimeScenario(requestedScenario)
  const userSettings = readUserSettings()
  const keyboardInput = createKeyboardInput()
  const timeWarps = gameConfig.controls.timeWarps
  const autoSelectNearestSurface =
    gameConfig.assistTarget.autoSelectNearestSurface
  const autopilotRotationRate = gameConfig.controls.autopilotRotationRate
  const defaultCoastPredictionHorizonHours =
    gameConfig.trajectory.horizon.defaultHours
  const minCoastPredictionHorizonHours = gameConfig.trajectory.horizon.minHours
  const maxCoastPredictionHorizonHours = gameConfig.trajectory.horizon.maxHours
  const cameraDistance = gameConfig.camera.distance
  const cameraElevation = THREE.MathUtils.degToRad(
    gameConfig.camera.elevationDegrees,
  )
  const defaultViewport = gameConfig.camera.viewport.default
  const spacecraftModelZoomThreshold =
    gameConfig.camera.spacecraftModelZoomThreshold
  const minViewport = defaultViewport / gameConfig.camera.viewport.minDivisor
  const maxViewport = gameConfig.camera.viewport.max

  const runtimeScenarioOptions: RuntimeScenarioOptions = {
    defaultCoastPredictionHorizonHours,
    defaultViewportSize: defaultViewport,
    maxCoastPredictionHorizonHours,
    maxViewportSize: maxViewport,
    minCoastPredictionHorizonHours,
    minViewportSize: minViewport,
  }
  const initialRuntimeScenarioState = createRuntimeScenarioState(
    scenario,
    runtimeScenarioOptions,
  )
  const runtime: AppRuntimeState = {
    assistMode: 'off',
    assistTargetIndex: 1,
    coastPredictionHorizonHours:
      initialRuntimeScenarioState.coastPredictionHorizonHours,
    crashedBodyName: null,
    debugModeEnabled: userSettings.debugModeEnabled,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
    scenarioDirectives: createDefaultScenarioDirectives(),
    scenarioSession: initialRuntimeScenarioState.scenarioSession,
    spacecraftLabelIntroUntil: performance.now() + 5_000,
    targetHeadingSelectionEpoch: 0,
    uiEffectEpoch: 0,
    state: initialRuntimeScenarioState.state,
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: initialRuntimeScenarioState.viewportSize,
  }
  const globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits = {
    defaultViewportSize: defaultViewport,
    maxCoastPredictionHorizonHours,
    maxViewportSize: maxViewport,
    minViewportSize: minViewport,
    timeWarps,
  }

  syncRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x05070d)
  app.appendChild(renderer.domElement)

  const rendererProfiler = createRendererProfiler(renderer)
  const gameScene = createGameScene(
    runtime.state.bodies,
    gameConfig.trajectory.rendering,
  )

  const trajectoryPredictionRuntime = createTrajectoryPredictionRuntime()
  const ripples: Ripple[] = []

  const overlayUi = createOverlayUi({
    app,
    bodies: runtime.state.bodies,
    scenarioDescription: scenario.description,
    scenarioName: scenario.name,
    showCycleTargetHint: !autoSelectNearestSurface,
  })

  const queries = createGameQueries({
    autoSelectNearestSurface,
    autoSelectConfig: {
      switchRangeMultiplier: gameConfig.assistTarget.switchRangeMultiplier,
    },
    autopilotRotationRate,
    getPredictedTrajectoryEnd: () =>
      trajectoryPredictionRuntime.getState().absolutePredictionEnd,
    getPredictedTrajectoryPoints: () =>
      trajectoryPredictionRuntime.getState().absolutePredictionPoints,
    maxPredictionLoopRevolutions: gameConfig.trajectory.loopTrim.maxRevolutions,
    predictionSampling: gameConfig.trajectory.sampling,
    runtime,
  })

  const trajectoryPresentation = createTrajectoryPresentation({
    gameScene,
    physicsEngine,
    queries,
    runtime,
    trajectoryPredictionRuntime,
  })

  const pickHeadingFromScreenPoint = createScreenPointHeadingPicker(
    gameScene.camera,
    renderer.domElement,
    RENDER_SCALE,
  )

  // Create game high-level actions using the mediator
  const gameHighLevelActionsMediator = new GameHighLevelActionsMediator()

  const runtimeActions = createRuntimeActions({
    app,
    gameHighLevelActions: gameHighLevelActionsMediator,
    cameraDistance,
    cameraElevation,
    createRipple,
    gameScene,
    maxCoastPredictionHorizonHours,
    maxViewport,
    minCoastPredictionHorizonHours,
    minViewport,
    renderer,
    requestedScenario,
    ripples,
    runtime,
    globalScenarioDirectiveLimits,
    runtimeScenarioOptions,
    timeWarps,
    updateUserSettings,
  })

  let topMenu: ReturnType<typeof createTopMenu> | null = null
  let crashMenu: ReturnType<typeof createCrashMenu> | null = null
  let frameLoop: ReturnType<typeof createFrameLoop> | null = null

  const dispatchRuntimeAction = (
    action: Parameters<typeof runtimeActions.handleUIUserAction>[0],
  ) => {
    if (appMode !== 'game') {
      return
    }

    const result = runtimeActions.handleUIUserAction(action)

    if (result.refreshTrajectoryPrediction && frameLoop) {
      frameLoop.refreshTrajectoryPrediction()
    }

    crashMenu?.syncState({
      hasCheckpoint: runtime.scenarioSession.checkpoint !== null,
    })

    topMenu?.syncState()
  }

  topMenu = createTopMenu({
    app,
    getCoastPredictionHorizonHours: () => runtime.coastPredictionHorizonHours,
    getDebugModeEnabled: () => runtime.debugModeEnabled,
    getMaxCoastPredictionHorizonHours: () =>
      runtime.scenarioDirectives.maxCoastPredictionHorizonHours ??
      maxCoastPredictionHorizonHours,
    getMinCoastPredictionHorizonHours: () => minCoastPredictionHorizonHours,
    onAction: dispatchRuntimeAction,
  })

  const touchControls = createTouchControls({
    app,
    keyboardInput,
    nudgeTargetHeading: runtimeActions.nudgeTargetHeading,
    onAction: dispatchRuntimeAction,
    onTargetHeadingSelected: (screenX, screenY) => {
      const heading = pickHeadingFromScreenPoint(
        screenX,
        screenY,
        runtime.state.spacecraft.position,
      )
      if (heading === null) {
        return
      }

      runtimeActions.setTargetHeading(heading, screenX, screenY)
    },
    onZoom: runtimeActions.zoomCamera,
  })

  const hudPresentation = createHudPresentation({
    defaultScenarioDescription: scenario.description,
    defaultScenarioName: scenario.name,
    defaultViewport,
    overlayUi,
    physicsEngineName: physicsEngine.name,
    queries,
    rendererProfiler,
    runtime,
    timeWarps,
    touchControls,
    trajectoryPresentation,
  })

  const pointerCameraInput = bindPointerCameraInput({
    camera: gameScene.camera,
    getInteractionsEnabled: () => appMode === 'game',
    getSpacecraftPosition: () => runtime.state.spacecraft.position,
    onResize: runtimeActions.handleResize,
    onTargetHeadingSelected: (heading, screenPosition) => {
      runtimeActions.setTargetHeading(
        heading,
        screenPosition.x,
        screenPosition.y,
      )
    },
    onZoom: runtimeActions.zoomCamera,
    renderScale: RENDER_SCALE,
    rendererElement: renderer.domElement,
    windowTarget: window,
  })

  const mainMenu = createMainMenu({
    app,
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

  // Create frameLoop early so handlers can reference it
  frameLoop = createFrameLoop({
    bodyPresentation: createBodyPresentation({
      gameScene,
      overlayUi,
    }),
    crashMenu: {
      syncState: () => {
        const visible = appMode === 'game' && runtime.crashedBodyName !== null
        crashMenu?.setVisible(visible)
        crashMenu?.syncState({
          hasCheckpoint: runtime.scenarioSession.checkpoint !== null,
        })
      },
    },
    gameScene,
    hudPresentation,
    keyboardInput,
    physicsEngine,
    queries,
    rendererProfiler,
    ripples,
    runtime,
    runtimeActions,
    globalScenarioDirectiveLimits,
    spacecraftPresentation: createSpacecraftPresentation({
      defaultViewport,
      gameScene,
      overlayUi,
      pointerCameraInput,
      spacecraftModelZoomThreshold,
    }),
    timeWarps,
    topMenu,
    touchControls: Boolean(touchControls),
    trajectoryPresentation,
  })

  crashMenu = createCrashMenu({
    app,
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

  bindKeyboardShortcuts({
    autoDiscoverStrongestInfluence: autoSelectNearestSurface,
    getDebugModeEnabled: () => runtime.debugModeEnabled,
    getInteractionsEnabled: () => appMode === 'game',
    handleAction: dispatchRuntimeAction,
    keyboardInput,
    windowTarget: window,
  })

  overlayUi.scenarioPromptConfirmButton?.addEventListener('click', () => {
    const result = runtimeActions.acknowledgeScenarioPrompt()
    if (!result.acknowledged) {
      return
    }

    if (result.effect === 'start-free-roam') {
      gameHighLevelActionsMediator.dispatch({
        type: 'startFreeRoam',
      })
    }

    frameLoop?.refreshTrajectoryPrediction()
  })

  overlayUi.scenarioPromptSecondaryButton?.addEventListener('click', () => {
    const promptAction =
      overlayUi.scenarioPromptSecondaryButton?.dataset.promptAction
    if (promptAction === 'exit-to-menu') {
      gameHighLevelActionsMediator.dispatch({
        type: 'enterMainMenu',
      })
    }
  })

  overlayUi.scenarioPromptReplayButton.addEventListener('click', () => {
    if (runtimeActions.reopenScenarioPrompt()) {
      frameLoop?.refreshTrajectoryPrediction()
    }
  })

  registerHighLevelActions({
    gameMediator: gameHighLevelActionsMediator,
    keyboardInput,
    app,
    setAppMode,
    frameLoop,
    runtimeActions,
    mainMenu,
    crashMenu,
    topMenu,
    runtime,
  })

  if (appMode === 'menu') {
    gameHighLevelActionsMediator.dispatch({
      type: 'enterMainMenu',
    })
  } else {
    crashMenu.setVisible(false)
    mainMenu.setVisible(false)
  }

  frameLoop.start()
}

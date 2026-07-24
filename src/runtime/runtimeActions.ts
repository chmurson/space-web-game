import * as THREE from 'three'
import {
  createDebugScenarioSnapshotEntryName,
  createSnapshotFromState,
  writeDebugScenarioSnapshot,
} from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'
import { updateCameraView } from '../render/sceneUpdates'
import type { RuntimeScenarioOptions } from '../scenario/runtimeScenario'
import {
  type CameraFollowSubject,
  type GlobalScenarioDirectiveLimits,
  getNextCameraFollowSubject,
} from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { PromptAction } from '../scenario/scenarioPromptTypes'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import { add, sub, type Vec2 } from '../simulation/vector'
import type { Ripple } from '../ui/overlayUpdates'
import type { AppRuntimeState, TargetHeadingPlan } from './appRuntimeState'
import { createScenarioRuntimeController } from './createScenarioRuntimeController'
import type { AssistTargetUiState } from './gameQueries'
import type { GameHighLevelActionsMediator } from './highLevelActions/gameHighLevelActionDispatcher'
import {
  apoapsisInfoPin,
  type InfoPin,
  includesInfoPin,
  periapsisInfoPin,
  toggleInfoPin,
} from './infoPins'
import type { NavigationTimeWarpController } from './navigationTimeWarpController'
import {
  clearTransientScenarioRuntimeState,
  dispatchRuntimeScenarioPromptAction,
  reopenRuntimeScenarioPrompt,
} from './runtimeStateTransitions'
import { getNextTrajectoryHorizonHours } from './trajectoryHorizonControlPolicy'

type RippleCreator = (
  parent: HTMLElement,
  ripples: Ripple[],
  screenX: number,
  screenY: number,
  worldPosition?: Vec2 | null,
) => void

export type RuntimeActionsResult = {
  refreshTrajectoryPrediction: boolean
}

const crashInspectionTargetNdcY = 0.38

const getViewportDimensions = () => ({
  height: typeof window === 'undefined' ? 0 : window.innerHeight,
  width: typeof window === 'undefined' ? 0 : window.innerWidth,
})

const scaleScreenPointForResize = (
  point: { x: number; y: number },
  previousViewport: { width: number; height: number },
  nextViewport: { width: number; height: number },
) => ({
  x: THREE.MathUtils.clamp(
    (point.x / Math.max(previousViewport.width, 1)) * nextViewport.width,
    0,
    nextViewport.width,
  ),
  y: THREE.MathUtils.clamp(
    (point.y / Math.max(previousViewport.height, 1)) * nextViewport.height,
    0,
    nextViewport.height,
  ),
})

export const createRuntimeActions = (options: {
  app: HTMLDivElement
  autoSelectNearestSurface: boolean
  cameraDistance: number
  cameraElevation: number
  createRipple: RippleCreator
  gameScene: GameSceneRefs
  getAssistTargetUiState: () => AssistTargetUiState
  getFollowCameraViewportBottomInset?: () => number
  maxCoastPredictionHorizonHours: number
  maxViewport: number
  minCoastPredictionHorizonHours: number
  minViewport: number
  navigationTimeWarpController: NavigationTimeWarpController
  renderer: Pick<
    THREE.WebGLRenderer,
    'getPixelRatio' | 'setPixelRatio' | 'setSize'
  >
  ripples: Ripple[]
  runtime: AppRuntimeState
  globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  runtimeScenarioOptions: RuntimeScenarioOptions
  timeWarps: number[]
  updateUserSettings: (settings: { debugModeEnabled: boolean }) => void
  gameHighLevelActions: GameHighLevelActionsMediator
}) => {
  const initialViewport = getViewportDimensions()
  let lastViewportWidth = initialViewport.width
  let lastViewportHeight = initialViewport.height

  const normalizeAngle = (angle: number) => {
    const wrapped = (angle + Math.PI) % (Math.PI * 2)
    return wrapped < 0 ? wrapped + Math.PI : wrapped - Math.PI
  }

  const normalizeAssistTargetIndex = (index: number) => {
    const bodyCount = options.runtime.simulation.state.bodies.length
    if (bodyCount === 0) {
      return null
    }

    return ((index % bodyCount) + bodyCount) % bodyCount
  }

  const selectAssistTargetIndex = (index: number) => {
    const normalizedIndex = normalizeAssistTargetIndex(index)
    if (normalizedIndex === null) {
      return false
    }

    options.runtime.simulation.assistTargetIndex = normalizedIndex
    options.runtime.simulation.assistTargetSelectionMode = 'manual'
    return true
  }

  const resetAssistTargetSelectionMode = () => {
    options.runtime.simulation.assistTargetSelectionMode =
      options.autoSelectNearestSurface ? 'auto' : 'manual'
  }

  const clearTransientScenarioState = () => {
    options.navigationTimeWarpController.reset()
    clearTransientScenarioRuntimeState(options.runtime, () => {
      options.gameScene.trailPoints.length = 0
    })
    resetAssistTargetSelectionMode()
  }

  const selectTimeWarpIndex = (timeWarpIndex: number) => {
    const selectedTimeWarpIndex =
      options.navigationTimeWarpController.selectTimeWarpIndex({
        maxTimeWarp: options.runtime.scenario.directives.maxTimeWarp,
        timeWarpIndex,
      })
    options.runtime.simulation.timeWarpIndex = selectedTimeWarpIndex
    return selectedTimeWarpIndex
  }
  const setTimeWarp = (warp: number) => {
    const timeWarpIndex = options.timeWarps.reduce(
      (targetIndex, timeWarp, index) =>
        timeWarp <= warp ? index : targetIndex,
      0,
    )
    selectTimeWarpIndex(timeWarpIndex)
  }
  const scenarioRuntimeController = createScenarioRuntimeController({
    clearTransientScenarioState,
    globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
    runtime: options.runtime,
    runtimeScenarioOptions: options.runtimeScenarioOptions,
    setTimeWarp,
  })

  const createCurrentDebugScenarioSnapshot = () =>
    createSnapshotFromState(options.runtime.simulation.state, {
      assistTargetIndex: options.runtime.simulation.assistTargetIndex,
      assistTargetSelectionMode:
        options.runtime.simulation.assistTargetSelectionMode,
      coastPredictionHorizonHours:
        options.runtime.simulation.coastPredictionHorizonHours,
      cameraFollow: options.runtime.ui.camera.follow,
      cameraPanOffset: options.runtime.ui.camera.panOffset,
      scenarioSession: options.runtime.scenario.session,
      userInfoPins: options.runtime.info.userPins,
      viewportSize: options.runtime.simulation.viewportSize,
    })

  const saveDebugScenarioSnapshot = (name?: string) => {
    try {
      writeDebugScenarioSnapshot(createCurrentDebugScenarioSnapshot(), name)
      options.runtime.debug.debugSnapshotStatus =
        'snapshot saved; use [7] load or ?scenario=last-debug-snapshot'
      return true
    } catch {
      options.runtime.debug.debugSnapshotStatus = 'snapshot save failed'
      return false
    }
  }

  const getFollowCameraTargetPosition = () =>
    options.runtime.scenario.directives.cameraFollowBodyId === null
      ? add(
          options.runtime.simulation.state.spacecraft.position,
          options.runtime.scenario.directives.cameraFollowOffset,
        )
      : add(
          options.runtime.simulation.state.bodies.find(
            (body) =>
              body.id ===
              options.runtime.scenario.directives.cameraFollowBodyId,
          )?.position ?? options.runtime.simulation.state.spacecraft.position,
          options.runtime.scenario.directives.cameraFollowOffset,
        )

  const getTargetCameraTargetPosition = () =>
    options.getAssistTargetUiState().activeTarget.position

  const getCameraFollowSubjectPosition = () =>
    options.runtime.ui.camera.follow === 'target'
      ? getTargetCameraTargetPosition()
      : getFollowCameraTargetPosition()

  const getCameraTargetPosition = () =>
    add(getCameraFollowSubjectPosition(), options.runtime.ui.camera.panOffset)

  const updateCamera = (preserveStarfieldWorldPosition = false) =>
    updateCameraView({
      cameraDistance: options.cameraDistance,
      cameraElevation: options.cameraElevation,
      cameraTargetPosition: getCameraTargetPosition(),
      gameScene: options.gameScene,
      preserveStarfieldWorldPosition,
      viewportBottomInset: options.getFollowCameraViewportBottomInset?.() ?? 0,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.simulation.viewportSize,
      viewportWidth: window.innerWidth,
    })

  const setCameraFollow = (follow: CameraFollowSubject) => {
    if (options.runtime.scenario.directives.cameraControlsLocked) {
      return false
    }

    if (follow === options.runtime.ui.camera.follow) {
      return true
    }

    options.runtime.ui.camera.follow = follow
    updateCamera()
    return true
  }

  const recenterCamera = () => {
    if (options.runtime.scenario.directives.cameraControlsLocked) {
      return false
    }

    options.runtime.ui.camera.panOffset = { x: 0, y: 0 }
    updateCamera()
    return true
  }

  const canRecenterCamera = () => {
    const { x, y } = options.runtime.ui.camera.panOffset
    return x !== 0 || y !== 0
  }

  const getCrashInspectionCameraTargetPosition = (
    followTarget: Vec2,
    targetNdcY = crashInspectionTargetNdcY,
  ) => {
    const screenUpOffset =
      (options.runtime.simulation.viewportSize *
        0.5 *
        targetNdcY *
        Math.sin(options.cameraElevation)) /
      (Math.SQRT2 * RENDER_SCALE)
    return {
      x: followTarget.x + screenUpOffset,
      y: followTarget.y + screenUpOffset,
    }
  }

  const panCameraForCrashInspection = (
    targetNdcY = crashInspectionTargetNdcY,
  ) => {
    if (options.runtime.scenario.directives.cameraControlsLocked) {
      return
    }

    const followPosition = getCameraFollowSubjectPosition()
    options.runtime.ui.camera.panOffset = sub(
      getCrashInspectionCameraTargetPosition(followPosition, targetNdcY),
      followPosition,
    )
    updateCamera()
  }

  const panCamera = (delta: { x: number; y: number }) => {
    if (options.runtime.scenario.directives.cameraControlsLocked) {
      return false
    }

    options.runtime.ui.camera.panOffset = add(
      options.runtime.ui.camera.panOffset,
      delta,
    )
    updateCamera()
    return true
  }

  const setTargetHeadingPlan = (plan: TargetHeadingPlan) => {
    options.runtime.ui.targetHeadingPlan = {
      heading: plan.heading,
      screenPosition: { ...plan.screenPosition },
      worldPosition: { ...plan.worldPosition },
    }
  }

  const clearTargetHeadingPlan = () => {
    options.runtime.ui.targetHeadingPlan = null
    options.navigationTimeWarpController.endHeadingPlan(performance.now())
  }

  const zoomCamera = (factor: number, focalWorldPoint?: Vec2) => {
    const previousViewportSize = options.runtime.simulation.viewportSize
    const nextViewportSize = THREE.MathUtils.clamp(
      previousViewportSize * factor,
      options.runtime.scenario.directives.minViewportSize ??
        options.minViewport,
      options.runtime.scenario.directives.maxViewportSize ??
        options.maxViewport,
    )
    const preserveStarfieldWorldPosition =
      !options.runtime.scenario.directives.cameraControlsLocked &&
      focalWorldPoint !== undefined

    if (preserveStarfieldWorldPosition) {
      const cameraTarget = getCameraTargetPosition()
      const focalShift = 1 - nextViewportSize / previousViewportSize
      const nextCameraTarget = {
        x: cameraTarget.x + (focalWorldPoint.x - cameraTarget.x) * focalShift,
        y: cameraTarget.y + (focalWorldPoint.y - cameraTarget.y) * focalShift,
      }
      options.runtime.ui.camera.panOffset = sub(
        nextCameraTarget,
        getCameraFollowSubjectPosition(),
      )
    }

    options.runtime.simulation.viewportSize = nextViewportSize
    updateCamera(preserveStarfieldWorldPosition)
  }

  const recoverScenarioAfterCrash = () => {
    const recoveredFromCheckpoint =
      scenarioRuntimeController.restartFromCheckpoint()
    if (!recoveredFromCheckpoint) {
      scenarioRuntimeController.resetScenario()
      return
    }
  }

  const dispatchScenarioPromptAction = (action: PromptAction) => {
    return dispatchRuntimeScenarioPromptAction(
      options.runtime,
      options.globalScenarioDirectiveLimits,
      action,
    )
  }
  const reopenScenarioPrompt = () => {
    return reopenRuntimeScenarioPrompt(
      options.runtime,
      options.globalScenarioDirectiveLimits,
    )
  }

  const clearUserInfoPins = () => {
    if (options.runtime.info.userPins.length === 0) {
      return false
    }

    options.runtime.info.userPins = []
    return true
  }

  const toggleUserInfoPin = (pin: InfoPin) => {
    if (pin.kind === 'apsis') {
      const apsisPins = [periapsisInfoPin, apoapsisInfoPin]
      if (
        apsisPins.some((apsisPin) =>
          includesInfoPin(
            options.runtime.scenario.directives.infoPins,
            apsisPin,
          ),
        )
      ) {
        return false
      }

      const apsidesSelected = apsisPins.some((apsisPin) =>
        includesInfoPin(options.runtime.info.userPins, apsisPin),
      )
      options.runtime.info.userPins = apsidesSelected
        ? options.runtime.info.userPins.filter(
            (candidate) => candidate.kind !== 'apsis',
          )
        : [
            ...options.runtime.info.userPins,
            { ...periapsisInfoPin },
            { ...apoapsisInfoPin },
          ]
      return true
    }

    if (
      includesInfoPin(options.runtime.scenario.directives.infoPins, pin) ||
      !options.runtime.simulation.state.bodies.some(
        (body) => body.id === pin.bodyId,
      )
    ) {
      return false
    }

    options.runtime.info.userPins = toggleInfoPin(
      options.runtime.info.userPins,
      pin,
    )
    return true
  }

  return {
    clearUserInfoPins,
    dispatchScenarioPromptAction,
    enterMainMenuBackground: scenarioRuntimeController.enterMainMenuBackground,
    getDebugSnapshotSuggestedName: () =>
      createDebugScenarioSnapshotEntryName(
        createCurrentDebugScenarioSnapshot(),
      ),
    handleUIUserAction: (action: UIUserAction): RuntimeActionsResult => {
      if (action === 'clearInfoPins') {
        clearUserInfoPins()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'increaseTimeWarp') {
        selectTimeWarpIndex(options.runtime.simulation.timeWarpIndex + 1)
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'decreaseTimeWarp') {
        selectTimeWarpIndex(
          Math.max(options.runtime.simulation.timeWarpIndex - 1, 0),
        )
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'resetScenario') {
        scenarioRuntimeController.resetScenario()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'cycleAssistTarget') {
        const selected = selectAssistTargetIndex(
          options.runtime.simulation.assistTargetIndex + 1,
        )
        return { refreshTrajectoryPrediction: selected }
      }
      if (action === 'cycleAssistMode') {
        options.runtime.simulation.assistMode =
          options.runtime.simulation.assistMode === 'off'
            ? 'capture'
            : options.runtime.simulation.assistMode === 'capture'
              ? 'circularize'
              : 'off'
        options.runtime.simulation.targetHeading = null
        options.runtime.simulation.targetHeadingTurn = null
        clearTargetHeadingPlan()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleDebugMode') {
        options.runtime.debug.debugModeEnabled =
          !options.runtime.debug.debugModeEnabled
        options.updateUserSettings({
          debugModeEnabled: options.runtime.debug.debugModeEnabled,
        })
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleNoGravityDebug') {
        options.runtime.debug.debugNoGravityEnabled =
          !options.runtime.debug.debugNoGravityEnabled
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleFpsIndicator') {
        options.runtime.debug.fpsIndicatorEnabled =
          !options.runtime.debug.fpsIndicatorEnabled
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'decreaseCoastHorizon') {
        options.runtime.simulation.coastPredictionHorizonHours =
          getNextTrajectoryHorizonHours({
            action,
            currentHours:
              options.runtime.simulation.coastPredictionHorizonHours,
            maxHours:
              options.runtime.scenario.directives
                .maxCoastPredictionHorizonHours ??
              options.maxCoastPredictionHorizonHours,
            minHours: options.minCoastPredictionHorizonHours,
          })
        return { refreshTrajectoryPrediction: true }
      }
      if (action === 'increaseCoastHorizon') {
        options.runtime.simulation.coastPredictionHorizonHours =
          getNextTrajectoryHorizonHours({
            action,
            currentHours:
              options.runtime.simulation.coastPredictionHorizonHours,
            maxHours:
              options.runtime.scenario.directives
                .maxCoastPredictionHorizonHours ??
              options.maxCoastPredictionHorizonHours,
            minHours: options.minCoastPredictionHorizonHours,
          })
        return { refreshTrajectoryPrediction: true }
      }
      if (action === 'saveDebugSnapshot') {
        saveDebugScenarioSnapshot()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'loadDebugSnapshot') {
        scenarioRuntimeController.loadDebugSnapshot()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'zoomIn') {
        zoomCamera(0.82)
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'zoomOut') {
        zoomCamera(1.22)
      }
      if (action === 'toggleCameraFollow') {
        setCameraFollow(
          getNextCameraFollowSubject(options.runtime.ui.camera.follow),
        )
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'setCameraFollowSpacecraft') {
        setCameraFollow('spacecraft')
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'setCameraFollowTarget') {
        setCameraFollow('target')
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'recenterCamera') {
        recenterCamera()
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'promptConfirm') {
        const prompts = resolveScenarioPrompts(options.runtime, 'desktop')
        const primaryAction = prompts.active?.buttons[0]?.action
        if (primaryAction) {
          dispatchScenarioPromptAction(primaryAction)
        }
      }

      return { refreshTrajectoryPrediction: false }
    },
    saveDebugSnapshot: saveDebugScenarioSnapshot,
    loadDebugSnapshot: () => {
      const previousStatus = options.runtime.debug.debugSnapshotStatus
      scenarioRuntimeController.loadDebugSnapshot()
      return (
        options.runtime.debug.debugSnapshotStatus !==
          'no debug snapshot saved' ||
        previousStatus !== options.runtime.debug.debugSnapshotStatus
      )
    },
    handleResize: () => {
      const nextPixelRatio = Math.min(window.devicePixelRatio, 2)
      const nextViewport = getViewportDimensions()
      const nextViewportWidth = nextViewport.width
      const nextViewportHeight = nextViewport.height
      const viewportChanged =
        nextViewportWidth !== lastViewportWidth ||
        nextViewportHeight !== lastViewportHeight

      if (viewportChanged && options.runtime.ui.targetHeadingScreenPosition) {
        options.runtime.ui.targetHeadingScreenPosition =
          scaleScreenPointForResize(
            options.runtime.ui.targetHeadingScreenPosition,
            {
              height: lastViewportHeight,
              width: lastViewportWidth,
            },
            {
              height: nextViewportHeight,
              width: nextViewportWidth,
            },
          )
      }

      lastViewportWidth = nextViewportWidth
      lastViewportHeight = nextViewportHeight
      if (options.renderer.getPixelRatio() !== nextPixelRatio) {
        options.renderer.setPixelRatio(nextPixelRatio)
      }
      options.renderer.setSize(nextViewportWidth, nextViewportHeight)
      updateCamera()
    },
    resetScenario: scenarioRuntimeController.resetScenario,
    restartFromCheckpoint: scenarioRuntimeController.restartFromCheckpoint,
    canRecenterCamera,
    getCameraControlsLocked: () =>
      options.runtime.scenario.directives.cameraControlsLocked,
    getCameraFollow: () => options.runtime.ui.camera.follow,
    getCameraTargetPosition,
    panCamera,
    panCameraForCrashInspection,
    recenterCamera,
    setCameraFollow,
    setTargetHeading: (
      heading: number,
      clientX: number,
      clientY: number,
      worldPosition?: Vec2 | null,
    ) => {
      options.runtime.simulation.targetHeading = heading
      options.runtime.simulation.targetHeadingTurn = null
      clearTargetHeadingPlan()
      options.runtime.ui.targetHeadingScreenPosition = {
        x: clientX,
        y: clientY,
      }
      options.runtime.ui.targetHeadingWorldPosition = worldPosition
        ? { ...worldPosition }
        : null
      options.runtime.ui.targetHeadingSelectionEpoch += 1
      options.runtime.simulation.assistMode = 'off'
      options.createRipple(
        options.app,
        options.ripples,
        clientX,
        clientY,
        worldPosition,
      )
    },
    planTargetHeading: (plan: TargetHeadingPlan) => {
      options.runtime.simulation.timeWarpIndex =
        options.navigationTimeWarpController.beginHeadingPlan({
          maxTimeWarp: options.runtime.scenario.directives.maxTimeWarp,
          timeWarpIndex: options.runtime.simulation.timeWarpIndex,
        })
      setTargetHeadingPlan(plan)
    },
    clearTargetHeadingPlan,
    commitTargetHeadingPlan: () => {
      const plan = options.runtime.ui.targetHeadingPlan
      if (!plan) {
        return false
      }
      options.runtime.simulation.targetHeading = plan.heading
      options.runtime.simulation.targetHeadingTurn = null
      options.runtime.ui.targetHeadingScreenPosition = {
        ...plan.screenPosition,
      }
      options.runtime.ui.targetHeadingWorldPosition = {
        ...plan.worldPosition,
      }
      options.runtime.ui.targetHeadingSelectionEpoch += 1
      options.runtime.simulation.assistMode = 'off'
      clearTargetHeadingPlan()
      return true
    },
    nudgeTargetHeading: (deltaRadians: number) => {
      const baseHeading =
        options.runtime.simulation.targetHeading ??
        options.runtime.simulation.state.spacecraft.heading
      options.runtime.simulation.targetHeading = normalizeAngle(
        baseHeading + deltaRadians,
      )
      options.runtime.simulation.targetHeadingTurn = null
      options.runtime.simulation.assistMode = 'off'
    },
    returnToAutomaticAssistTargetSelection: () => {
      if (!options.autoSelectNearestSurface) {
        return false
      }

      options.runtime.simulation.assistTargetSelectionMode = 'auto'
      return true
    },
    recoverScenarioAfterCrash,
    reopenScenarioPrompt,
    selectAssistTargetIndex,
    selectTimeWarpIndex,
    startFreeRoam: scenarioRuntimeController.startFreeRoam,
    startReachMoon: scenarioRuntimeController.startReachMoon,
    startTutorial: scenarioRuntimeController.startTutorial,
    toggleUserInfoPin,
    updateCamera: () => updateCamera(),
    zoomCamera,
  }
}

export type RuntimeActions = ReturnType<typeof createRuntimeActions>

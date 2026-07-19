import * as THREE from 'three'
import {
  createDebugScenarioSnapshotEntryName,
  createSnapshotFromState,
  writeDebugScenarioSnapshot,
} from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'
import { updateCameraView } from '../render/sceneUpdates'
import type { RuntimeScenarioOptions } from '../scenario/runtimeScenario'
import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'
import {
  type CameraControlMode,
  type GlobalScenarioDirectiveLimits,
  getNextCameraControlMode,
} from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { PromptAction } from '../scenario/scenarioPromptTypes'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import { add, type Vec2 } from '../simulation/vector'
import type { Ripple } from '../ui/overlayUpdates'
import type { AppRuntimeState, TargetHeadingPlan } from './appRuntimeState'
import { createScenarioRuntimeController } from './createScenarioRuntimeController'
import type { AssistTargetUiState } from './gameQueries'
import type { GameHighLevelActionsMediator } from './highLevelActions/gameHighLevelActionDispatcher'
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
  maxCoastPredictionHorizonHours: number
  maxViewport: number
  minCoastPredictionHorizonHours: number
  minViewport: number
  renderer: Pick<THREE.WebGLRenderer, 'setSize'>
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
    clearTransientScenarioRuntimeState(options.runtime, () => {
      options.gameScene.trailPoints.length = 0
    })
    resetAssistTargetSelectionMode()
  }

  const setTimeWarp = (warp: number) => {
    options.runtime.simulation.timeWarpIndex = options.timeWarps.reduce(
      (targetIndex, timeWarp, index) =>
        timeWarp <= warp ? index : targetIndex,
      0,
    )
  }
  const capTimeWarpAt = (warp: number) => {
    const maxIndex = options.timeWarps.indexOf(warp)
    if (maxIndex < 0) {
      return
    }
    options.runtime.simulation.timeWarpIndex = Math.min(
      options.runtime.simulation.timeWarpIndex,
      maxIndex,
    )
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
      scenarioSession: options.runtime.scenario.session,
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

  const getCameraTargetPosition = () =>
    options.runtime.ui.camera.mode === 'unlocked'
      ? options.runtime.ui.camera.panOffset
      : options.runtime.ui.camera.mode === 'target'
        ? getTargetCameraTargetPosition()
        : getFollowCameraTargetPosition()

  const updateCamera = (preserveStarfieldWorldPosition = false) =>
    updateCameraView({
      cameraDistance: options.cameraDistance,
      cameraElevation: options.cameraElevation,
      cameraTargetPosition: getCameraTargetPosition(),
      gameScene: options.gameScene,
      preserveStarfieldWorldPosition,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.simulation.viewportSize,
      viewportWidth: window.innerWidth,
    })

  const setCameraMode = (mode: CameraControlMode) => {
    if (options.runtime.scenario.directives.cameraModeChangesLocked) {
      return false
    }

    if (mode === options.runtime.ui.camera.mode) {
      return true
    }

    if (mode === 'unlocked') {
      options.runtime.ui.camera.panOffset = {
        ...getCameraTargetPosition(),
      }
    }
    options.runtime.ui.camera.mode = mode
    updateCamera()
    return true
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

  const unlockCameraAtFollowTarget = (
    targetNdcY = crashInspectionTargetNdcY,
  ) => {
    options.runtime.ui.camera.mode = 'centered'
    updateCamera()
    options.runtime.ui.camera.panOffset =
      getCrashInspectionCameraTargetPosition(
        getFollowCameraTargetPosition(),
        targetNdcY,
      )
    options.runtime.ui.camera.mode = 'unlocked'
    updateCamera()
  }

  const panCamera = (delta: { x: number; y: number }) => {
    if (options.runtime.ui.camera.mode !== 'unlocked') {
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
      focalWorldPoint !== undefined &&
      options.runtime.ui.camera.mode === 'unlocked'

    if (preserveStarfieldWorldPosition) {
      const cameraTarget = getCameraTargetPosition()
      const focalShift = 1 - nextViewportSize / previousViewportSize
      options.runtime.ui.camera.panOffset = {
        x: cameraTarget.x + (focalWorldPoint.x - cameraTarget.x) * focalShift,
        y: cameraTarget.y + (focalWorldPoint.y - cameraTarget.y) * focalShift,
      }
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

  return {
    dispatchScenarioPromptAction,
    enterMainMenuBackground: scenarioRuntimeController.enterMainMenuBackground,
    getDebugSnapshotSuggestedName: () =>
      createDebugScenarioSnapshotEntryName(
        createCurrentDebugScenarioSnapshot(),
      ),
    handleUIUserAction: (action: UIUserAction): RuntimeActionsResult => {
      if (action === 'increaseTimeWarp') {
        options.runtime.simulation.timeWarpIndex = getConstrainedTimeWarpIndex(
          options.runtime.simulation.timeWarpIndex + 1,
          options.timeWarps,
          options.runtime.scenario.directives.maxTimeWarp,
        )
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'decreaseTimeWarp') {
        options.runtime.simulation.timeWarpIndex = getConstrainedTimeWarpIndex(
          Math.max(options.runtime.simulation.timeWarpIndex - 1, 0),
          options.timeWarps,
          options.runtime.scenario.directives.maxTimeWarp,
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
      if (action === 'cycleCameraMode') {
        setCameraMode(getNextCameraControlMode(options.runtime.ui.camera.mode))
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'setCameraCentered') {
        setCameraMode('centered')
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'setCameraTarget') {
        setCameraMode('target')
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'setCameraUnlocked') {
        setCameraMode('unlocked')
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
      const nextViewport = getViewportDimensions()
      const nextViewportWidth = nextViewport.width
      const nextViewportHeight = nextViewport.height

      if (options.runtime.ui.targetHeadingScreenPosition) {
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
      options.renderer.setSize(nextViewportWidth, nextViewportHeight)
      updateCamera()
    },
    resetScenario: scenarioRuntimeController.resetScenario,
    restartFromCheckpoint: scenarioRuntimeController.restartFromCheckpoint,
    getCameraMode: () => options.runtime.ui.camera.mode,
    getCameraModeChangesLocked: () =>
      options.runtime.scenario.directives.cameraModeChangesLocked,
    getCameraTargetPosition,
    panCamera,
    setCameraMode,
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
      capTimeWarpAt(60)
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
    startFreeRoam: scenarioRuntimeController.startFreeRoam,
    startReachMoon: scenarioRuntimeController.startReachMoon,
    startTutorial: scenarioRuntimeController.startTutorial,
    unlockCameraAtFollowTarget,
    updateCamera: () => updateCamera(),
    zoomCamera,
  }
}

export type RuntimeActions = ReturnType<typeof createRuntimeActions>

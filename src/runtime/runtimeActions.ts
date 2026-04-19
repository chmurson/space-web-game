import * as THREE from 'three'
import type { UIUserAction } from '../input/uiUserActions'
import { updateCameraView } from '../render/sceneUpdates'
import {
  type RuntimeScenarioOptions,
  saveRuntimeDebugSnapshot,
} from '../scenario/runtimeScenario'
import {
  getConstrainedTimeWarpIndex,
  syncRuntimeScenarioDirectives,
} from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import {
  acknowledgeRuntimeScenarioPrompt,
  reopenRuntimeScenarioPrompt,
} from '../scenario/scenarioRegistry'
import type { GameSceneRefs } from '../scene/createGameScene'
import { add } from '../simulation/vector'
import type { Ripple } from '../ui/overlayUpdates'
import type { AppRuntimeState } from './appRuntimeState'
import { createScenarioRuntimeController } from './createScenarioRuntimeController'
import type { GameHighLevelActionsMediator } from './highLevelActions/gameHighLevelActionDispatcher'

type RippleCreator = (
  parent: HTMLElement,
  ripples: Ripple[],
  screenX: number,
  screenY: number,
) => void

export type RuntimeActionsResult = {
  refreshTrajectoryPrediction: boolean
}

export const createRuntimeActions = (options: {
  app: HTMLDivElement
  cameraDistance: number
  cameraElevation: number
  createRipple: RippleCreator
  gameScene: GameSceneRefs
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
  const normalizeAngle = (angle: number) => {
    const wrapped = (angle + Math.PI) % (Math.PI * 2)
    return wrapped < 0 ? wrapped + Math.PI : wrapped - Math.PI
  }

  const clearTransientScenarioState = () => {
    options.gameScene.trailPoints.length = 0
    options.runtime.targetHeading = null
    options.runtime.assistMode = 'off'
    options.runtime.crashedBodyName = null
    options.runtime.spacecraftLabelIntroUntil = performance.now() + 5_000
  }

  const setTimeWarp = (warp: number) => {
    const desiredIndex = options.timeWarps.indexOf(warp)
    options.runtime.timeWarpIndex = desiredIndex >= 0 ? desiredIndex : 0
  }
  const scenarioRuntimeController = createScenarioRuntimeController({
    clearTransientScenarioState,
    globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
    runtime: options.runtime,
    runtimeScenarioOptions: options.runtimeScenarioOptions,
    setTimeWarp,
  })

  const saveDebugScenarioSnapshot = () => {
    options.runtime.debugSnapshotStatus = saveRuntimeDebugSnapshot(
      options.runtime.state,
      {
        coastPredictionHorizonHours:
          options.runtime.coastPredictionHorizonHours,
        scenarioSession: options.runtime.scenario.session,
        viewportSize: options.runtime.viewportSize,
      },
    )
      ? 'snapshot saved; use [7] load or ?scenario=debug-snapshot'
      : 'snapshot save failed'
  }

  const updateCamera = () =>
    updateCameraView({
      cameraDistance: options.cameraDistance,
      cameraElevation: options.cameraElevation,
      cameraTargetPosition:
        options.runtime.scenario.directives.cameraFollowBodyId === null
          ? add(
              options.runtime.state.spacecraft.position,
              options.runtime.scenario.directives.cameraFollowOffset,
            )
          : add(
              options.runtime.state.bodies.find(
                (body) =>
                  body.id ===
                  options.runtime.scenario.directives.cameraFollowBodyId,
              )?.position ?? options.runtime.state.spacecraft.position,
              options.runtime.scenario.directives.cameraFollowOffset,
            ),
      gameScene: options.gameScene,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.viewportSize,
      viewportWidth: window.innerWidth,
    })

  const zoomCamera = (factor: number) => {
    options.runtime.viewportSize = THREE.MathUtils.clamp(
      options.runtime.viewportSize * factor,
      options.runtime.scenario.directives.minViewportSize ??
        options.minViewport,
      options.runtime.scenario.directives.maxViewportSize ??
        options.maxViewport,
    )
    updateCamera()
  }

  const recoverScenarioAfterCrash = () => {
    const recoveredFromCheckpoint =
      scenarioRuntimeController.restartFromCheckpoint()
    if (!recoveredFromCheckpoint) {
      scenarioRuntimeController.resetScenario()
      return
    }
  }

  const acknowledgeScenarioPrompt = () => {
    const result = acknowledgeRuntimeScenarioPrompt(options.runtime)
    if (result.acknowledged) {
      syncRuntimeScenarioDirectives(
        options.runtime,
        options.globalScenarioDirectiveLimits,
      )
    }
    return result
  }
  const reopenScenarioPrompt = () => {
    const reopened = reopenRuntimeScenarioPrompt(options.runtime)
    if (reopened) {
      syncRuntimeScenarioDirectives(
        options.runtime,
        options.globalScenarioDirectiveLimits,
      )
    }
    return reopened
  }

  return {
    acknowledgeScenarioPrompt,
    enterMainMenuBackground: scenarioRuntimeController.enterMainMenuBackground,
    handleUIUserAction: (action: UIUserAction): RuntimeActionsResult => {
      if (action === 'increaseTimeWarp') {
        options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
          options.runtime.timeWarpIndex + 1,
          options.timeWarps,
          options.runtime.scenario.directives.maxTimeWarp,
        )
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'decreaseTimeWarp') {
        options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
          Math.max(options.runtime.timeWarpIndex - 1, 0),
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
        options.runtime.assistTargetIndex =
          (options.runtime.assistTargetIndex + 1) %
          options.runtime.state.bodies.length
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'cycleAssistMode') {
        options.runtime.assistMode =
          options.runtime.assistMode === 'off'
            ? 'capture'
            : options.runtime.assistMode === 'capture'
              ? 'circularize'
              : 'off'
        options.runtime.targetHeading = null
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleDebugMode') {
        options.runtime.debugModeEnabled = !options.runtime.debugModeEnabled
        options.updateUserSettings({
          debugModeEnabled: options.runtime.debugModeEnabled,
        })
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleNoGravityDebug') {
        options.runtime.debugNoGravityEnabled =
          !options.runtime.debugNoGravityEnabled
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'toggleFpsIndicator') {
        options.runtime.fpsIndicatorEnabled =
          !options.runtime.fpsIndicatorEnabled
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'togglePerformanceDebug') {
        options.runtime.performanceDebugEnabled =
          !options.runtime.performanceDebugEnabled
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'decreaseCoastHorizon') {
        options.runtime.coastPredictionHorizonHours = Math.max(
          options.minCoastPredictionHorizonHours,
          options.runtime.coastPredictionHorizonHours / 2,
        )
        return { refreshTrajectoryPrediction: true }
      }
      if (action === 'increaseCoastHorizon') {
        options.runtime.coastPredictionHorizonHours = Math.min(
          options.runtime.scenario.directives.maxCoastPredictionHorizonHours ??
            options.maxCoastPredictionHorizonHours,
          options.runtime.coastPredictionHorizonHours * 2,
        )
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
      if (action === 'promptConfirm') {
        acknowledgeScenarioPrompt()
      }

      //here let's call handlePromptConfirm or something

      return { refreshTrajectoryPrediction: false }
    },
    loadDebugSnapshot: () => {
      const previousStatus = options.runtime.debugSnapshotStatus
      scenarioRuntimeController.loadDebugSnapshot()
      return (
        options.runtime.debugSnapshotStatus !== 'no debug snapshot saved' ||
        previousStatus !== options.runtime.debugSnapshotStatus
      )
    },
    handleResize: () => {
      options.renderer.setSize(window.innerWidth, window.innerHeight)
      updateCamera()
    },
    resetScenario: scenarioRuntimeController.resetScenario,
    restartFromCheckpoint: scenarioRuntimeController.restartFromCheckpoint,
    setTargetHeading: (heading: number, clientX: number, clientY: number) => {
      options.runtime.targetHeading = heading
      options.runtime.targetHeadingSelectionEpoch += 1
      options.runtime.assistMode = 'off'
      options.createRipple(options.app, options.ripples, clientX, clientY)
    },
    nudgeTargetHeading: (deltaRadians: number) => {
      const baseHeading =
        options.runtime.targetHeading ??
        options.runtime.state.spacecraft.heading
      options.runtime.targetHeading = normalizeAngle(baseHeading + deltaRadians)
      options.runtime.assistMode = 'off'
    },
    recoverScenarioAfterCrash,
    reopenScenarioPrompt,
    startFreeRoam: scenarioRuntimeController.startFreeRoam,
    startTutorial: scenarioRuntimeController.startTutorial,
    updateCamera,
    zoomCamera,
  }
}

export type RuntimeActions = ReturnType<typeof createRuntimeActions>

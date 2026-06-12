import * as THREE from 'three'
import type { UIUserAction } from '../input/uiUserActions'
import { updateCameraView } from '../render/sceneUpdates'
import {
  type RuntimeScenarioOptions,
  saveRuntimeDebugSnapshot,
} from '../scenario/runtimeScenario'
import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { PromptAction } from '../scenario/scenarioPromptTypes'
import type { GameSceneRefs } from '../scene/createGameScene'
import { add } from '../simulation/vector'
import type { Ripple } from '../ui/overlayUpdates'
import type { AppRuntimeState } from './appRuntimeState'
import { createScenarioRuntimeController } from './createScenarioRuntimeController'
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
) => void

export type RuntimeActionsResult = {
  refreshTrajectoryPrediction: boolean
}

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
  const initialViewport = getViewportDimensions()
  let lastViewportWidth = initialViewport.width
  let lastViewportHeight = initialViewport.height

  const normalizeAngle = (angle: number) => {
    const wrapped = (angle + Math.PI) % (Math.PI * 2)
    return wrapped < 0 ? wrapped + Math.PI : wrapped - Math.PI
  }

  const clearTransientScenarioState = () =>
    clearTransientScenarioRuntimeState(options.runtime, () => {
      options.gameScene.trailPoints.length = 0
    })

  const setTimeWarp = (warp: number) => {
    const desiredIndex = options.timeWarps.indexOf(warp)
    options.runtime.simulation.timeWarpIndex =
      desiredIndex >= 0 ? desiredIndex : 0
  }
  const scenarioRuntimeController = createScenarioRuntimeController({
    clearTransientScenarioState,
    globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
    runtime: options.runtime,
    runtimeScenarioOptions: options.runtimeScenarioOptions,
    setTimeWarp,
  })

  const saveDebugScenarioSnapshot = () => {
    options.runtime.debug.debugSnapshotStatus = saveRuntimeDebugSnapshot(
      options.runtime.simulation.state,
      {
        coastPredictionHorizonHours:
          options.runtime.simulation.coastPredictionHorizonHours,
        scenarioSession: options.runtime.scenario.session,
        viewportSize: options.runtime.simulation.viewportSize,
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
              options.runtime.simulation.state.spacecraft.position,
              options.runtime.scenario.directives.cameraFollowOffset,
            )
          : add(
              options.runtime.simulation.state.bodies.find(
                (body) =>
                  body.id ===
                  options.runtime.scenario.directives.cameraFollowBodyId,
              )?.position ??
                options.runtime.simulation.state.spacecraft.position,
              options.runtime.scenario.directives.cameraFollowOffset,
            ),
      gameScene: options.gameScene,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.simulation.viewportSize,
      viewportWidth: window.innerWidth,
    })

  const zoomCamera = (factor: number) => {
    options.runtime.simulation.viewportSize = THREE.MathUtils.clamp(
      options.runtime.simulation.viewportSize * factor,
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
        options.runtime.simulation.assistTargetIndex =
          (options.runtime.simulation.assistTargetIndex + 1) %
          options.runtime.simulation.state.bodies.length
        return { refreshTrajectoryPrediction: false }
      }
      if (action === 'cycleAssistMode') {
        options.runtime.simulation.assistMode =
          options.runtime.simulation.assistMode === 'off'
            ? 'capture'
            : options.runtime.simulation.assistMode === 'capture'
              ? 'circularize'
              : 'off'
        options.runtime.simulation.targetHeading = null
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
      if (action === 'togglePerformanceDebug') {
        options.runtime.debug.performanceDebugEnabled =
          !options.runtime.debug.performanceDebugEnabled
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
      if (action === 'promptConfirm') {
        const prompts = resolveScenarioPrompts(options.runtime, 'desktop')
        const primaryAction = prompts.active?.buttons[0]?.action
        if (primaryAction) {
          dispatchScenarioPromptAction(primaryAction)
        }
      }

      return { refreshTrajectoryPrediction: false }
    },
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
    setTargetHeading: (heading: number, clientX: number, clientY: number) => {
      options.runtime.simulation.targetHeading = heading
      options.runtime.ui.targetHeadingScreenPosition = {
        x: clientX,
        y: clientY,
      }
      options.runtime.ui.targetHeadingSelectionEpoch += 1
      options.runtime.simulation.assistMode = 'off'
      options.createRipple(options.app, options.ripples, clientX, clientY)
    },
    nudgeTargetHeading: (deltaRadians: number) => {
      const baseHeading =
        options.runtime.simulation.targetHeading ??
        options.runtime.simulation.state.spacecraft.heading
      options.runtime.simulation.targetHeading = normalizeAngle(
        baseHeading + deltaRadians,
      )
      options.runtime.simulation.assistMode = 'off'
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

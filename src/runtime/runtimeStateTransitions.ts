import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import {
  dispatchScenarioPromptAction as dispatchScenarioPromptActionTransition,
  reopenScenarioReplayPrompt,
} from '../scenario/scenarioPrompts'
import type { PromptAction } from '../scenario/scenarioPromptTypes'
import type { ScenarioRuntimeTransition as ScenarioSessionTransition } from '../scenario/scenarioRuntimeTransition'
import { resolveCurrentScenarioScene } from '../scenario/scenarioScenes'
import {
  type AppRuntimeState,
  createDefaultCameraControlUiState,
  createDefaultTouchThrustControlUiState,
} from './appRuntimeState'
import type { ScenarioRuntimeTransition } from './createScenarioRuntimeController'
import type { RuntimeCheckpointRestoreTransition } from './scenarioRecovery'
import type { StepSimulationFrameResult } from './simulationStep'
import type { TrajectoryPredictionState } from './trajectoryPredictionRuntime'

type ClearTransientScenarioState = () => void

export const clearTransientScenarioRuntimeState = (
  runtime: AppRuntimeState,
  clearTrailPoints?: () => void,
) => {
  clearTrailPoints?.()
  runtime.simulation.targetHeading = null
  runtime.simulation.targetHeadingTurn = null
  runtime.simulation.assistMode = 'off'
  runtime.simulation.crashedBodyName = null
  runtime.ui.spacecraftLabelIntroUntil = performance.now() + 5_000
  runtime.ui.targetHeadingScreenPosition = null
  runtime.ui.targetHeadingWorldPosition = null
  runtime.ui.touchThrustControl = createDefaultTouchThrustControlUiState()
}

export const applySimulationFrameResult = (
  runtime: AppRuntimeState,
  frameResult: StepSimulationFrameResult,
) => {
  runtime.simulation.assistMode = frameResult.assistMode
  runtime.simulation.crashedBodyName = frameResult.crashedBodyName
  runtime.simulation.state = frameResult.state
  runtime.simulation.targetHeading = frameResult.targetHeading
  runtime.simulation.targetHeadingTurn = frameResult.targetHeadingTurn ?? null
  runtime.simulation.timeWarpIndex = frameResult.timeWarpIndex
  if (frameResult.targetHeading === null) {
    runtime.ui.targetHeadingScreenPosition = null
    runtime.ui.targetHeadingWorldPosition = null
  }
}

export const applyScenarioLoadTransition = (
  runtime: AppRuntimeState,
  transition: ScenarioRuntimeTransition,
  options: {
    clearTransientScenarioState: ClearTransientScenarioState
    globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  },
) => {
  runtime.scenario.metadata = transition.scenario.metadata
  runtime.simulation.timeWarpIndex = 0
  runtime.simulation.state = transition.state
  runtime.simulation.viewportSize = transition.viewportSize
  runtime.simulation.coastPredictionHorizonHours =
    transition.coastPredictionHorizonHours
  runtime.scenario.session = transition.scenario.session
  runtime.ui.camera = createDefaultCameraControlUiState(
    transition.cameraMode,
    transition.state.spacecraft.position,
  )
  runtime.ui.uiEffectEpoch += 1
  options.clearTransientScenarioState()
  syncRuntimeScenarioDirectives(runtime, options.globalScenarioDirectiveLimits)
}

export const applyCheckpointRestoreTransition = (
  runtime: AppRuntimeState,
  transition: RuntimeCheckpointRestoreTransition | null,
  options: {
    clearTransientScenarioState: ClearTransientScenarioState
    globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  },
) => {
  if (!transition) {
    return false
  }

  runtime.simulation.assistMode = transition.assistMode
  runtime.simulation.assistTargetIndex = transition.assistTargetIndex
  runtime.simulation.coastPredictionHorizonHours =
    transition.coastPredictionHorizonHours
  runtime.simulation.state = transition.state
  runtime.simulation.targetHeading = transition.targetHeading
  runtime.simulation.targetHeadingTurn = transition.targetHeadingTurn ?? null
  runtime.simulation.timeWarpIndex = transition.timeWarpIndex
  runtime.simulation.viewportSize = transition.viewportSize
  runtime.ui.camera = createDefaultCameraControlUiState(
    transition.cameraMode ?? 'centered',
    transition.cameraPanOffset ?? transition.state.spacecraft.position,
  )
  options.clearTransientScenarioState()
  syncRuntimeScenarioDirectives(runtime, options.globalScenarioDirectiveLimits)
  return true
}

export const shouldSyncDirectivesForScenarioTransition = (
  transition: ScenarioSessionTransition | null | undefined,
) => transition?.nextState !== undefined

export const applyScenarioRuntimeTransition = (
  runtime: AppRuntimeState,
  transition: ScenarioSessionTransition | null | undefined,
) => {
  if (!transition) {
    return false
  }

  runtime.scenario.session = {
    ...runtime.scenario.session,
    checkpoint:
      transition.checkpoint === undefined
        ? runtime.scenario.session.checkpoint
        : transition.checkpoint,
    completed:
      transition.completed === undefined
        ? runtime.scenario.session.completed
        : transition.completed,
    promptUi:
      transition.promptUi === undefined
        ? runtime.scenario.session.promptUi
        : transition.promptUi,
    state:
      transition.nextState === undefined
        ? runtime.scenario.session.state
        : transition.nextState,
  }
  return true
}

export const advanceRuntimeScenario = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  options: {
    getTrajectoryPredictionForHorizonHours?: (
      horizonHours: number,
    ) => TrajectoryPredictionState
    shouldAdvance?: boolean
    trajectoryPrediction?: TrajectoryPredictionState
  } = {},
) => {
  const resolvedScene =
    (options.shouldAdvance ?? true)
      ? resolveCurrentScenarioScene(runtime)
      : null
  const transition =
    resolvedScene?.scene.advance?.({
      getTrajectoryPredictionForHorizonHours:
        options.getTrajectoryPredictionForHorizonHours,
      runtime,
      state: resolvedScene.state,
      trajectoryPrediction: options.trajectoryPrediction,
    }) ?? null

  applyScenarioRuntimeTransition(runtime, transition)
  if (shouldSyncDirectivesForScenarioTransition(transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
}

export const dispatchRuntimeScenarioPromptAction = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  action: PromptAction,
) => {
  const result = dispatchScenarioPromptActionTransition(runtime, action)
  applyScenarioRuntimeTransition(runtime, result.transition)
  if (shouldSyncDirectivesForScenarioTransition(result.transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
  return { handled: result.handled, effect: result.effect }
}

export const reopenRuntimeScenarioPrompt = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
) => {
  const reopened = reopenScenarioReplayPrompt(runtime)
  if (reopened) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
  return reopened
}

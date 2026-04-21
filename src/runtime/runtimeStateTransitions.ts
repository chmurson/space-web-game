import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import {
  acknowledgeRuntimeScenarioPrompt as acknowledgeScenarioPromptTransition,
  getRuntimeScenarioDefinition,
  reopenRuntimeScenarioPrompt as reopenScenarioPromptTransition,
} from '../scenario/scenarioRegistry'
import type { ScenarioRuntimeTransition as ScenarioSessionTransition } from '../scenario/scenarioRuntimeTransition'
import type { StepSimulationFrameResult } from './simulationStep'
import type { AppRuntimeState } from './appRuntimeState'
import type { ScenarioRuntimeTransition } from './createScenarioRuntimeController'
import type { RuntimeCheckpointRestoreTransition } from './scenarioRecovery'

type ClearTransientScenarioState = () => void

export const clearTransientScenarioRuntimeState = (
  runtime: AppRuntimeState,
  clearTrailPoints?: () => void,
) => {
  clearTrailPoints?.()
  runtime.simulation.targetHeading = null
  runtime.simulation.assistMode = 'off'
  runtime.simulation.crashedBodyName = null
  runtime.ui.spacecraftLabelIntroUntil = performance.now() + 5_000
}

export const applySimulationFrameResult = (
  runtime: AppRuntimeState,
  frameResult: StepSimulationFrameResult,
) => {
  runtime.simulation.assistMode = frameResult.assistMode
  runtime.simulation.crashedBodyName = frameResult.crashedBodyName
  runtime.simulation.state = frameResult.state
  runtime.simulation.targetHeading = frameResult.targetHeading
  runtime.simulation.timeWarpIndex = frameResult.timeWarpIndex
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
  runtime.simulation.timeWarpIndex = transition.timeWarpIndex
  runtime.simulation.viewportSize = transition.viewportSize
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
  options: { shouldAdvance?: boolean } = {},
) => {
  const transition =
    (options.shouldAdvance ?? true)
      ? (getRuntimeScenarioDefinition(
          runtime.scenario.session.scenarioId,
        )?.advance?.(runtime) ?? null)
      : null

  applyScenarioRuntimeTransition(runtime, transition)
  if (shouldSyncDirectivesForScenarioTransition(transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
}

export const acknowledgeRuntimeScenarioPrompt = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
) => {
  const result = acknowledgeScenarioPromptTransition(runtime)
  applyScenarioRuntimeTransition(runtime, result.transition)
  if (shouldSyncDirectivesForScenarioTransition(result.transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
  return { acknowledged: result.acknowledged, effect: result.effect }
}

export const reopenRuntimeScenarioPrompt = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
) => {
  const transition = reopenScenarioPromptTransition(runtime)
  applyScenarioRuntimeTransition(runtime, transition)
  if (shouldSyncDirectivesForScenarioTransition(transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
  return transition !== null && transition !== undefined
}

import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
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
  runtime.targetHeading = null
  runtime.assistMode = 'off'
  runtime.crashedBodyName = null
  runtime.spacecraftLabelIntroUntil = performance.now() + 5_000
}

export const applySimulationFrameResult = (
  runtime: AppRuntimeState,
  frameResult: StepSimulationFrameResult,
) => {
  runtime.assistMode = frameResult.assistMode
  runtime.crashedBodyName = frameResult.crashedBodyName
  runtime.state = frameResult.state
  runtime.targetHeading = frameResult.targetHeading
  runtime.timeWarpIndex = frameResult.timeWarpIndex
}

export const applyScenarioLoadTransition = (
  runtime: AppRuntimeState,
  transition: ScenarioRuntimeTransition,
  options: {
    clearTransientScenarioState: ClearTransientScenarioState
    globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  },
) => {
  runtime.scenario.activeTitle = transition.scenario.activeTitle
  runtime.scenario.activeDescription = transition.scenario.activeDescription
  runtime.timeWarpIndex = 0
  runtime.state = transition.state
  runtime.viewportSize = transition.viewportSize
  runtime.coastPredictionHorizonHours = transition.coastPredictionHorizonHours
  runtime.scenario.session = transition.scenario.session
  runtime.uiEffectEpoch += 1
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

  runtime.assistMode = transition.assistMode
  runtime.assistTargetIndex = transition.assistTargetIndex
  runtime.coastPredictionHorizonHours = transition.coastPredictionHorizonHours
  runtime.state = transition.state
  runtime.targetHeading = transition.targetHeading
  runtime.timeWarpIndex = transition.timeWarpIndex
  runtime.viewportSize = transition.viewportSize
  options.clearTransientScenarioState()
  syncRuntimeScenarioDirectives(runtime, options.globalScenarioDirectiveLimits)
  return true
}

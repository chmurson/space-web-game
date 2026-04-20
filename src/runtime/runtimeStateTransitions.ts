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

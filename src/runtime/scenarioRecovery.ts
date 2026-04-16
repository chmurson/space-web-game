import { cloneSimulationState } from '../simulation/state'
import type { AppRuntimeState } from './appRuntimeState'

export const restoreRuntimeFromScenarioCheckpoint = (
  runtime: AppRuntimeState,
) => {
  const checkpoint = runtime.scenarioSession.checkpoint
  if (!checkpoint) {
    return false
  }

  runtime.assistMode = checkpoint.assistMode
  runtime.assistTargetIndex = checkpoint.assistTargetIndex
  runtime.coastPredictionHorizonHours = checkpoint.coastPredictionHorizonHours
  runtime.state = cloneSimulationState(
    checkpoint.world,
    checkpoint.world.controls,
  )
  runtime.targetHeading = checkpoint.targetHeading
  runtime.timeWarpIndex = 0
  runtime.viewportSize = checkpoint.viewportSize
  return true
}

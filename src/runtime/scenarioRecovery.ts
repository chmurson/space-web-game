import { cloneSimulationState } from '../simulation/state'
import type { AppRuntimeState } from './appRuntimeState'

export type RuntimeCheckpointRestoreTransition = {
  assistMode: AppRuntimeState['assistMode']
  assistTargetIndex: AppRuntimeState['assistTargetIndex']
  coastPredictionHorizonHours: AppRuntimeState['coastPredictionHorizonHours']
  state: AppRuntimeState['state']
  targetHeading: AppRuntimeState['targetHeading']
  timeWarpIndex: AppRuntimeState['timeWarpIndex']
  viewportSize: AppRuntimeState['viewportSize']
}

export const createRuntimeCheckpointRestoreTransition = (
  runtime: AppRuntimeState,
): RuntimeCheckpointRestoreTransition | null => {
  const checkpoint = runtime.scenario.session.checkpoint
  if (!checkpoint) {
    return null
  }

  return {
    assistMode: checkpoint.assistMode,
    assistTargetIndex: checkpoint.assistTargetIndex,
    coastPredictionHorizonHours: checkpoint.coastPredictionHorizonHours,
    state: cloneSimulationState(checkpoint.world, checkpoint.world.controls),
    targetHeading: checkpoint.targetHeading,
    timeWarpIndex: 0,
    viewportSize: checkpoint.viewportSize,
  }
}

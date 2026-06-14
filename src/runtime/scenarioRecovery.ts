import { cloneSimulationState } from '../simulation/state'
import type {
  AppRuntimeSimulationSlice,
  AppRuntimeState,
  CameraControlUiState,
} from './appRuntimeState'

export type RuntimeCheckpointRestoreTransition = {
  assistMode: AppRuntimeSimulationSlice['assistMode']
  assistTargetIndex: AppRuntimeSimulationSlice['assistTargetIndex']
  cameraMode?: CameraControlUiState['mode']
  cameraPanOffset?: CameraControlUiState['panOffset']
  coastPredictionHorizonHours: AppRuntimeSimulationSlice['coastPredictionHorizonHours']
  state: AppRuntimeSimulationSlice['state']
  targetHeading: AppRuntimeSimulationSlice['targetHeading']
  timeWarpIndex: AppRuntimeSimulationSlice['timeWarpIndex']
  viewportSize: AppRuntimeSimulationSlice['viewportSize']
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
    cameraMode: checkpoint.cameraMode,
    cameraPanOffset: checkpoint.cameraPanOffset
      ? { ...checkpoint.cameraPanOffset }
      : undefined,
    coastPredictionHorizonHours: checkpoint.coastPredictionHorizonHours,
    state: cloneSimulationState(checkpoint.world, checkpoint.world.controls),
    targetHeading: checkpoint.targetHeading,
    timeWarpIndex: 0,
    viewportSize: checkpoint.viewportSize,
  }
}

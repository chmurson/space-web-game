import { cloneSimulationState } from '../simulation/state'
import { sub } from '../simulation/vector'
import type {
  AppRuntimeSimulationSlice,
  AppRuntimeState,
  CameraControlUiState,
} from './appRuntimeState'

export type RuntimeCheckpointRestoreTransition = {
  assistMode: AppRuntimeSimulationSlice['assistMode']
  assistTargetIndex: AppRuntimeSimulationSlice['assistTargetIndex']
  cameraFollow?: CameraControlUiState['follow']
  cameraPanOffset?: CameraControlUiState['panOffset']
  cameraView?: CameraControlUiState['view']
  coastPredictionHorizonHours: AppRuntimeSimulationSlice['coastPredictionHorizonHours']
  state: AppRuntimeSimulationSlice['state']
  targetHeading: AppRuntimeSimulationSlice['targetHeading']
  targetHeadingTurn?: AppRuntimeSimulationSlice['targetHeadingTurn']
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

  const legacyCameraMode = checkpoint.cameraMode
  const cameraFollow =
    checkpoint.cameraFollow ??
    (legacyCameraMode === 'target' ? 'target' : 'spacecraft')
  const cameraView =
    checkpoint.cameraView ??
    (legacyCameraMode === 'unlocked' ? 'free' : 'locked')
  const cameraPanOffset =
    legacyCameraMode === 'unlocked' && checkpoint.cameraPanOffset
      ? sub(checkpoint.cameraPanOffset, checkpoint.world.spacecraft.position)
      : checkpoint.cameraPanOffset

  return {
    assistMode: checkpoint.assistMode,
    assistTargetIndex: checkpoint.assistTargetIndex,
    cameraFollow,
    cameraPanOffset: cameraPanOffset ? { ...cameraPanOffset } : undefined,
    cameraView,
    coastPredictionHorizonHours: checkpoint.coastPredictionHorizonHours,
    state: cloneSimulationState(checkpoint.world, checkpoint.world.controls),
    targetHeading: checkpoint.targetHeading,
    targetHeadingTurn: checkpoint.targetHeadingTurn
      ? { ...checkpoint.targetHeadingTurn }
      : null,
    timeWarpIndex: 0,
    viewportSize: checkpoint.viewportSize,
  }
}

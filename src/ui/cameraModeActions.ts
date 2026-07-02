import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'

const cameraModeActions = {
  centered: 'setCameraCentered',
  target: 'setCameraTarget',
  unlocked: 'setCameraUnlocked',
} as const satisfies Record<CameraControlMode, UIUserAction>

export const getCameraModeAction = (mode: CameraControlMode): UIUserAction =>
  cameraModeActions[mode]

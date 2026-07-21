import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'

const cameraModeActions = {
  centered: 'setCameraCentered',
  target: 'setCameraTarget',
  unlocked: 'setCameraUnlocked',
} as const satisfies Record<CameraControlMode, UIUserAction>

export const cameraModeOptions = [
  { label: 'Free roam', mode: 'unlocked' },
  { label: 'Spacecraft', mode: 'centered' },
  { label: 'Target', mode: 'target' },
] as const satisfies ReadonlyArray<{
  label: string
  mode: CameraControlMode
}>

export const getCameraModeDescription = (mode: CameraControlMode) =>
  cameraModeOptions.find((option) => option.mode === mode)?.label ?? 'Unknown'

export const getCameraModeAction = (mode: CameraControlMode): UIUserAction =>
  cameraModeActions[mode]

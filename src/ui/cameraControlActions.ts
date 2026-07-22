import type { UIUserAction } from '../input/uiUserActions'
import type { CameraFollowSubject } from '../scenario/scenarioDirectiveTypes'

const cameraFollowActions = {
  spacecraft: 'setCameraFollowSpacecraft',
  target: 'setCameraFollowTarget',
} as const satisfies Record<CameraFollowSubject, UIUserAction>

export const cameraFollowOptions = [
  { follow: 'spacecraft', label: 'Spacecraft' },
  { follow: 'target', label: 'Target' },
] as const satisfies ReadonlyArray<{
  follow: CameraFollowSubject
  label: string
}>

export const getCameraFollowDescription = (follow: CameraFollowSubject) =>
  cameraFollowOptions.find((option) => option.follow === follow)?.label ??
  'Unknown'

export const getCameraFollowAction = (
  follow: CameraFollowSubject,
): UIUserAction => cameraFollowActions[follow]

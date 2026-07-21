import type { UIUserAction } from '../input/uiUserActions'
import type {
  CameraFollowSubject,
  CameraViewMode,
} from '../scenario/scenarioDirectiveTypes'

const cameraFollowActions = {
  spacecraft: 'setCameraFollowSpacecraft',
  target: 'setCameraFollowTarget',
} as const satisfies Record<CameraFollowSubject, UIUserAction>

const cameraViewActions = {
  free: 'setCameraViewFreeRoam',
  locked: 'setCameraViewLocked',
} as const satisfies Record<CameraViewMode, UIUserAction>

export const cameraFollowOptions = [
  { follow: 'spacecraft', label: 'Spacecraft' },
  { follow: 'target', label: 'Target' },
] as const satisfies ReadonlyArray<{
  follow: CameraFollowSubject
  label: string
}>

export const cameraViewOptions = [
  { label: 'Locked', view: 'locked' },
  { label: 'Free roam', view: 'free' },
] as const satisfies ReadonlyArray<{
  label: string
  view: CameraViewMode
}>

export const getCameraFollowDescription = (follow: CameraFollowSubject) =>
  cameraFollowOptions.find((option) => option.follow === follow)?.label ??
  'Unknown'

export const getCameraViewDescription = (view: CameraViewMode) =>
  cameraViewOptions.find((option) => option.view === view)?.label ?? 'Unknown'

export const getCameraFollowAction = (
  follow: CameraFollowSubject,
): UIUserAction => cameraFollowActions[follow]

export const getCameraViewAction = (view: CameraViewMode): UIUserAction =>
  cameraViewActions[view]

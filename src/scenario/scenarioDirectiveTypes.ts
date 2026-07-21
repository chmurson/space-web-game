export const cameraFollowSubjects = ['spacecraft', 'target'] as const
export const cameraViewModes = ['locked', 'free'] as const

export type CameraFollowSubject = (typeof cameraFollowSubjects)[number]
export type CameraViewMode = (typeof cameraViewModes)[number]

export const isCameraFollowSubject = (
  value: unknown,
): value is CameraFollowSubject =>
  typeof value === 'string' &&
  cameraFollowSubjects.includes(value as CameraFollowSubject)

export const isCameraViewMode = (value: unknown): value is CameraViewMode =>
  typeof value === 'string' && cameraViewModes.includes(value as CameraViewMode)

export const getNextCameraFollowSubject = (
  follow: CameraFollowSubject,
): CameraFollowSubject => (follow === 'spacecraft' ? 'target' : 'spacecraft')

export const getNextCameraViewMode = (view: CameraViewMode): CameraViewMode =>
  view === 'locked' ? 'free' : 'locked'

export type RuntimeScenarioHiddenUIElement =
  | 'scenarioInfoButton'
  | 'speedPill'
  | 'targetControl'
  | 'targetPill'
  | 'thrustControl'
  | 'thrustPill'
  | 'timeWarpPill'
  | 'trajectory'

export type RuntimeScenarioDirectives = {
  cameraControlsLocked: boolean
  cameraFollow: CameraFollowSubject | null
  cameraFollowBodyId: string | null
  cameraFollowOffset: { x: number; y: number }
  cameraView: CameraViewMode | null
  forcedAssistTargetId: string | null
  hiddenBodyIds: string[]
  maxCoastPredictionHorizonHours: number | null
  maxTimeWarp: number | null
  maxViewportSize: number | null
  minViewportSize: number | null
  hiddenUIElements: Set<RuntimeScenarioHiddenUIElement>
}

export type GlobalScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: number
  defaultViewportSize: number
  maxViewportSize: number
  minViewportSize: number
  timeWarps: number[]
}

export const createDefaultScenarioDirectives =
  (): RuntimeScenarioDirectives => ({
    cameraControlsLocked: false,
    cameraFollow: null,
    cameraFollowBodyId: null,
    cameraFollowOffset: { x: 0, y: 0 },
    cameraView: null,
    forcedAssistTargetId: null,
    hiddenBodyIds: [],
    maxCoastPredictionHorizonHours: null,
    maxTimeWarp: null,
    maxViewportSize: null,
    minViewportSize: null,
    hiddenUIElements: new Set(),
  })

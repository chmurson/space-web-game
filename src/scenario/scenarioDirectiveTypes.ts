export const cameraFollowSubjects = ['spacecraft', 'target'] as const

export type CameraFollowSubject = (typeof cameraFollowSubjects)[number]

export const isCameraFollowSubject = (
  value: unknown,
): value is CameraFollowSubject =>
  typeof value === 'string' &&
  cameraFollowSubjects.includes(value as CameraFollowSubject)

export const getNextCameraFollowSubject = (
  follow: CameraFollowSubject,
): CameraFollowSubject => (follow === 'spacecraft' ? 'target' : 'spacecraft')

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
    forcedAssistTargetId: null,
    hiddenBodyIds: [],
    maxCoastPredictionHorizonHours: null,
    maxTimeWarp: null,
    maxViewportSize: null,
    minViewportSize: null,
    hiddenUIElements: new Set(),
  })

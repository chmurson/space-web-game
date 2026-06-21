export type CameraControlMode = 'centered' | 'unlocked'

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
  cameraFollowBodyId: string | null
  cameraFollowOffset: { x: number; y: number }
  cameraMode: CameraControlMode | null
  cameraModeChangesLocked: boolean
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
    cameraFollowBodyId: null,
    cameraFollowOffset: { x: 0, y: 0 },
    cameraMode: null,
    cameraModeChangesLocked: false,
    forcedAssistTargetId: null,
    hiddenBodyIds: [],
    maxCoastPredictionHorizonHours: null,
    maxTimeWarp: null,
    maxViewportSize: null,
    minViewportSize: null,
    hiddenUIElements: new Set(),
  })

export type RuntimeScenarioHiddenUIElement =
  | 'scenarioInfoButton'
  | 'speedPill'
  | 'thrustPill'
  | 'timeWarpPill'
  | 'trajectory'

export type RuntimeScenarioDirectives = {
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

export type ScenarioDirectiveLimits = {
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
    forcedAssistTargetId: null,
    hiddenBodyIds: [],
    maxCoastPredictionHorizonHours: null,
    maxTimeWarp: null,
    maxViewportSize: null,
    minViewportSize: null,
    hiddenUIElements: new Set(),
  })

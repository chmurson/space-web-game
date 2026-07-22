import type { InfoPin } from '../runtime/infoPins'

export const cameraControlModes = ['unlocked', 'centered', 'target'] as const

export type CameraControlMode = (typeof cameraControlModes)[number]

export const isCameraControlMode = (
  value: unknown,
): value is CameraControlMode =>
  typeof value === 'string' &&
  cameraControlModes.includes(value as CameraControlMode)

export const getNextCameraControlMode = (
  mode: CameraControlMode,
): CameraControlMode => {
  const currentIndex = cameraControlModes.indexOf(mode)
  return (
    cameraControlModes[(currentIndex + 1) % cameraControlModes.length] ??
    'unlocked'
  )
}

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
  infoPins: InfoPin[]
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
    infoPins: [],
  })

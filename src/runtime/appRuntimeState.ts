import type { AssistMode } from '../assist/orbitalAssist'
import type {
  CameraFollowSubject,
  RuntimeScenarioDirectives,
} from '../scenario/scenarioDirectiveTypes'
import type { ScenarioRenderConfig } from '../scenario/scenarioRenderConfig'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import type { SimulationState, TargetHeadingTurn } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { InfoPin } from './infoPins'
import type { RcsActualTurnFeedback } from './rcsActualTurnFeedback'

export type AssistTargetSelectionMode = 'auto' | 'manual'

export type AppRuntimeSimulationSlice = {
  assistMode: AssistMode
  assistTargetIndex: number
  assistTargetSelectionMode: AssistTargetSelectionMode
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  state: SimulationState
  targetHeading: number | null
  targetHeadingTurn: TargetHeadingTurn | null
  timeWarpIndex: number
  viewportSize: number
}

export type RuntimeScenarioMetadata = {
  description: string
  title: string
}

export type TouchThrustControlUiState = {
  engaged: boolean
  interactive: boolean
  revealed: boolean
  visible: boolean
}

export type CameraControlUiState = {
  follow: CameraFollowSubject
  panOffset: Vec2
}

export type RuntimeTransientNotice = {
  body?: string
  id: string
  title: string
}

export const createDefaultTouchThrustControlUiState =
  (): TouchThrustControlUiState => ({
    engaged: false,
    interactive: false,
    revealed: false,
    visible: false,
  })

export const createDefaultCameraControlUiState = (
  follow: CameraFollowSubject = 'spacecraft',
  panOffset: Vec2 = { x: 0, y: 0 },
): CameraControlUiState => ({
  follow,
  panOffset: { ...panOffset },
})

export type AppRuntimeScenarioSlice = {
  directives: RuntimeScenarioDirectives
  metadata: RuntimeScenarioMetadata
  render?: ScenarioRenderConfig
  session: RuntimeScenarioSession
}

export type AppRuntimeUiSlice = {
  camera: CameraControlUiState
  rcsActualTurnFeedback?: RcsActualTurnFeedback | null
  spacecraftLabelIntroUntil: number
  touchThrustControl: TouchThrustControlUiState
  transientNotice?: RuntimeTransientNotice | null
  uiEffectEpoch: number
}

export type AppRuntimeDebugSlice = {
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
}

export type AppRuntimeInfoSlice = {
  userPins: InfoPin[]
}

export type AppRuntimeState = {
  simulation: AppRuntimeSimulationSlice
  scenario: AppRuntimeScenarioSlice
  ui: AppRuntimeUiSlice
  debug: AppRuntimeDebugSlice
  info: AppRuntimeInfoSlice
}

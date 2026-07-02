import type { AssistMode } from '../assist/orbitalAssist'
import type {
  CameraControlMode,
  RuntimeScenarioDirectives,
} from '../scenario/scenarioDirectiveTypes'
import type { ScenarioRenderConfig } from '../scenario/scenarioRenderConfig'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import type { SimulationState, TargetHeadingTurn } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { OrbitPointDisplaySettingOverrides } from '../userSettingsStorage'

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
  mode: CameraControlMode
  panOffset: Vec2
}

export const createDefaultTouchThrustControlUiState =
  (): TouchThrustControlUiState => ({
    engaged: false,
    interactive: false,
    revealed: false,
    visible: false,
  })

export const createDefaultCameraControlUiState = (
  mode: CameraControlMode = 'centered',
  panOffset: Vec2 = { x: 0, y: 0 },
): CameraControlUiState => ({
  mode,
  panOffset: { ...panOffset },
})

export type AppRuntimeScenarioSlice = {
  directives: RuntimeScenarioDirectives
  metadata: RuntimeScenarioMetadata
  orbitPointDisplay?: OrbitPointDisplaySettingOverrides
  render?: ScenarioRenderConfig
  session: RuntimeScenarioSession
}

export type AppRuntimeUiSlice = {
  camera: CameraControlUiState
  spacecraftLabelIntroUntil: number
  targetHeadingScreenPosition?: {
    x: number
    y: number
  } | null
  targetHeadingWorldPosition?: Vec2 | null
  targetHeadingSelectionEpoch: number
  touchThrustControl: TouchThrustControlUiState
  uiEffectEpoch: number
}

export type AppRuntimeDebugSlice = {
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
}

export type AppRuntimeState = {
  simulation: AppRuntimeSimulationSlice
  scenario: AppRuntimeScenarioSlice
  ui: AppRuntimeUiSlice
  debug: AppRuntimeDebugSlice
}

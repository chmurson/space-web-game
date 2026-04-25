import type { AssistMode } from '../assist/orbitalAssist'
import type { RuntimeScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import type { SimulationState } from '../simulation/types'

export type AppRuntimeSimulationSlice = {
  assistMode: AssistMode
  assistTargetIndex: number
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  state: SimulationState
  targetHeading: number | null
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
  visible: boolean
}

export type AppRuntimeScenarioSlice = {
  directives: RuntimeScenarioDirectives
  metadata: RuntimeScenarioMetadata
  session: RuntimeScenarioSession
}

export type AppRuntimeUiSlice = {
  spacecraftLabelIntroUntil: number
  targetHeadingScreenPosition?: {
    x: number
    y: number
  } | null
  targetHeadingSelectionEpoch: number
  touchThrustControl: TouchThrustControlUiState
  uiEffectEpoch: number
}

export type AppRuntimeDebugSlice = {
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
}

export type AppRuntimeState = {
  simulation: AppRuntimeSimulationSlice
  scenario: AppRuntimeScenarioSlice
  ui: AppRuntimeUiSlice
  debug: AppRuntimeDebugSlice
}

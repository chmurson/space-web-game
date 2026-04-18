import type { AssistMode } from '../assist/orbitalAssist'
import type { RuntimeScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import type { SimulationState } from '../simulation/types'

export type AppRuntimeState = {
  activeScenarioDescription: string
  activeScenarioTitle: string
  assistMode: AssistMode
  assistTargetIndex: number
  coastPredictionHorizonHours: number
  crashedBodyName: string | null
  debugModeEnabled: boolean
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
  resetScenario: {
    description: string
    scenarioId: string
    title: string
  }
  scenarioDirectives: RuntimeScenarioDirectives
  scenarioSession: RuntimeScenarioSession
  spacecraftLabelIntroUntil: number
  targetHeadingSelectionEpoch: number
  uiEffectEpoch: number
  state: SimulationState
  targetHeading: number | null
  timeWarpIndex: number
  viewportSize: number
}

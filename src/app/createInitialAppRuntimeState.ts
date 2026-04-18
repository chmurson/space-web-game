import type { AppConfigContext } from './createAppConfigContext'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioState } from '../scenario/runtimeScenario'

export const createInitialAppRuntimeState = (
  config: AppConfigContext,
): AppRuntimeState => {
  const initialRuntimeScenarioState = createRuntimeScenarioState(
    config.initialScenario,
    config.runtimeScenarioOptions,
  )
  const runtimeState: AppRuntimeState = {
    assistMode: 'off',
    assistTargetIndex: 1,
    coastPredictionHorizonHours:
      initialRuntimeScenarioState.coastPredictionHorizonHours,
    crashedBodyName: null,
    debugModeEnabled: config.userSettings.debugModeEnabled,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
    scenarioDirectives: createDefaultScenarioDirectives(),
    scenarioSession: initialRuntimeScenarioState.scenarioSession,
    spacecraftLabelIntroUntil: performance.now() + 5_000,
    targetHeadingSelectionEpoch: 0,
    uiEffectEpoch: 0,
    state: initialRuntimeScenarioState.state,
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: initialRuntimeScenarioState.viewportSize,
  }

  syncRuntimeScenarioDirectives(
    runtimeState,
    config.globalScenarioDirectiveLimits,
  )

  return runtimeState
}

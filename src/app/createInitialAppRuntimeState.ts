import type { AppConfigContext } from './createAppConfigContext'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import {
  createScenarioRuntimeTransition,
  resolveStartupScenarioId,
} from '../runtime/createScenarioRuntimeController'

export const createInitialAppRuntimeState = (
  config: AppConfigContext,
): AppRuntimeState => {
  const initialScenarioTransition = createScenarioRuntimeTransition(
    resolveStartupScenarioId({
      initialAppMode: config.initialAppMode,
      requestedScenarioId: config.requestedScenarioId,
    }),
    config.runtimeScenarioOptions,
  )
  const runtimeState: AppRuntimeState = {
    assistMode: 'off',
    assistTargetIndex: 1,
    coastPredictionHorizonHours:
      initialScenarioTransition.coastPredictionHorizonHours,
    crashedBodyName: null,
    debugModeEnabled: config.userSettings.debugModeEnabled,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
    scenario: {
      activeDescription: initialScenarioTransition.scenario.activeDescription,
      activeTitle: initialScenarioTransition.scenario.activeTitle,
      directives: createDefaultScenarioDirectives(),
      session: initialScenarioTransition.scenario.session,
    },
    spacecraftLabelIntroUntil: performance.now() + 5_000,
    targetHeadingSelectionEpoch: 0,
    uiEffectEpoch: 0,
    state: initialScenarioTransition.state,
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: initialScenarioTransition.viewportSize,
  }

  syncRuntimeScenarioDirectives(
    runtimeState,
    config.globalScenarioDirectiveLimits,
  )

  if (config.initialAppMode === 'menu') {
    runtimeState.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
    const menuTimeWarpIndex = config.controls.timeWarps.indexOf(500)
    runtimeState.timeWarpIndex = menuTimeWarpIndex >= 0 ? menuTimeWarpIndex : 0
  }

  return runtimeState
}

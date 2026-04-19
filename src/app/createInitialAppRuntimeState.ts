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
    simulation: {
      assistMode: 'off',
      assistTargetIndex: 1,
      coastPredictionHorizonHours:
        initialScenarioTransition.coastPredictionHorizonHours,
      crashedBodyName: null,
      state: initialScenarioTransition.state,
      targetHeading: null,
      timeWarpIndex: 0,
      viewportSize: initialScenarioTransition.viewportSize,
    },
    scenario: {
      activeDescription: initialScenarioTransition.scenario.activeDescription,
      activeTitle: initialScenarioTransition.scenario.activeTitle,
      directives: createDefaultScenarioDirectives(),
      session: initialScenarioTransition.scenario.session,
    },
    ui: {
      spacecraftLabelIntroUntil: performance.now() + 5_000,
      targetHeadingSelectionEpoch: 0,
      uiEffectEpoch: 0,
    },
    debug: {
      debugModeEnabled: config.userSettings.debugModeEnabled,
      debugNoGravityEnabled: false,
      debugSnapshotStatus: '',
      fpsIndicatorEnabled: false,
      performanceDebugEnabled: false,
    },
  }

  syncRuntimeScenarioDirectives(
    runtimeState,
    config.globalScenarioDirectiveLimits,
  )

  if (config.initialAppMode === 'menu') {
    runtimeState.ui.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
    const menuTimeWarpIndex = config.controls.timeWarps.indexOf(500)
    runtimeState.simulation.timeWarpIndex =
      menuTimeWarpIndex >= 0 ? menuTimeWarpIndex : 0
  }

  return runtimeState
}

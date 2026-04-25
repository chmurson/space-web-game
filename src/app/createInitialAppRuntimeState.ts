import type { AppConfigContext } from './createAppConfigContext'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import {
  createScenarioRuntimeTransition,
  resolveStartupScenarioId,
} from '../runtime/createScenarioRuntimeController'

const menuTimeWarpTarget = 300

const getMenuTimeWarpIndex = (timeWarps: number[]) =>
  timeWarps.reduce(
    (targetIndex, timeWarp, index) =>
      timeWarp <= menuTimeWarpTarget ? index : targetIndex,
    0,
  )

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
      directives: createDefaultScenarioDirectives(),
      metadata: initialScenarioTransition.scenario.metadata,
      session: initialScenarioTransition.scenario.session,
    },
    ui: {
      spacecraftLabelIntroUntil: performance.now() + 5_000,
      targetHeadingScreenPosition: null,
      targetHeadingSelectionEpoch: 0,
      touchThrustControl: {
        engaged: false,
        interactive: false,
        visible: false,
      },
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
    runtimeState.simulation.timeWarpIndex = getMenuTimeWarpIndex(
      config.controls.timeWarps,
    )
  }

  return runtimeState
}

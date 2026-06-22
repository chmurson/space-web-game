import {
  type AppRuntimeState,
  createDefaultCameraControlUiState,
  createDefaultTouchThrustControlUiState,
} from '../runtime/appRuntimeState'
import {
  createScenarioRuntimeTransition,
  resolveStartupScenarioId,
} from '../runtime/createScenarioRuntimeController'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import type { AppConfigContext } from './createAppConfigContext'

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
      assistTargetSelectionMode: config.assistTarget.autoSelectNearestSurface
        ? 'auto'
        : 'manual',
      coastPredictionHorizonHours:
        initialScenarioTransition.coastPredictionHorizonHours,
      crashedBodyName: null,
      state: initialScenarioTransition.state,
      targetHeading: null,
      targetHeadingTurn: null,
      timeWarpIndex: 0,
      viewportSize: initialScenarioTransition.viewportSize,
    },
    scenario: {
      directives: createDefaultScenarioDirectives(),
      metadata: initialScenarioTransition.scenario.metadata,
      session: initialScenarioTransition.scenario.session,
    },
    ui: {
      camera: createDefaultCameraControlUiState(
        initialScenarioTransition.cameraMode,
        initialScenarioTransition.state.spacecraft.position,
      ),
      spacecraftLabelIntroUntil: performance.now() + 5_000,
      targetHeadingScreenPosition: null,
      targetHeadingWorldPosition: null,
      targetHeadingSelectionEpoch: 0,
      touchThrustControl: createDefaultTouchThrustControlUiState(),
      uiEffectEpoch: 0,
    },
    debug: {
      debugModeEnabled: config.userSettings.debugModeEnabled,
      debugNoGravityEnabled: false,
      debugSnapshotStatus: '',
      fpsIndicatorEnabled: false,
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

import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  loadDebugRuntimeScenario,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import type { AppRuntimeState } from './appRuntimeState'
import { restoreRuntimeFromScenarioCheckpoint } from './scenarioRecovery'

export type ScenarioRuntimeTransition = {
  coastPredictionHorizonHours: number
  scenario: Pick<
    AppRuntimeState['scenario'],
    'activeDescription' | 'activeTitle' | 'session'
  >
  state: AppRuntimeState['state']
  viewportSize: number
}

export const resolveStartupScenarioId = (options: {
  initialAppMode: 'menu' | 'game'
  requestedScenarioId: string
}) =>
  options.initialAppMode === 'menu'
    ? 'menu-background'
    : options.requestedScenarioId

export const createScenarioRuntimeTransition = (
  scenarioId: string,
  runtimeScenarioOptions: RuntimeScenarioOptions,
): ScenarioRuntimeTransition => {
  const scenario = createRequestedRuntimeScenario(scenarioId)
  const runtimeScenarioState = createRuntimeScenarioState(
    scenario,
    runtimeScenarioOptions,
  )

  return {
    coastPredictionHorizonHours:
      runtimeScenarioState.coastPredictionHorizonHours,
    scenario: {
      activeDescription: scenario.description,
      activeTitle: scenario.name,
      session: runtimeScenarioState.scenarioSession,
    },
    state: runtimeScenarioState.state,
    viewportSize: runtimeScenarioState.viewportSize,
  }
}

export type ScenarioRuntimeController = {
  enterMainMenuBackground(): void
  initializeFromStartup(options: {
    initialAppMode: 'menu' | 'game'
    requestedScenarioId: string
  }): void
  loadDebugSnapshot(): boolean
  resetScenario(): void
  restartFromCheckpoint(): boolean
  startFreeRoam(): void
  startTutorial(): void
}

export const createScenarioRuntimeController = (options: {
  runtime: AppRuntimeState
  runtimeScenarioOptions: RuntimeScenarioOptions
  globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  setTimeWarp: (warp: number) => void
  clearTransientScenarioState: () => void
}) => {
  const applyRuntimeScenarioTransition = (
    transition: ScenarioRuntimeTransition,
  ) => {
    options.runtime.scenario.activeTitle = transition.scenario.activeTitle
    options.runtime.scenario.activeDescription =
      transition.scenario.activeDescription
    options.runtime.timeWarpIndex = 0
    options.runtime.state = transition.state
    options.runtime.viewportSize = transition.viewportSize
    options.runtime.coastPredictionHorizonHours =
      transition.coastPredictionHorizonHours
    options.runtime.scenario.session = transition.scenario.session
    options.runtime.uiEffectEpoch += 1
    options.clearTransientScenarioState()
    syncRuntimeScenarioDirectives(
      options.runtime,
      options.globalScenarioDirectiveLimits,
    )
  }

  const loadScenarioById = (scenarioId: string) => {
    applyRuntimeScenarioTransition(
      createScenarioRuntimeTransition(
        scenarioId,
        options.runtimeScenarioOptions,
      ),
    )
  }

  return {
    enterMainMenuBackground: () => {
      loadScenarioById('menu-background')
      options.runtime.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
      options.setTimeWarp(500)
    },
    initializeFromStartup: (startupOptions: {
      initialAppMode: 'menu' | 'game'
      requestedScenarioId: string
    }) => {
      loadScenarioById(resolveStartupScenarioId(startupOptions))
      if (startupOptions.initialAppMode !== 'menu') {
        return
      }

      options.runtime.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
      options.setTimeWarp(500)
    },
    loadDebugSnapshot: () => {
      const loadedDebugScenario = loadDebugRuntimeScenario(
        options.runtimeScenarioOptions,
      )
      if (!loadedDebugScenario) {
        options.runtime.debugSnapshotStatus = 'no debug snapshot saved'
        return false
      }

      applyRuntimeScenarioTransition({
        coastPredictionHorizonHours:
          loadedDebugScenario.runtimeState.coastPredictionHorizonHours,
        scenario: {
          activeDescription: loadedDebugScenario.scenario.description,
          activeTitle: loadedDebugScenario.scenario.name,
          session: loadedDebugScenario.runtimeState.scenarioSession,
        },
        state: loadedDebugScenario.runtimeState.state,
        viewportSize: loadedDebugScenario.runtimeState.viewportSize,
      })
      options.runtime.assistTargetIndex = Math.min(
        options.runtime.assistTargetIndex,
        Math.max(0, options.runtime.state.bodies.length - 1),
      )
      options.runtime.debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`
      options.setTimeWarp(1)
      return true
    },
    resetScenario: () => {
      applyRuntimeScenarioTransition(
        createScenarioRuntimeTransition(
          options.runtime.scenario.session.scenarioId,
          options.runtimeScenarioOptions,
        ),
      )
    },
    restartFromCheckpoint: () => {
      const recoveredFromCheckpoint = restoreRuntimeFromScenarioCheckpoint(
        options.runtime,
      )
      if (!recoveredFromCheckpoint) {
        return false
      }

      options.clearTransientScenarioState()
      syncRuntimeScenarioDirectives(
        options.runtime,
        options.globalScenarioDirectiveLimits,
      )
      return true
    },
    startFreeRoam: () => {
      applyRuntimeScenarioTransition(
        createScenarioRuntimeTransition(
          'earth-moon',
          options.runtimeScenarioOptions,
        ),
      )
    },
    startTutorial: () => {
      applyRuntimeScenarioTransition(
        createScenarioRuntimeTransition(
          'tutorial',
          options.runtimeScenarioOptions,
        ),
      )
    },
  }
}

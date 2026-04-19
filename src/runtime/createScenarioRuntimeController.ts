import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  loadDebugRuntimeScenario,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import type { AppRuntimeState } from './appRuntimeState'
import {
  applyCheckpointRestoreTransition,
  applyScenarioLoadTransition,
} from './runtimeStateTransitions'
import { createRuntimeCheckpointRestoreTransition } from './scenarioRecovery'

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
  const loadScenarioById = (scenarioId: string) => {
    applyScenarioLoadTransition(
      options.runtime,
      createScenarioRuntimeTransition(
        scenarioId,
        options.runtimeScenarioOptions,
      ),
      {
        clearTransientScenarioState: options.clearTransientScenarioState,
        globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
      },
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

      applyScenarioLoadTransition(
        options.runtime,
        {
          coastPredictionHorizonHours:
            loadedDebugScenario.runtimeState.coastPredictionHorizonHours,
          scenario: {
            activeDescription: loadedDebugScenario.scenario.description,
            activeTitle: loadedDebugScenario.scenario.name,
            session: loadedDebugScenario.runtimeState.scenarioSession,
          },
          state: loadedDebugScenario.runtimeState.state,
          viewportSize: loadedDebugScenario.runtimeState.viewportSize,
        },
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
      options.runtime.assistTargetIndex = Math.min(
        options.runtime.assistTargetIndex,
        Math.max(0, options.runtime.state.bodies.length - 1),
      )
      options.runtime.debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`
      options.setTimeWarp(1)
      return true
    },
    resetScenario: () => {
      applyScenarioLoadTransition(
        options.runtime,
        createScenarioRuntimeTransition(
          options.runtime.scenario.session.scenarioId,
          options.runtimeScenarioOptions,
        ),
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
    },
    restartFromCheckpoint: () => {
      return applyCheckpointRestoreTransition(
        options.runtime,
        createRuntimeCheckpointRestoreTransition(options.runtime),
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
    },
    startFreeRoam: () => {
      applyScenarioLoadTransition(
        options.runtime,
        createScenarioRuntimeTransition(
          'earth-moon',
          options.runtimeScenarioOptions,
        ),
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
    },
    startTutorial: () => {
      applyScenarioLoadTransition(
        options.runtime,
        createScenarioRuntimeTransition(
          'tutorial',
          options.runtimeScenarioOptions,
        ),
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
    },
  }
}

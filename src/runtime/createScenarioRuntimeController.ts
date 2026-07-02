import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  loadDebugRuntimeScenario,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import type {
  CameraControlMode,
  GlobalScenarioDirectiveLimits,
} from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioRenderConfig } from '../scenario/scenarioRenderConfig'
import type {
  AppRuntimeScenarioSlice,
  AppRuntimeSimulationSlice,
  AppRuntimeState,
  RuntimeScenarioMetadata,
} from './appRuntimeState'
import {
  applyCheckpointRestoreTransition,
  applyScenarioLoadTransition,
} from './runtimeStateTransitions'
import { createRuntimeCheckpointRestoreTransition } from './scenarioRecovery'

export type ScenarioRuntimeTransition = {
  assistTargetIndex?: AppRuntimeSimulationSlice['assistTargetIndex']
  assistTargetSelectionMode?: AppRuntimeSimulationSlice['assistTargetSelectionMode']
  cameraMode: CameraControlMode
  coastPredictionHorizonHours: number
  scenario: Pick<
    AppRuntimeScenarioSlice,
    'metadata' | 'orbitPointDisplay' | 'render' | 'session'
  >
  state: AppRuntimeSimulationSlice['state']
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
    assistTargetIndex: runtimeScenarioState.assistTargetIndex,
    assistTargetSelectionMode: runtimeScenarioState.assistTargetSelectionMode,
    cameraMode: runtimeScenarioState.cameraMode,
    coastPredictionHorizonHours:
      runtimeScenarioState.coastPredictionHorizonHours,
    scenario: {
      metadata: {
        description: scenario.description,
        title: scenario.name,
      } satisfies RuntimeScenarioMetadata,
      orbitPointDisplay: scenario.orbitPointDisplay,
      render: resolveScenarioRenderConfig(scenario.render),
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
  startReachMoon(): void
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
      options.runtime.ui.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
      options.setTimeWarp(300)
    },
    initializeFromStartup: (startupOptions: {
      initialAppMode: 'menu' | 'game'
      requestedScenarioId: string
    }) => {
      loadScenarioById(resolveStartupScenarioId(startupOptions))
      if (startupOptions.initialAppMode !== 'menu') {
        return
      }

      options.runtime.ui.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
      options.setTimeWarp(300)
    },
    loadDebugSnapshot: () => {
      const loadedDebugScenario = loadDebugRuntimeScenario(
        options.runtimeScenarioOptions,
      )
      if (!loadedDebugScenario) {
        options.runtime.debug.debugSnapshotStatus = 'no debug snapshot saved'
        return false
      }

      applyScenarioLoadTransition(
        options.runtime,
        {
          assistTargetIndex: loadedDebugScenario.runtimeState.assistTargetIndex,
          assistTargetSelectionMode:
            loadedDebugScenario.runtimeState.assistTargetSelectionMode,
          coastPredictionHorizonHours:
            loadedDebugScenario.runtimeState.coastPredictionHorizonHours,
          cameraMode: loadedDebugScenario.runtimeState.cameraMode,
          scenario: {
            metadata: {
              description: loadedDebugScenario.scenario.description,
              title: loadedDebugScenario.scenario.name,
            },
            orbitPointDisplay: loadedDebugScenario.scenario.orbitPointDisplay,
            render: resolveScenarioRenderConfig(
              loadedDebugScenario.scenario.render,
            ),
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
      if (loadedDebugScenario.runtimeState.assistTargetIndex === undefined) {
        options.runtime.simulation.assistTargetIndex = Math.min(
          options.runtime.simulation.assistTargetIndex,
          Math.max(0, options.runtime.simulation.state.bodies.length - 1),
        )
      }
      options.runtime.debug.debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`
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
    startReachMoon: () => {
      loadScenarioById('reach-moon')
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

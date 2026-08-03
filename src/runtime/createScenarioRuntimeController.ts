import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  loadDebugRuntimeScenario,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import type {
  CameraFollowSubject,
  GlobalScenarioDirectiveLimits,
} from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioRenderConfig } from '../scenario/scenarioRenderConfig'
import { physicsEngines } from '../simulation/physics'
import type { PhysicsEngine } from '../simulation/types'
import type {
  AppRuntimeScenarioSlice,
  AppRuntimeSimulationSlice,
  AppRuntimeState,
  RuntimeScenarioMetadata,
} from './appRuntimeState'
import type { InfoPin } from './infoPins'
import {
  applyCheckpointRestoreTransition,
  applyScenarioLoadTransition,
} from './runtimeStateTransitions'
import { createRuntimeCheckpointRestoreTransition } from './scenarioRecovery'

export type ScenarioRuntimeTransition = {
  assistTargetIndex?: AppRuntimeSimulationSlice['assistTargetIndex']
  assistTargetSelectionMode?: AppRuntimeSimulationSlice['assistTargetSelectionMode']
  cameraFollow: CameraFollowSubject
  cameraPanOffset: { x: number; y: number }
  coastPredictionHorizonHours: number
  scenario: Pick<AppRuntimeScenarioSlice, 'metadata' | 'render' | 'session'>
  state: AppRuntimeSimulationSlice['state']
  userInfoPins: InfoPin[]
  viewportSize: number
}

export const resolveStartupScenarioId = (options: {
  initialAppMode: 'menu' | 'game'
  physicsEngine: PhysicsEngine
  requestedScenarioId: string
}) => {
  if (options.initialAppMode === 'game') {
    return options.requestedScenarioId
  }
  if (options.physicsEngine === physicsEngines.kepler) {
    return 'menu-background-kepler'
  }
  return 'menu-background'
}

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
    cameraFollow: runtimeScenarioState.cameraFollow,
    cameraPanOffset: runtimeScenarioState.cameraPanOffset,
    coastPredictionHorizonHours:
      runtimeScenarioState.coastPredictionHorizonHours,
    scenario: {
      metadata: {
        description: scenario.description,
        title: scenario.name,
      } satisfies RuntimeScenarioMetadata,
      render: resolveScenarioRenderConfig(scenario.render),
      session: runtimeScenarioState.scenarioSession,
    },
    state: runtimeScenarioState.state,
    userInfoPins: runtimeScenarioState.userInfoPins,
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
  physicsEngine: PhysicsEngine
  setTimeWarp: (warp: number) => void
  clearTransientScenarioState: () => void
}) => {
  const assertSupportedTransition = (transition: ScenarioRuntimeTransition) => {
    options.physicsEngine.validateState?.(transition.state)
    return transition
  }
  const createSupportedScenarioTransition = (scenarioId: string) =>
    assertSupportedTransition(
      createScenarioRuntimeTransition(
        scenarioId,
        options.runtimeScenarioOptions,
      ),
    )
  const loadScenarioById = (scenarioId: string) => {
    applyScenarioLoadTransition(
      options.runtime,
      createSupportedScenarioTransition(scenarioId),
      {
        clearTransientScenarioState: options.clearTransientScenarioState,
        globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
      },
    )
  }

  return {
    enterMainMenuBackground: () => {
      loadScenarioById(
        resolveStartupScenarioId({
          initialAppMode: 'menu',
          physicsEngine: options.physicsEngine,
          requestedScenarioId: 'menu-background',
        }),
      )
      options.runtime.ui.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY
      options.setTimeWarp(300)
    },
    initializeFromStartup: (startupOptions: {
      initialAppMode: 'menu' | 'game'
      requestedScenarioId: string
    }) => {
      loadScenarioById(
        resolveStartupScenarioId({
          ...startupOptions,
          physicsEngine: options.physicsEngine,
        }),
      )
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

      options.physicsEngine.validateState?.(
        loadedDebugScenario.runtimeState.state,
      )

      applyScenarioLoadTransition(
        options.runtime,
        {
          assistTargetIndex: loadedDebugScenario.runtimeState.assistTargetIndex,
          assistTargetSelectionMode:
            loadedDebugScenario.runtimeState.assistTargetSelectionMode,
          coastPredictionHorizonHours:
            loadedDebugScenario.runtimeState.coastPredictionHorizonHours,
          cameraFollow: loadedDebugScenario.runtimeState.cameraFollow,
          cameraPanOffset: loadedDebugScenario.runtimeState.cameraPanOffset,
          scenario: {
            metadata: {
              description: loadedDebugScenario.scenario.description,
              title: loadedDebugScenario.scenario.name,
            },
            render: resolveScenarioRenderConfig(
              loadedDebugScenario.scenario.render,
            ),
            session: loadedDebugScenario.runtimeState.scenarioSession,
          },
          state: loadedDebugScenario.runtimeState.state,
          userInfoPins: loadedDebugScenario.runtimeState.userInfoPins,
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
        createSupportedScenarioTransition(
          options.runtime.scenario.session.scenarioId,
        ),
        {
          clearTransientScenarioState: options.clearTransientScenarioState,
          globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
        },
      )
    },
    restartFromCheckpoint: () => {
      const transition = createRuntimeCheckpointRestoreTransition(
        options.runtime,
      )
      if (transition) {
        options.physicsEngine.validateState?.(transition.state)
      }
      return applyCheckpointRestoreTransition(options.runtime, transition, {
        clearTransientScenarioState: options.clearTransientScenarioState,
        globalScenarioDirectiveLimits: options.globalScenarioDirectiveLimits,
      })
    },
    startFreeRoam: () => {
      loadScenarioById('earth-moon')
    },
    startReachMoon: () => {
      loadScenarioById('reach-moon')
    },
    startTutorial: () => {
      loadScenarioById('tutorial')
    },
  }
}

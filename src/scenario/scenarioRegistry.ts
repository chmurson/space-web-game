import type { RuntimeScenario } from '../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../domain/viewportPresets'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { TrajectoryPredictionState } from '../runtime/trajectoryPredictionRuntime'
import {
  createEarthMoonScenario,
  createMoonCaptureDebugScenario,
} from '../simulation/scenarios/earthMoon'
import type {
  PromptActionEffect,
  PromptDefinition,
} from './scenarioPromptTypes'
import type {
  RuntimeScenarioDirectives,
  GlobalScenarioDirectiveLimits,
} from './scenarioDirectiveTypes'
import type { ScenarioRuntimeTransition } from './scenarioRuntimeTransition'
import type { ScenarioSessionValue } from './scenarioSession'
import { registerMenuBackgroundScenario } from './specific-scenarios/menuBackgroundScenario'
import { registerTutorialScenario } from './specific-scenarios/tutorial/tutorialScenario'

export type ScenarioPromptActionDispatchResult<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  effect?: PromptActionEffect
  handled: boolean
  transition?: ScenarioRuntimeTransition<TState> | null
}

export type ScenarioSceneContext<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  getTrajectoryPredictionForHorizonHours?: (
    horizonHours: number,
  ) => TrajectoryPredictionState
  trajectoryPrediction?: TrajectoryPredictionState
  runtime: AppRuntimeState
  state: TState
}

export type ScenarioSceneDefinition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
  TTransitionState extends ScenarioSessionValue = TState,
> = {
  actions?: Record<
    string,
    (
      context: ScenarioSceneContext<TState>,
    ) => ScenarioPromptActionDispatchResult<TTransitionState>
  >
  advance?: (
    context: ScenarioSceneContext<TState>,
  ) => ScenarioRuntimeTransition<TTransitionState> | null
  directives?: (context: {
    limits: GlobalScenarioDirectiveLimits
    state: TState
  }) => Partial<RuntimeScenarioDirectives>
}

export type RuntimeScenarioDefinition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  createScenario(): RuntimeScenario
  getSceneDefinition(state: TState): ScenarioSceneDefinition<TState>
  id: string
  isState?(value: unknown): value is TState
  prompts?: Record<string, PromptDefinition>
  shouldAutoRestartOnCrash?(runtime: AppRuntimeState): boolean
}

const earthMoonScenarioScene: ScenarioSceneDefinition = {
  directives: () => ({
    maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  }),
}

const runtimeScenarioDefinitions = {
  'earth-moon': {
    id: 'earth-moon',
    createScenario: createEarthMoonScenario,
    getSceneDefinition: () => earthMoonScenarioScene,
  },
  'moon-capture-debug': {
    id: 'moon-capture-debug',
    createScenario: createMoonCaptureDebugScenario,
    getSceneDefinition: () => earthMoonScenarioScene,
  },
  'menu-background': registerMenuBackgroundScenario(),
  tutorial: registerTutorialScenario(),
}

export const getRuntimeScenarioDefinition = (
  scenarioId: string,
): RuntimeScenarioDefinition | null =>
  (runtimeScenarioDefinitions[
    scenarioId as keyof typeof runtimeScenarioDefinitions
  ] as RuntimeScenarioDefinition | undefined) ?? null

export const shouldAutoRestartRuntimeScenarioOnCrash = (
  runtime: AppRuntimeState,
) => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  return definition?.shouldAutoRestartOnCrash?.(runtime) ?? false
}

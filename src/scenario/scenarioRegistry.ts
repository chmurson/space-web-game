import type { RuntimeScenario } from '../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../domain/viewportPresets'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
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

export type RuntimeScenarioDefinition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  advance?(runtime: AppRuntimeState): ScenarioRuntimeTransition<TState> | null
  createScenario(): RuntimeScenario
  getDirectiveOverrides?(
    state: TState,
    limits: GlobalScenarioDirectiveLimits,
  ): Partial<RuntimeScenarioDirectives>
  handleScenarioPromptAction?(
    runtime: AppRuntimeState,
    actionId: string,
  ): ScenarioPromptActionDispatchResult<TState>
  id: string
  isState?(value: unknown): value is TState
  prompts?: Record<string, PromptDefinition>
  shouldAutoRestartOnCrash?(runtime: AppRuntimeState): boolean
}

const runtimeScenarioDefinitions = {
  'earth-moon': {
    id: 'earth-moon',
    createScenario: createEarthMoonScenario,
    getDirectiveOverrides: () => ({
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }),
  },
  'moon-capture-debug': {
    id: 'moon-capture-debug',
    createScenario: createMoonCaptureDebugScenario,
    getDirectiveOverrides: () => ({
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }),
  },
  'menu-background': registerMenuBackgroundScenario(),
  tutorial: registerTutorialScenario(),
} satisfies Record<string, RuntimeScenarioDefinition>

export const getRuntimeScenarioDefinition = (
  scenarioId: string,
): RuntimeScenarioDefinition | null =>
  runtimeScenarioDefinitions[
    scenarioId as keyof typeof runtimeScenarioDefinitions
  ] ?? null

export const shouldAutoRestartRuntimeScenarioOnCrash = (
  runtime: AppRuntimeState,
) => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  return definition?.shouldAutoRestartOnCrash?.(runtime) ?? false
}

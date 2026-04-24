import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { ScenarioSessionValue } from './scenarioSession'
import {
  getRuntimeScenarioDefinition,
  type RuntimeScenarioDefinition,
  type ScenarioSceneDefinition,
} from './scenarioRegistry'

export type ResolvedRuntimeScenarioScene<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  definition: RuntimeScenarioDefinition<TState>
  scene: ScenarioSceneDefinition<TState>
  state: TState
}

export const resolveCurrentScenarioScene = (
  runtime: AppRuntimeState,
): ResolvedRuntimeScenarioScene | null => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  if (!definition) {
    return null
  }

  const state = runtime.scenario.session.state
  if (definition.isState && !definition.isState(state)) {
    return null
  }

  return {
    definition,
    scene: definition.getSceneDefinition(state),
    state,
  }
}

import type {
  RuntimeScenarioCheckpoint,
  ScenarioSessionValue,
} from './scenarioSession'

export type ScenarioRuntimeTransition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  checkpoint?: RuntimeScenarioCheckpoint | null
  completed?: boolean
  nextState?: TState
}

import type {
  RuntimeScenarioCheckpoint,
  ScenarioPromptUiState,
  ScenarioSessionValue,
} from './scenarioSession'

export type ScenarioRuntimeTransition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  checkpoint?: RuntimeScenarioCheckpoint | null
  completed?: boolean
  nextState?: TState
  promptUi?: ScenarioPromptUiState
}

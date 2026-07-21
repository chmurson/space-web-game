import type { AssistMode } from '../assist/orbitalAssist'
import { cloneSimulationState } from '../simulation/state'
import type { SimulationState, TargetHeadingTurn } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { CameraFollowSubject } from './scenarioDirectiveTypes'

type LegacyCameraControlMode = 'centered' | 'target' | 'unlocked'

export type ScenarioSessionValue =
  | null
  | boolean
  | number
  | string
  | { [key: string]: ScenarioSessionValue }
  | ScenarioSessionValue[]

export type RuntimeScenarioCheckpoint = {
  assistMode: AssistMode
  assistTargetIndex: number
  cameraFollow?: CameraFollowSubject
  cameraMode?: LegacyCameraControlMode
  cameraPanOffset?: Vec2
  cameraView?: 'free' | 'locked'
  coastPredictionHorizonHours: number
  targetHeading: number | null
  targetHeadingTurn?: TargetHeadingTurn | null
  viewportSize: number
  world: SimulationState
}

export type ScenarioPromptUiState = {
  activePromptId: string | null
  replayPromptId: string | null
}

export type RuntimeScenarioSession<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  checkpoint: RuntimeScenarioCheckpoint | null
  completed: boolean
  promptUi: ScenarioPromptUiState
  scenarioId: string
  state: TState
}

export type RuntimeScenarioCheckpointSource = {
  assistMode: AssistMode
  assistTargetIndex: number
  cameraFollow?: CameraFollowSubject
  cameraPanOffset?: Vec2
  coastPredictionHorizonHours: number
  targetHeading: number | null
  targetHeadingTurn?: TargetHeadingTurn | null
  viewportSize: number
  world: SimulationState
}

export const createRuntimeScenarioSession = <
  TState extends ScenarioSessionValue = ScenarioSessionValue,
>(
  scenarioId: string,
  state: TState = null as TState,
  promptUi: ScenarioPromptUiState = {
    activePromptId: null,
    replayPromptId: null,
  },
): RuntimeScenarioSession<TState> => ({
  checkpoint: null,
  completed: false,
  promptUi: { ...promptUi },
  scenarioId,
  state,
})

const cloneScenarioSessionValue = <TValue extends ScenarioSessionValue>(
  value: TValue,
): TValue => structuredClone(value)

export const cloneRuntimeScenarioSession = <
  TState extends ScenarioSessionValue,
>(
  session: RuntimeScenarioSession<TState>,
): RuntimeScenarioSession<TState> => ({
  checkpoint: session.checkpoint
    ? {
        ...session.checkpoint,
        cameraPanOffset: session.checkpoint.cameraPanOffset
          ? { ...session.checkpoint.cameraPanOffset }
          : undefined,
        targetHeadingTurn: session.checkpoint.targetHeadingTurn
          ? { ...session.checkpoint.targetHeadingTurn }
          : null,
        world: cloneSimulationState(session.checkpoint.world),
      }
    : null,
  completed: session.completed,
  promptUi: { ...session.promptUi },
  scenarioId: session.scenarioId,
  state: cloneScenarioSessionValue(session.state),
})

export const createRuntimeScenarioCheckpoint = (
  source: RuntimeScenarioCheckpointSource,
): RuntimeScenarioCheckpoint => {
  const checkpoint: RuntimeScenarioCheckpoint = {
    assistMode: source.assistMode,
    assistTargetIndex: source.assistTargetIndex,
    coastPredictionHorizonHours: source.coastPredictionHorizonHours,
    targetHeading: source.targetHeading,
    targetHeadingTurn: source.targetHeadingTurn
      ? { ...source.targetHeadingTurn }
      : null,
    viewportSize: source.viewportSize,
    world: cloneSimulationState(source.world),
  }

  if (source.cameraFollow !== undefined) {
    checkpoint.cameraFollow = source.cameraFollow
  }
  if (source.cameraPanOffset !== undefined) {
    checkpoint.cameraPanOffset = { ...source.cameraPanOffset }
  }
  return checkpoint
}

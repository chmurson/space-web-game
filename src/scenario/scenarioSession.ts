import type { AssistMode } from "../assist/orbitalAssist";
import { cloneSimulationState } from "../simulation/state";
import type { SimulationState } from "../simulation/types";

export type ScenarioSessionValue =
	| null
	| boolean
	| number
	| string
	| { [key: string]: ScenarioSessionValue }
	| ScenarioSessionValue[];

export type RuntimeScenarioCheckpoint = {
	assistMode: AssistMode;
	assistTargetIndex: number;
	coastPredictionHorizonHours: number;
	targetHeading: number | null;
	viewportSize: number;
	world: SimulationState;
};

export type RuntimeScenarioSession<
	TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
	checkpoint: RuntimeScenarioCheckpoint | null;
	completed: boolean;
	scenarioId: string;
	state: TState;
};

export type RuntimeScenarioCheckpointSource = {
	assistMode: AssistMode;
	assistTargetIndex: number;
	coastPredictionHorizonHours: number;
	targetHeading: number | null;
	viewportSize: number;
	world: SimulationState;
};

export const createRuntimeScenarioSession = <
	TState extends ScenarioSessionValue = ScenarioSessionValue,
>(
	scenarioId: string,
	state: TState = null as TState,
): RuntimeScenarioSession<TState> => ({
	checkpoint: null,
	completed: false,
	scenarioId,
	state,
});

const cloneScenarioSessionValue = <TValue extends ScenarioSessionValue>(
	value: TValue,
): TValue => structuredClone(value);

export const cloneRuntimeScenarioSession = <
	TState extends ScenarioSessionValue,
>(
	session: RuntimeScenarioSession<TState>,
): RuntimeScenarioSession<TState> => ({
	checkpoint: session.checkpoint
		? {
				...session.checkpoint,
				world: cloneSimulationState(session.checkpoint.world),
			}
		: null,
	completed: session.completed,
	scenarioId: session.scenarioId,
	state: cloneScenarioSessionValue(session.state),
});

export const createRuntimeScenarioCheckpoint = (
	source: RuntimeScenarioCheckpointSource,
): RuntimeScenarioCheckpoint => ({
	assistMode: source.assistMode,
	assistTargetIndex: source.assistTargetIndex,
	coastPredictionHorizonHours: source.coastPredictionHorizonHours,
	targetHeading: source.targetHeading,
	viewportSize: source.viewportSize,
	world: cloneSimulationState(source.world),
});

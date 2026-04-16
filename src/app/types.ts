import type { GameMediator } from "./gameHighLevelActionDispatcher";

export type GameHighLevelActions = {
	startFreeRoam: () => void;
	loadLastGame: () => void;
	startTutorial: () => void;
	confirmPrompt: (payload?: { actionToTrigger?: string }) => void;
};

export const createGameHighLevelActions = (
	mediator: GameMediator,
): GameHighLevelActions => ({
	startFreeRoam: () => {
		mediator.dispatch({
			type: "startFreeRoam",
			payload: { difficulty: "medium" },
		});
	},
	loadLastGame: () => {
		mediator.dispatch({ type: "loadLastGame" });
	},
	startTutorial: () => {
		mediator.dispatch({
			type: "startTutorial",
			payload: { scenarioId: "tutorial" },
		});
	},
	confirmPrompt: (payload) => {
		mediator.dispatch({ type: "confirmPrompt", payload });
	},
});

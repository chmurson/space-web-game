export type GameHighLevelActionType =
	| "startFreeRoam"
	| "loadLastGame"
	| "startTutorial"
	| "confirmPrompt";

export type GameHighLevelActionPayloads = {
	startFreeRoam: { difficulty: "easy" | "medium" | "hard" };
	loadLastGame: undefined;
	startTutorial: { scenarioId: string };
	confirmPrompt: { actionToTrigger?: string };
};

export type GameHighLevelAction<T extends GameHighLevelActionType = GameHighLevelActionType> = {
	type: T;
	payload?: GameHighLevelActionPayloads[T];
};

export class GameMediator {
	private actionHandlers = new Map<
		GameHighLevelActionType,
		(payload: unknown) => void
	>();

	registerAction<T extends GameHighLevelActionType>(
		type: T,
		handler: (payload: GameHighLevelActionPayloads[T]) => void
	) {
		this.actionHandlers.set(type, handler as (payload: unknown) => void);
	}

	dispatch<T extends GameHighLevelActionType>(action: GameHighLevelAction<T>): void {
		const handler = this.actionHandlers.get(action.type);
		if (handler) {
			handler(action.payload as GameHighLevelActionPayloads[T]);
		}
	}
}

export const gameMediator = new GameMediator();

export type GameHighLevelActionType =
  | 'startFreeRoam'
  | 'loadLastGame'
  | 'startTutorial'
  | 'confirmPrompt'
  | 'enterMainMenu'
  | 'restartScenario'
  | 'restartFromCheckpoint'

export type GameHighLevelActionPayloads = {
  startFreeRoam: undefined
  loadLastGame: { fromMenu: 'crashMenu' | 'mainMenu' }
  startTutorial: { scenarioId: string }
  confirmPrompt: { actionToTrigger?: string }
  enterMainMenu: undefined
  restartScenario: undefined
  restartFromCheckpoint: undefined
}

export type GameHighLevelAction<
  T extends GameHighLevelActionType = GameHighLevelActionType,
> = T extends GameHighLevelActionType
  ? GameHighLevelActionPayloads[T] extends undefined
    ? { type: T }
    : { type: T; payload: GameHighLevelActionPayloads[T] }
  : never

export class GameHighLevelActionsMediator {
  private actionHandlers = new Map<
    GameHighLevelActionType,
    (payload: unknown) => void
  >()

  registerAction<T extends GameHighLevelActionType>(
    type: T,
    handler: (payload: GameHighLevelActionPayloads[T]) => void,
  ) {
    this.actionHandlers.set(type, handler as (payload: unknown) => void)
  }

  dispatch(action: GameHighLevelAction): void {
    const handler = this.actionHandlers.get(action.type)
    if (!handler) {
      return
    }

    if ('payload' in action) {
      handler(action.payload)
      return
    }

    handler(undefined)
  }
}

export const gameMediator = new GameHighLevelActionsMediator()

export type GameHighLevelActionType =
  | 'startFreeRoam'
  | 'startReachMoon'
  | 'loadLastGame'
  | 'startTutorial'
  | 'confirmPrompt'
  | 'enterMainMenu'
  | 'showReachMoonHighscores'
  | 'restartScenario'
  | 'restartFromCheckpoint'

export type GameHighLevelActionPayloads = {
  startFreeRoam: undefined
  startReachMoon: undefined
  loadLastGame: { fromMenu: 'crashMenu' | 'mainMenu' }
  startTutorial: { scenarioId: string }
  confirmPrompt: { actionToTrigger?: string }
  enterMainMenu: undefined
  showReachMoonHighscores: undefined
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
    (payload: unknown) => Promise<void> | void
  >()

  registerAction<T extends GameHighLevelActionType>(
    type: T,
    handler: (payload: GameHighLevelActionPayloads[T]) => Promise<void> | void,
  ) {
    this.actionHandlers.set(
      type,
      handler as (payload: unknown) => Promise<void> | void,
    )
  }

  dispatch(action: GameHighLevelAction): void {
    const handler = this.actionHandlers.get(action.type)
    if (!handler) {
      return
    }

    try {
      const result =
        'payload' in action ? handler(action.payload) : handler(undefined)
      void Promise.resolve(result).catch((error) => {
        console.error(error)
      })
    } catch (error) {
      console.error(error)
    }
  }
}

export const gameMediator = new GameHighLevelActionsMediator()

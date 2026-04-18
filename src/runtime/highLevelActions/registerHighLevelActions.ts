import type { KeyboardInput } from '../../input/keyboardInput'
import type { createCrashMenu } from '../../ui/createCrashMenu'
import type { createMainMenu } from '../../ui/createMainMenu'
import type { createTopMenu } from '../../ui/createTopMenu'
import type { AppRuntimeState } from '../appRuntimeState'
import type { createFrameLoop } from '../frameLoop'
import type { createRuntimeActions } from '../runtimeActions'
import type { GameHighLevelActionsMediator } from './gameHighLevelActionDispatcher'

export const registerHighLevelActions = ({
  gameMediator,
  keyboardInput,
  app,
  setAppMode,
  frameLoop,
  runtimeActions,
  mainMenu,
  crashMenu,
  topMenu,
  runtime,
}: {
  gameMediator: GameHighLevelActionsMediator
  keyboardInput: KeyboardInput
  app: HTMLElement
  setAppMode: (appMode: 'menu' | 'game') => void
  frameLoop: ReturnType<typeof createFrameLoop>
  runtimeActions: ReturnType<typeof createRuntimeActions>
  mainMenu: ReturnType<typeof createMainMenu>
  crashMenu: ReturnType<typeof createCrashMenu>
  topMenu: ReturnType<typeof createTopMenu>
  runtime: AppRuntimeState
}) => {
  // Register action handlers with the mediator
  gameMediator.registerAction('startFreeRoam', () => {
    keyboardInput.clear()
    runtimeActions.startFreeRoam()
    setAppMode('game')
    app.classList.remove('app-main-menu')
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('loadLastGame', (payload) => {
    const { fromMenu } = payload
    keyboardInput.clear()
    const loaded = runtimeActions.loadDebugSnapshot()
    if (!loaded) {
      if (fromMenu === 'crashMenu') {
        crashMenu.syncState({
          hasCheckpoint: runtime.scenario.session.checkpoint !== null,
        })
      } else if (fromMenu === 'mainMenu') {
        mainMenu.syncState()
      }
      return
    }
    setAppMode('game')
    app.classList.remove('app-main-menu')
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('startTutorial', () => {
    keyboardInput.clear()
    runtimeActions.startTutorial()
    setAppMode('game')
    app.classList.remove('app-main-menu')
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('confirmPrompt', (payload) => {
    const actionToTrigger = payload?.actionToTrigger
    if (actionToTrigger === 'exit-to-menu') {
      // enterMainMenu()
      gameMediator.dispatch({ type: 'enterMainMenu' })
    } else if (actionToTrigger === 'start-free-roam') {
      gameMediator.dispatch({ type: 'startFreeRoam' })
    }
  })

  gameMediator.registerAction('enterMainMenu', () => {
    keyboardInput.clear()
    runtimeActions.enterMainMenuBackground()
    setAppMode('menu')
    app.classList.add('app-main-menu')
    crashMenu?.setVisible(false)
    mainMenu.syncState()
    mainMenu.setVisible(true)
    topMenu?.close()
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('restartScenario', () => {
    keyboardInput.clear()
    runtimeActions.resetScenario()
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('restartFromCheckpoint', () => {
    keyboardInput.clear()
    if (runtimeActions.restartFromCheckpoint()) {
      frameLoop?.refreshTrajectoryPrediction()
    }
  })
}

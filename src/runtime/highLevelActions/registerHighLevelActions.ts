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
  prepareScenarioTransition,
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
  prepareScenarioTransition(options: {
    applyTransition(): boolean
    label: string
    scenarioId: string
  }): Promise<boolean>
}) => {
  const enterGameAfterTransition = () => {
    setAppMode('game')
    app.classList.remove('app-main-menu')
    frameLoop?.refreshTrajectoryPrediction()
  }

  gameMediator.registerAction('startFreeRoam', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.startFreeRoam()
        return true
      },
      label: 'Loading free roam',
      scenarioId: 'earth-moon',
    })
    if (loaded) {
      enterGameAfterTransition()
    }
  })

  gameMediator.registerAction('startReachMoon', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.startReachMoon()
        return true
      },
      label: 'Loading Reach the Moon',
      scenarioId: 'reach-moon',
    })
    if (loaded) {
      enterGameAfterTransition()
    }
  })

  gameMediator.registerAction('loadLastGame', async (payload) => {
    const { fromMenu } = payload
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: runtimeActions.loadDebugSnapshot,
      label: 'Loading saved scenario',
      scenarioId: 'debug-snapshot',
    })
    if (!loaded) {
      if (fromMenu === 'crashMenu') {
        crashMenu.syncState({
          hasCheckpoint: runtime.scenario.session.checkpoint !== null,
        })
      } else if (fromMenu === 'mainMenu') {
        mainMenu.syncState()
        mainMenu.setVisible(true)
      }
      return
    }
    enterGameAfterTransition()
  })

  gameMediator.registerAction('startTutorial', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.startTutorial()
        return true
      },
      label: 'Loading tutorial',
      scenarioId: 'tutorial',
    })
    if (loaded) {
      enterGameAfterTransition()
    }
  })

  gameMediator.registerAction('confirmPrompt', (payload) => {
    const actionToTrigger = payload?.actionToTrigger
    if (actionToTrigger === 'exit-to-menu') {
      gameMediator.dispatch({ type: 'enterMainMenu' })
    } else if (actionToTrigger === 'start-free-roam') {
      gameMediator.dispatch({ type: 'startFreeRoam' })
    }
  })

  gameMediator.registerAction('enterMainMenu', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.enterMainMenuBackground()
        return true
      },
      label: 'Returning to menu',
      scenarioId: 'menu-background',
    })
    if (!loaded) {
      return
    }
    setAppMode('menu')
    app.classList.add('app-main-menu')
    crashMenu?.setVisible(false)
    mainMenu.syncState()
    mainMenu.setVisible(true)
    topMenu?.close()
    frameLoop?.refreshTrajectoryPrediction()
  })

  gameMediator.registerAction('restartScenario', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.resetScenario()
        return true
      },
      label: 'Restarting scenario',
      scenarioId: runtime.scenario.session.scenarioId,
    })
    if (loaded) {
      frameLoop?.refreshTrajectoryPrediction()
    }
  })

  gameMediator.registerAction('restartFromCheckpoint', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: runtimeActions.restartFromCheckpoint,
      label: 'Loading checkpoint',
      scenarioId: runtime.scenario.session.scenarioId,
    })
    if (loaded) {
      frameLoop?.refreshTrajectoryPrediction()
    }
  })
}

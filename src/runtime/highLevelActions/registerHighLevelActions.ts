import type { KeyboardInput } from '../../input/keyboardInput'
import { getReachMoonCompletedHighscorePayload } from '../../scenario/specific-scenarios/reachMoonScenario'
import type { ReachMoonRunReceipt } from '../../server/reachMoonRunReceipts'
import type { createCrashMenu } from '../../ui/createCrashMenu'
import type { createMainMenu } from '../../ui/createMainMenu'
import type { ReachMoonHighscorePendingRun } from '../../ui/components/MainMenuSurface'
import type { createTopMenu } from '../../ui/createTopMenu'
import type { AppRuntimeState } from '../appRuntimeState'
import type { createFrameLoop } from '../frameLoop'
import type { createRuntimeActions } from '../runtimeActions'
import type { GameHighLevelActionsMediator } from './gameHighLevelActionDispatcher'
import {
  requestReachMoonRunReceipt as defaultRequestReachMoonRunReceipt,
  type ReachMoonRunReceiptRequester,
} from './reachMoonRunReceiptRequest'

type ReachMoonRunReceiptResult = Pick<
  ReachMoonHighscorePendingRun,
  'runReceipt' | 'runReceiptError'
>

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
  requestReachMoonRunReceipt = defaultRequestReachMoonRunReceipt,
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
  requestReachMoonRunReceipt?: ReachMoonRunReceiptRequester
  prepareScenarioTransition(options: {
    applyTransition(): boolean
    label: string
    scenarioId: string
  }): Promise<boolean>
}) => {
  let reachMoonRunReceiptRequest: Promise<ReachMoonRunReceiptResult> | null =
    null

  const toReceiptError = (error: unknown): string =>
    error instanceof Error ? error.message : 'Run receipt request failed.'

  const requestReachMoonReceipt = () => {
    reachMoonRunReceiptRequest = Promise.resolve()
      .then(requestReachMoonRunReceipt)
      .then(
        (runReceipt: ReachMoonRunReceipt): ReachMoonRunReceiptResult => ({
          runReceipt,
          runReceiptError: null,
        }),
      )
      .catch(
        (error: unknown): ReachMoonRunReceiptResult => ({
          runReceipt: null,
          runReceiptError: toReceiptError(error),
        }),
      )
  }

  const clearReachMoonReceipt = () => {
    reachMoonRunReceiptRequest = null
  }

  const getReachMoonReceiptResult =
    async (): Promise<ReachMoonRunReceiptResult> =>
      reachMoonRunReceiptRequest ?? {
        runReceipt: null,
        runReceiptError: 'Run receipt was not requested.',
      }

  const enterGameAfterTransition = () => {
    setAppMode('game')
    app.classList.remove('app-main-menu')
    frameLoop?.refreshTrajectoryPrediction()
  }

  const enterMenuAfterTransition = (showMenu: () => void) => {
    setAppMode('menu')
    app.classList.add('app-main-menu')
    crashMenu?.setVisible(false)
    mainMenu.syncState()
    showMenu()
    topMenu?.close()
    frameLoop?.refreshTrajectoryPrediction()
  }

  gameMediator.registerAction('startFreeRoam', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.startFreeRoam()
        clearReachMoonReceipt()
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
        requestReachMoonReceipt()
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
    if (loaded) {
      clearReachMoonReceipt()
    }
    if (!loaded) {
      if (fromMenu === 'crashMenu') {
        crashMenu.syncState({
          crashedBodyName: runtime.simulation.crashedBodyName,
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
        clearReachMoonReceipt()
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
    } else if (actionToTrigger === 'show-reach-moon-highscores') {
      gameMediator.dispatch({ type: 'showReachMoonHighscores' })
    }
  })

  gameMediator.registerAction('enterMainMenu', async () => {
    keyboardInput.clear()
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.enterMainMenuBackground()
        clearReachMoonReceipt()
        return true
      },
      label: 'Returning to menu',
      scenarioId: 'menu-background',
    })
    if (!loaded) {
      return
    }
    enterMenuAfterTransition(() => {
      mainMenu.setVisible(true)
    })
  })

  gameMediator.registerAction('showReachMoonHighscores', async () => {
    keyboardInput.clear()
    const completedRun = getReachMoonCompletedHighscorePayload(runtime)
    const receiptResult = completedRun
      ? await getReachMoonReceiptResult()
      : null
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.enterMainMenuBackground()
        return true
      },
      label: 'Opening highscores',
      scenarioId: 'menu-background',
    })
    if (!loaded) {
      return
    }
    enterMenuAfterTransition(() => {
      mainMenu.showReachMoonHighscores(
        completedRun && receiptResult
          ? {
              ...completedRun,
              ...receiptResult,
            }
          : undefined,
      )
    })
  })

  gameMediator.registerAction('restartScenario', async () => {
    keyboardInput.clear()
    const scenarioId = runtime.scenario.session.scenarioId
    const loaded = await prepareScenarioTransition({
      applyTransition: () => {
        runtimeActions.resetScenario()
        if (scenarioId === 'reach-moon') {
          requestReachMoonReceipt()
        } else {
          clearReachMoonReceipt()
        }
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

import { describe, expect, it, vi } from 'vitest'

import { GameHighLevelActionsMediator } from '@/runtime/highLevelActions/gameHighLevelActionDispatcher'
import { registerHighLevelActions } from '@/runtime/highLevelActions/registerHighLevelActions'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'

const createRuntime = () => ({
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 0,
    assistTargetSelectionMode: 'manual',
    coastPredictionHorizonHours: 1,
    crashedBodyName: null,
    state: {
      elapsed: 0,
      bodies: [],
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
      spacecraft: {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        heading: 0,
        fuel: 1,
        fuelCapacity: 0,
        fuelMass: 0,
        fuelUsed: 0,
        dryMass: 1,
      },
    },
    targetHeading: null,
    targetHeadingTurn: null,
    timeWarpIndex: 0,
    viewportSize: 100,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Reach the Moon description',
      title: 'Reach the Moon',
    },
    session: createRuntimeScenarioSession('reach-moon', {
      phase: 'complete',
    }),
  },
  ui: {
    camera: { mode: 'centered', panOffset: { x: 0, y: 0 } },
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
  },
})

describe('registerHighLevelActions', () => {
  it('opens Reach the Moon highscores through the menu background route', async () => {
    const gameMediator = new GameHighLevelActionsMediator()
    const app = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    }
    const keyboardInput = { clear: vi.fn() }
    const frameLoop = { refreshTrajectoryPrediction: vi.fn() }
    const mainMenu = {
      setVisible: vi.fn(),
      showReachMoonHighscores: vi.fn(),
      syncState: vi.fn(),
    }
    const crashMenu = { setVisible: vi.fn() }
    const topMenu = { close: vi.fn() }
    const runtimeActions = {
      enterMainMenuBackground: vi.fn(),
    }
    const setAppMode = vi.fn()
    const prepareScenarioTransition = vi.fn(
      async (options: { applyTransition(): boolean }) => {
        options.applyTransition()
        return true
      },
    )

    registerHighLevelActions({
      app: app as unknown as HTMLElement,
      crashMenu: crashMenu as never,
      frameLoop: frameLoop as never,
      gameMediator,
      keyboardInput: keyboardInput as never,
      mainMenu: mainMenu as never,
      prepareScenarioTransition,
      runtime: createRuntime() as never,
      runtimeActions: runtimeActions as never,
      setAppMode,
      topMenu: topMenu as never,
    })

    gameMediator.dispatch({ type: 'showReachMoonHighscores' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(keyboardInput.clear).toHaveBeenCalledOnce()
    expect(prepareScenarioTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Opening highscores',
        scenarioId: 'menu-background',
      }),
    )
    expect(runtimeActions.enterMainMenuBackground).toHaveBeenCalledOnce()
    expect(setAppMode).toHaveBeenCalledWith('menu')
    expect(app.classList.add).toHaveBeenCalledWith('app-main-menu')
    expect(mainMenu.syncState).toHaveBeenCalledOnce()
    expect(mainMenu.showReachMoonHighscores).toHaveBeenCalledOnce()
    expect(mainMenu.setVisible).not.toHaveBeenCalled()
    expect(crashMenu.setVisible).toHaveBeenCalledWith(false)
    expect(topMenu.close).toHaveBeenCalledOnce()
    expect(frameLoop.refreshTrajectoryPrediction).toHaveBeenCalledOnce()
  })
})

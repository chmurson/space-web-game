import { describe, expect, it, vi } from 'vitest'

import { GameHighLevelActionsMediator } from '@/runtime/highLevelActions/gameHighLevelActionDispatcher'
import { registerHighLevelActions } from '@/runtime/highLevelActions/registerHighLevelActions'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import {
  createRuntimeScenarioSession,
  type ScenarioSessionValue,
} from '@/scenario/scenarioSession'
import type { ReachMoonRunReceipt } from '@/server/reachMoonRunReceipts'

const completedScore = {
  baseScorePoints: 0,
  fuelBonusPoints: 121.5,
  fuelRemainingKg: 16_000,
  missionElapsedSeconds: 90_000,
  timePenaltyPoints: 49.7,
  totalScore: 171.2,
}

const completedHighscore = {
  input: {
    fuelRemainingRatio: 0.5,
    missionElapsedSeconds: 90_000,
  },
  score: completedScore,
}

const runReceipt: ReachMoonRunReceipt = {
  issuedAt: '2026-06-29T07:00:00.000Z',
  runId: 'run-116',
  scenarioId: 'reach-moon',
  signature: 'signature',
}

const flushActions = () => new Promise((resolve) => setTimeout(resolve, 0))

const createRuntime = (
  scenarioState: ScenarioSessionValue = { phase: 'reach-moon' },
) => ({
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
    session: createRuntimeScenarioSession('reach-moon', scenarioState),
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

const createHarness = (
  options: {
    requestReachMoonRunReceipt?: () => Promise<ReachMoonRunReceipt>
    runtime?: ReturnType<typeof createRuntime>
  } = {},
) => {
  const gameMediator = new GameHighLevelActionsMediator()
  const order: string[] = []
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
    showReachMoonHighscores: vi.fn(() => {
      order.push('show-highscores')
    }),
    syncState: vi.fn(),
  }
  const crashMenu = { setVisible: vi.fn(), syncState: vi.fn() }
  const topMenu = { close: vi.fn() }
  const runtime = options.runtime ?? createRuntime()
  const runtimeActions = {
    enterMainMenuBackground: vi.fn(() => {
      order.push('menu-background')
      runtime.scenario.session = createRuntimeScenarioSession('menu-background')
    }),
    startReachMoon: vi.fn(),
  }
  const setAppMode = vi.fn()
  const prepareScenarioTransition = vi.fn(
    async (transitionOptions: { applyTransition(): boolean }) => {
      transitionOptions.applyTransition()
      return true
    },
  )
  const requestReachMoonRunReceipt =
    options.requestReachMoonRunReceipt ?? vi.fn(async () => runReceipt)

  registerHighLevelActions({
    app: app as unknown as HTMLElement,
    crashMenu: crashMenu as never,
    frameLoop: frameLoop as never,
    gameMediator,
    keyboardInput: keyboardInput as never,
    mainMenu: mainMenu as never,
    prepareScenarioTransition,
    requestReachMoonRunReceipt,
    runtime: runtime as never,
    runtimeActions: runtimeActions as never,
    setAppMode,
    topMenu: topMenu as never,
  })

  return {
    app,
    crashMenu,
    frameLoop,
    gameMediator,
    keyboardInput,
    mainMenu,
    order,
    prepareScenarioTransition,
    requestReachMoonRunReceipt,
    runtime,
    runtimeActions,
    setAppMode,
    topMenu,
  }
}

describe('registerHighLevelActions', () => {
  it('opens completion highscores with the completed run after the menu background transition', async () => {
    const harness = createHarness()

    harness.gameMediator.dispatch({ type: 'startReachMoon' })
    await flushActions()
    harness.runtime.scenario.session = createRuntimeScenarioSession(
      'reach-moon',
      {
        phase: 'complete',
        highscore: completedHighscore,
        score: completedScore,
      },
    )

    harness.gameMediator.dispatch({ type: 'showReachMoonHighscores' })
    await flushActions()

    expect(harness.requestReachMoonRunReceipt).toHaveBeenCalledOnce()
    expect(harness.prepareScenarioTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Opening highscores',
        scenarioId: 'menu-background',
      }),
    )
    expect(
      harness.runtimeActions.enterMainMenuBackground,
    ).toHaveBeenCalledOnce()
    expect(harness.order).toEqual(['menu-background', 'show-highscores'])
    expect(harness.setAppMode).toHaveBeenCalledWith('menu')
    expect(harness.app.classList.add).toHaveBeenCalledWith('app-main-menu')
    expect(harness.mainMenu.syncState).toHaveBeenCalled()
    expect(harness.mainMenu.showReachMoonHighscores).toHaveBeenCalledWith({
      ...completedHighscore,
      runReceipt,
      runReceiptError: null,
    })
    expect(harness.mainMenu.setVisible).not.toHaveBeenCalled()
    expect(harness.crashMenu.setVisible).toHaveBeenCalledWith(false)
    expect(harness.topMenu.close).toHaveBeenCalled()
    expect(harness.frameLoop.refreshTrajectoryPrediction).toHaveBeenCalled()
  })

  it('opens menu highscores without pending-run state when no run is complete', async () => {
    const harness = createHarness()

    harness.gameMediator.dispatch({ type: 'showReachMoonHighscores' })
    await flushActions()

    expect(harness.requestReachMoonRunReceipt).not.toHaveBeenCalled()
    expect(harness.mainMenu.showReachMoonHighscores).toHaveBeenCalledWith(
      undefined,
    )
  })

  it('starts Reach the Moon even when the receipt request fails', async () => {
    const requestReachMoonRunReceipt = vi.fn(async () => {
      throw new Error('receipt service unavailable')
    })
    const harness = createHarness({ requestReachMoonRunReceipt })

    harness.gameMediator.dispatch({ type: 'startReachMoon' })
    await flushActions()

    expect(requestReachMoonRunReceipt).toHaveBeenCalledOnce()
    expect(harness.runtimeActions.startReachMoon).toHaveBeenCalledOnce()
    expect(harness.setAppMode).toHaveBeenCalledWith('game')
    expect(harness.app.classList.remove).toHaveBeenCalledWith('app-main-menu')

    harness.runtime.scenario.session = createRuntimeScenarioSession(
      'reach-moon',
      {
        phase: 'complete',
        highscore: completedHighscore,
        score: completedScore,
      },
    )
    harness.gameMediator.dispatch({ type: 'showReachMoonHighscores' })
    await flushActions()

    expect(harness.mainMenu.showReachMoonHighscores).toHaveBeenCalledWith({
      ...completedHighscore,
      runReceipt: null,
      runReceiptError: 'receipt service unavailable',
    })
  })
})

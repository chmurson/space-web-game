import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../domain/viewportPresets'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
} from '../scenario/scenarioSession'
import type { AppRuntimeState } from './appRuntimeState'
import { GameHighLevelActionsMediator } from './highLevelActions/gameHighLevelActionDispatcher'
import { createRuntimeActions } from './runtimeActions'

const globalScenarioDirectiveLimits = {
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 50, 100, 500, 2000],
}

const runtimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: 1,
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minCoastPredictionHorizonHours: 0.5,
  minViewportSize: EARTH_VIEWPORT_SIZE,
}

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 1,
    coastPredictionHorizonHours: 24,
    crashedBodyName: 'Earth',
    state: {
      elapsed: 100,
      bodies: [
        {
          id: 'earth',
          name: 'Earth',
          mass: 1,
          radius: 1,
          position: { x: 10, y: 20 },
          velocity: { x: 30, y: 40 },
          color: '#2f80ed',
        },
        {
          id: 'moon',
          name: 'Moon',
          mass: 1,
          radius: 1,
          position: { x: 50, y: 60 },
          velocity: { x: 70, y: 80 },
          color: '#9aa0a6',
        },
      ],
      controls: { main: 1, reverse: 0, strafe: 0, turn: 1 },
      spacecraft: {
        position: { x: 50, y: 60 },
        velocity: { x: 70, y: 80 },
        heading: 0.4,
        fuel: 1,
        fuelUsed: 2,
        dryMass: 3,
        fuelMass: 4,
        fuelCapacity: 5,
      },
    },
    targetHeading: 1,
    timeWarpIndex: 4,
    viewportSize: 600,
  },
  scenario: {
    activeDescription: 'Tutorial description',
    activeTitle: 'Tutorial',
    directives: createDefaultScenarioDirectives(),
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
    }),
  },
  ui: {
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
  },
})

const createTestRuntimeActions = (runtime: AppRuntimeState) =>
  createRuntimeActions({
    app: {} as HTMLDivElement,
    cameraDistance: 700,
    cameraElevation: 1,
    createRipple: () => {},
    gameScene: { trailPoints: [] } as never,
    maxCoastPredictionHorizonHours: 48,
    maxViewport: EARTH_MOON_VIEWPORT_SIZE,
    minCoastPredictionHorizonHours: 0.5,
    minViewport: EARTH_VIEWPORT_SIZE,
    renderer: { setSize: () => {} },
    ripples: [],
    runtime,
    globalScenarioDirectiveLimits,
    runtimeScenarioOptions,
    timeWarps: [1, 10, 50, 100, 500, 2000],
    updateUserSettings: () => {},
    gameHighLevelActions: new GameHighLevelActionsMediator(),
  })

describe('createRuntimeActions', () => {
  it('resets time warp to the initial index when resetting the scenario', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.handleUIUserAction('resetScenario')

    expect(runtime.simulation.timeWarpIndex).toBe(0)
  })

  it('restores the active checkpoint when requested explicitly', () => {
    const runtime = createRuntime()
    runtime.scenario.session.checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      viewportSize: 320,
      world: {
        elapsed: 42,
        bodies: [
          {
            id: 'earth',
            name: 'Earth',
            mass: 10,
            radius: 20,
            position: { x: 1, y: 2 },
            velocity: { x: 3, y: 4 },
            color: '#2f80ed',
          },
        ],
        controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
        spacecraft: {
          position: { x: 5, y: 6 },
          velocity: { x: 7, y: 8 },
          heading: 0.2,
          fuel: 9,
          fuelUsed: 10,
          dryMass: 11,
          fuelMass: 12,
          fuelCapacity: 13,
        },
      },
    })
    const runtimeActions = createTestRuntimeActions(runtime)

    expect(runtimeActions.restartFromCheckpoint()).toBe(true)
    expect(runtime.simulation.crashedBodyName).toBeNull()
    expect(runtime.simulation.timeWarpIndex).toBe(0)
    expect(runtime.simulation.state.elapsed).toBe(42)
    expect(runtime.simulation.viewportSize).toBe(320)
  })

  it('updates the reset target when free roam starts', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.startFreeRoam()

    expect(runtime.scenario.session.scenarioId).toBe('earth-moon')
    expect(runtime.scenario.activeTitle).toBe('Earth-Moon sandbox')

    runtime.simulation.timeWarpIndex = 4
    runtimeActions.resetScenario()

    expect(runtime.simulation.timeWarpIndex).toBe(0)
    expect(runtime.scenario.session.scenarioId).toBe('earth-moon')
  })

  it('switches to the menu background scenario and menu-only overrides', () => {
    const runtime = createRuntime()
    const runtimeActions = createTestRuntimeActions(runtime)

    runtimeActions.enterMainMenuBackground()

    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.ui.spacecraftLabelIntroUntil).toBe(Number.POSITIVE_INFINITY)
    expect(runtime.simulation.timeWarpIndex).toBe(4)
  })

  it('syncs directives immediately after acknowledging the tutorial intro prompt', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      pendingPrompt: 'phase-one-intro',
    })
    const runtimeActions = createTestRuntimeActions(runtime)

    const result = runtimeActions.acknowledgeScenarioPrompt()

    expect(result).toEqual({ acknowledged: true, effect: undefined })
    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      pendingPrompt: null,
      onboarding: {
        activeStepId: 'intro-thrust',
        gateActive: true,
      },
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })

  it('syncs directives immediately after reopening the tutorial intro prompt', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      lastAcknowledgedPrompt: 'phase-one-intro',
      pendingPrompt: null,
      onboarding: {
        activeStepId: 'intro-thrust',
        completedStepIds: [],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 0,
          lastSampleHeading: runtime.simulation.state.spacecraft.heading,
          lastSampleAtMs: 1_000,
          stepStartHeading: runtime.simulation.state.spacecraft.heading,
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
        },
      },
    })
    const runtimeActions = createTestRuntimeActions(runtime)
    runtime.scenario.directives = createDefaultScenarioDirectives()

    expect(runtimeActions.reopenScenarioPrompt()).toBe(true)
    expect(runtime.scenario.session.state).toMatchObject({
      pendingPrompt: 'phase-one-intro',
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })
})

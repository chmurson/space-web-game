import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '@/domain/viewportPresets'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import {
  applyRuntimeScenarioDirectiveConstraints,
  getConstrainedTimeWarpIndex,
  resolveRuntimeScenarioDirectives,
  syncRuntimeScenarioDirectives,
} from '@/scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from '@/scenario/scenarioRegistry'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import { escapeEarthTrajectoryViewportSize } from '@/scenario/specific-scenarios/tutorial/tutorialSceneRouter'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

const globalScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: 48,
  defaultViewportSize: 520,
  maxViewportSize: 800,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: requestedTimeWarps,
}

const createRuntime = (): AppRuntimeState => ({
  info: { userPins: [] },
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 0,
    assistTargetSelectionMode: 'manual',
    coastPredictionHorizonHours: 24,
    crashedBodyName: null,
    state: {
      elapsed: 0,
      bodies: [],
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
      spacecraft: {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        heading: 0,
        fuel: 0,
        fuelUsed: 0,
        dryMass: 1,
        fuelMass: 0,
        fuelCapacity: 0,
      },
    },
    targetHeading: null,
    targetHeadingTurn: null,
    timeWarpIndex: 3,
    viewportSize: 900,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Tutorial description',
      title: 'Tutorial',
    },
    session: createRuntimeScenarioSession('tutorial', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['moon'],
    }),
  },
  ui: {
    camera: {
      follow: 'spacecraft',
      panOffset: { x: 0, y: 0 },
    },
    spacecraftLabelIntroUntil: 0,
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

describe('scenarioDirectives', () => {
  it('migrates legacy camera directives alongside generic scenario state', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('custom', {
      cameraMode: 'unlocked',
      cameraModeChangesLocked: true,
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['moon'],
    })

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(directives.cameraControlsLocked).toBe(true)
    expect(directives.cameraFollow).toBeNull()
    expect(directives.forcedAssistTargetId).toBe('moon')
    expect(directives.hiddenBodyIds).toEqual(['moon'])
  })

  it.each([
    ['centered', 'spacecraft'],
    ['target', 'target'],
    ['unlocked', null],
  ] as const)('maps legacy %s camera mode to the expected follow subject', (cameraMode, expectedFollow) => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('custom', {
      cameraMode,
    })

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives.cameraFollow).toBe(expectedFollow)
  })

  it('applies directive Follow and lock constraints to runtime camera state', () => {
    const runtime = createRuntime()
    runtime.ui.camera = {
      follow: 'target',
      panOffset: { x: 12, y: 24 },
    }
    runtime.scenario.directives = {
      ...createDefaultScenarioDirectives(),
      cameraControlsLocked: true,
      cameraFollow: 'spacecraft',
    }

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(runtime.ui.camera).toEqual({
      follow: 'spacecraft',
      panOffset: { x: 0, y: 0 },
    })
  })

  it('recenters when scenario camera controls become locked', () => {
    const runtime = createRuntime()
    runtime.ui.camera = {
      follow: 'target',
      panOffset: { x: 12, y: 24 },
    }
    runtime.scenario.session = createRuntimeScenarioSession('custom', {
      cameraControlsLocked: true,
      cameraFollow: 'target',
    })

    syncRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)

    expect(runtime.ui.camera).toEqual({
      follow: 'target',
      panOffset: { x: 0, y: 0 },
    })
  })

  it('merges earth-moon directive overrides with generic scenario state directives', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('earth-moon', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['earth'],
    })

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(directives.forcedAssistTargetId).toBe('moon')
    expect(directives.hiddenBodyIds).toEqual(['earth'])
    expect(directives.maxViewportSize).toBe(EARTH_MOON_VIEWPORT_SIZE)
  })

  it('matches the earth-moon zoom-out cap for the one-body Kepler orbit', () => {
    const getMaxViewportSize = (scenarioId: string) => {
      const runtime = createRuntime()
      runtime.scenario.session = createRuntimeScenarioSession(scenarioId)

      return resolveRuntimeScenarioDirectives(
        runtime,
        globalScenarioDirectiveLimits,
      ).maxViewportSize
    }

    expect(getMaxViewportSize('earth-moon')).toBe(EARTH_MOON_VIEWPORT_SIZE)
    expect(getMaxViewportSize('earth-kepler-orbit-debug')).toBe(
      getMaxViewportSize('earth-moon'),
    )
  })

  it('constrains runtime state to directive caps', () => {
    const runtime = createRuntime()
    runtime.scenario.directives = {
      ...createDefaultScenarioDirectives(),
      maxCoastPredictionHorizonHours: 12,
      maxTimeWarp: 100,
      maxViewportSize: 400,
      minViewportSize: 80,
    }

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(runtime.simulation.coastPredictionHorizonHours).toBe(12)
    expect(runtime.simulation.timeWarpIndex).toBe(2)
    expect(runtime.simulation.viewportSize).toBe(400)
  })

  it('keeps time warp index within the configured max warp cap', () => {
    expect(getConstrainedTimeWarpIndex(3, [1, 10, 100, 1000], 100)).toBe(2)
    expect(getConstrainedTimeWarpIndex(1, [1, 10, 100, 1000], null)).toBe(1)
    expect(
      getConstrainedTimeWarpIndex(
        requestedTimeWarps.length - 1,
        requestedTimeWarps,
        300,
      ),
    ).toBe(requestedTimeWarps.indexOf(240))
  })

  it('derives tutorial phase-1 directives from tutorial scenario state', () => {
    const runtime = createRuntime()
    runtime.scenario.session =
      getRuntimeScenarioDefinition('tutorial')?.createScenario()
        .scenarioSession ?? runtime.scenario.session

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives).toEqual({
      cameraControlsLocked: true,
      cameraFollow: 'spacecraft',
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      forcedAssistTargetId: null,
      hiddenBodyIds: ['moon'],
      hiddenUIElements: new Set(),
      infoPins: [{ bodyId: 'earth', kind: 'body' }],
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 30,
      maxViewportSize: EARTH_VIEWPORT_SIZE,
      minViewportSize: null,
    })
  })

  it('unlocks tutorial camera changes after onboarding is completed', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      onboarding: {
        activeStepId: null,
        completedStepIds: [],
        gateActive: false,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 0,
          lastSampleHeading: 0,
          lastSampleAtMs: 0,
          stepStartHeading: 0,
          stepStartTimeWarpMultiplier: 1,
          stepStartTouchThrustControlEngaged: false,
        },
      },
    })

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives.cameraControlsLocked).toBe(false)
    expect(directives.cameraFollow).toBeNull()
    expect(directives.maxCoastPredictionHorizonHours).toBe(2)
    expect(directives.maxTimeWarp).toBe(300)
    expect(directives.maxViewportSize).toBe(escapeEarthTrajectoryViewportSize)
  })

  it('raises the tutorial zoom cap at the trajectory coach step', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-trajectory',
        completedStepIds: [
          'intro-show-thrust-control',
          'intro-thrust',
          'intro-keep-thrusting',
          'intro-thrusting-off',
          'intro-point-and-turn',
          'intro-timewarp',
          'intro-timewarp-thrust',
        ],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 0,
          accumulatedTrajectoryClearMs: 0,
          hasStartedMainBurn: true,
          lastSampleHeading: 0,
          lastSampleAtMs: 0,
          stepStartHeading: 0,
          stepStartTimeWarpMultiplier: 30,
          stepStartTouchThrustControlEngaged: false,
        },
      },
    })

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives.maxViewportSize).toBe(escapeEarthTrajectoryViewportSize)
  })
})

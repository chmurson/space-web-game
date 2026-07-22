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

describe('scenarioDirectives', () => {
  it('resolves generic forced target and hidden body directives from scenario state', () => {
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

    expect(directives.cameraMode).toBe('unlocked')
    expect(directives.cameraModeChangesLocked).toBe(true)
    expect(directives.forcedAssistTargetId).toBe('moon')
    expect(directives.hiddenBodyIds).toEqual(['moon'])
  })

  it('applies directive camera mode constraints to runtime camera state', () => {
    const runtime = createRuntime()
    runtime.ui.camera = {
      mode: 'unlocked',
      panOffset: { x: 12, y: 24 },
    }
    runtime.scenario.directives = {
      ...createDefaultScenarioDirectives(),
      cameraMode: 'centered',
      cameraModeChangesLocked: true,
    }

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(runtime.ui.camera.mode).toBe('centered')
    expect(runtime.ui.camera.panOffset).toEqual({ x: 12, y: 24 })
  })

  it('preserves unlocked pan offset when forced unlocked mode is already active', () => {
    const runtime = createRuntime()
    runtime.ui.camera = {
      mode: 'unlocked',
      panOffset: { x: 12, y: 24 },
    }
    runtime.scenario.directives = {
      ...createDefaultScenarioDirectives(),
      cameraMode: 'unlocked',
      cameraModeChangesLocked: true,
    }

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(runtime.ui.camera).toEqual({
      mode: 'unlocked',
      panOffset: { x: 12, y: 24 },
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
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      cameraMode: 'centered',
      cameraModeChangesLocked: true,
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
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
          stepStartTouchThrustControlEngaged: false,
        },
      },
    })

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives.cameraMode).toBeNull()
    expect(directives.cameraModeChangesLocked).toBe(false)
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
          stepStartTargetHeadingSelectionEpoch: 0,
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

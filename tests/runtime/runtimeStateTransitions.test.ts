import { describe, expect, it, vi } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '@/domain/viewportPresets'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import * as scenarioDirectives from '@/scenario/scenarioDirectives'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import {
  advanceRuntimeScenario,
  applyCheckpointRestoreTransition,
  applyScenarioLoadTransition,
  shouldSyncDirectivesForScenarioTransition,
} from '@/runtime/runtimeStateTransitions'

const globalScenarioDirectiveLimits = {
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 50, 100, 500, 2000],
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
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Tutorial description',
      title: 'Tutorial',
    },
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
    }),
  },
  ui: {
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
    performanceDebugEnabled: false,
  },
})

describe('runtimeStateTransitions', () => {
  it('syncs directives for full scenario load transitions', () => {
    const runtime = createRuntime()
    let clearTransientCalls = 0

    applyScenarioLoadTransition(
      runtime,
      {
        coastPredictionHorizonHours: 2,
        scenario: {
          metadata: {
            description: 'Menu background description',
            title: 'Menu background',
          },
          session: createRuntimeScenarioSession('menu-background', {
            cameraFollowBodyId: 'earth',
            cameraFollowOffsetX: 4_000_000,
            cameraFollowOffsetY: 4_000_000,
            hiddenBodyIds: ['moon'],
          }),
        },
        state: {
          elapsed: 0,
          bodies: runtime.simulation.state.bodies,
          controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
          spacecraft: runtime.simulation.state.spacecraft,
        },
        viewportSize: EARTH_VIEWPORT_SIZE,
      },
      {
        clearTransientScenarioState: () => {
          clearTransientCalls += 1
          runtime.simulation.targetHeading = null
          runtime.simulation.assistMode = 'off'
          runtime.simulation.crashedBodyName = null
        },
        globalScenarioDirectiveLimits,
      },
    )

    expect(clearTransientCalls).toBe(1)
    expect(runtime.scenario.metadata).toEqual({
      description: 'Menu background description',
      title: 'Menu background',
    })
    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.ui.uiEffectEpoch).toBe(1)
    expect(runtime.simulation.assistMode).toBe('off')
    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.scenario.directives.cameraFollowBodyId).toBe('earth')
    expect(runtime.scenario.directives.hiddenBodyIds).toEqual(['moon'])
  })

  it('always syncs directives for checkpoint restores', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-show-thrust-control',
        completedStepIds: [],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 0,
          lastSampleHeading: runtime.simulation.state.spacecraft.heading,
          lastSampleAtMs: 1_000,
          stepStartHeading: runtime.simulation.state.spacecraft.heading,
          stepStartTouchThrustControlEngaged: false,
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
        },
      },
    })

    const restored = applyCheckpointRestoreTransition(
      runtime,
      {
        assistMode: 'capture',
        assistTargetIndex: 0,
        coastPredictionHorizonHours: 12,
        state: {
          elapsed: 42,
          bodies: runtime.simulation.state.bodies,
          controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
          spacecraft: runtime.simulation.state.spacecraft,
        },
        targetHeading: 0.3,
        timeWarpIndex: 0,
        viewportSize: 320,
      },
      {
        clearTransientScenarioState: () => {
          runtime.simulation.targetHeading = null
          runtime.simulation.assistMode = 'off'
          runtime.simulation.crashedBodyName = null
        },
        globalScenarioDirectiveLimits,
      },
    )

    expect(restored).toBe(true)
    expect(runtime.simulation.state.elapsed).toBe(42)
    expect(runtime.simulation.viewportSize).toBe(EARTH_VIEWPORT_SIZE)
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(2)
    expect(runtime.simulation.assistMode).toBe('off')
    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })

  it('returns false for null or undefined scenario transitions', () => {
    expect(shouldSyncDirectivesForScenarioTransition(null)).toBe(false)
    expect(shouldSyncDirectivesForScenarioTransition(undefined)).toBe(false)
  })

  it('returns false for checkpoint-only transitions', () => {
    expect(
      shouldSyncDirectivesForScenarioTransition({ checkpoint: null }),
    ).toBe(false)
  })

  it('returns false for completed-only transitions', () => {
    expect(shouldSyncDirectivesForScenarioTransition({ completed: true })).toBe(
      false,
    )
  })

  it('returns false for runtimePatch-only transitions', () => {
    expect(shouldSyncDirectivesForScenarioTransition({})).toBe(false)
  })

  it('returns true when the transition includes nextState', () => {
    expect(
      shouldSyncDirectivesForScenarioTransition({
        nextState: { phase: 'escape-earth' },
      }),
    ).toBe(true)
  })

  it('does not sync directives when scenario advance produces no state transition', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('custom', {
      hiddenBodyIds: ['moon'],
    })
    const syncSpy = vi.spyOn(
      scenarioDirectives,
      'syncRuntimeScenarioDirectives',
    )

    advanceRuntimeScenario(runtime, globalScenarioDirectiveLimits)

    expect(syncSpy).not.toHaveBeenCalled()
  })

  it('syncs directives when scenario advance includes nextState', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-thrust',
        completedStepIds: ['intro-show-thrust-control'],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 1_100,
          lastSampleHeading: runtime.simulation.state.spacecraft.heading,
          lastSampleAtMs: performance.now() - 1_100,
          stepStartHeading: runtime.simulation.state.spacecraft.heading,
          stepStartTouchThrustControlEngaged: true,
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
        },
      },
    })
    runtime.simulation.state.controls.main = 1
    runtime.simulation.state.spacecraft.fuel = 1
    runtime.simulation.timeWarpIndex = 0
    const syncSpy = vi.spyOn(
      scenarioDirectives,
      'syncRuntimeScenarioDirectives',
    )

    advanceRuntimeScenario(runtime, globalScenarioDirectiveLimits)

    expect(syncSpy).toHaveBeenCalledOnce()
    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-keep-thrusting',
      },
    })
  })
})

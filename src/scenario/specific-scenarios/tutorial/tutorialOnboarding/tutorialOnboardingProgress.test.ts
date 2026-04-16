import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from '../../../../runtime/appRuntimeState'
import { createDefaultScenarioDirectives } from '../../../scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '../../../scenarioSession'
import {
  advanceTutorialOnboarding,
  acknowledgeTutorialOnboardingPrompt,
  createTutorialOnboardingState,
} from './tutorialOnboardingProgress'

const createRuntime = (): AppRuntimeState => ({
  assistMode: 'capture',
  assistTargetIndex: 0,
  coastPredictionHorizonHours: 2,
  crashedBodyName: null,
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: '',
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  scenarioDirectives: createDefaultScenarioDirectives(),
  scenarioSession: createRuntimeScenarioSession('tutorial', {
    phase: 'escape-earth',
    pendingPrompt: null,
  }),
  spacecraftLabelIntroUntil: 0,
  targetHeadingSelectionEpoch: 0,
  uiEffectEpoch: 0,
  state: {
    elapsed: 0,
    bodies: [
      {
        id: 'earth',
        name: 'Earth',
        mass: 5.9722e24,
        radius: 6_371_000,
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        color: '#2f80ed',
      },
      {
        id: 'moon',
        name: 'Moon',
        mass: 7.342e22,
        radius: 1_737_400,
        position: { x: 384_400_000, y: 0 },
        velocity: { x: 0, y: 1022 },
        color: '#9aa0a6',
      },
    ],
    controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
    spacecraft: {
      position: { x: 6_371_000 + 500_000, y: 0 },
      velocity: { x: 0, y: 7_500 },
      heading: 0,
      fuel: 1,
      fuelUsed: 0,
      dryMass: 10_000,
      fuelMass: 8_000,
      fuelCapacity: 32_000,
    },
  },
  targetHeading: null,
  timeWarpIndex: 0,
  viewportSize: 104,
})

describe('tutorialOnboardingProgress', () => {
  it('advances from thrust to keep-thrusting after sustained main thrust', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 3_050, 1)

    expect(onboarding.activeStepId).toBe('intro-keep-thrusting')
    expect(onboarding.completedStepIds).toEqual(['intro-thrust'])
  })

  it('requires the turn lesson to accumulate 90 degrees of rotation across both directions', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-turn',
      completedStepIds: ['intro-thrust', 'intro-keep-thrusting'],
    }

    runtime.state.spacecraft.heading = Math.PI / 4
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)
    expect(onboarding.activeStepId).toBe('intro-turn')

    runtime.state.spacecraft.heading = 0
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 1)
    expect(onboarding.activeStepId).toBe('intro-point-and-turn')
  })

  it('requires the first thrust hold to be continuous', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_400, 1)
    runtime.state.controls.main = 0
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_450, 1)
    runtime.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 3_100, 1)

    expect(onboarding.activeStepId).toBe('intro-thrust')

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 4_500, 1)
    expect(onboarding.activeStepId).toBe('intro-keep-thrusting')
  })

  it('uses direct heading selection, time warp, and high-warp thrust to reach trajectory explanation', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    onboarding = {
      ...onboarding,
      activeStepId: 'intro-point-and-turn',
      completedStepIds: ['intro-thrust', 'intro-keep-thrusting', 'intro-turn'],
    }
    runtime.targetHeadingSelectionEpoch = 1
    runtime.targetHeading = Math.PI / 2
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)
    expect(onboarding.activeStepId).toBe('intro-point-and-turn')

    runtime.targetHeading = null
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_150, 1)
    expect(onboarding.activeStepId).toBe('intro-timewarp')

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 100)
    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(runtime.targetHeading).toBeCloseTo(0, 6)

    runtime.state.spacecraft.heading = 0
    runtime.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 3_250, 100)

    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.completedStepIds).toEqual([
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-turn',
      'intro-point-and-turn',
      'intro-timewarp',
      'intro-timewarp-thrust',
    ])
  })

  it('requires acknowledgement for the trajectory and completion explanation steps', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-trajectory',
      completedStepIds: [
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-turn',
        'intro-point-and-turn',
        'intro-timewarp',
        'intro-timewarp-thrust',
      ],
    }

    const acknowledgedTrajectory = acknowledgeTutorialOnboardingPrompt(
      runtime,
      onboarding,
      1_050,
      100,
    )
    expect(acknowledgedTrajectory?.activeStepId).toBe('intro-complete')

    const acknowledgedComplete = acknowledgeTutorialOnboardingPrompt(
      runtime,
      // biome-ignore lint/style/noNonNullAssertion: acknowledgedTrajectory is guaranteed to exist after previous assertion
      acknowledgedTrajectory!,
      1_100,
      100,
    )
    expect(acknowledgedComplete).toMatchObject({
      activeStepId: null,
      gateActive: false,
    })
  })
})

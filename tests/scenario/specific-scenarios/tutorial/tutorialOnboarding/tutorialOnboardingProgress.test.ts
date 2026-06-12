import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import { getTutorialOnboardingPromptContent } from '@/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow'
import {
  acknowledgeTutorialOnboardingPrompt,
  advanceTutorialOnboarding,
  createTutorialOnboardingState,
} from '@/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress'

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 0,
    coastPredictionHorizonHours: 2,
    crashedBodyName: null,
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
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Tutorial description',
      title: 'Tutorial',
    },
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
    }),
  },
  ui: {
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
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

describe('tutorialOnboardingProgress', () => {
  it('exposes the thrust-zone hint only while mobile players are finding the thrust control', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-show-thrust-control', 'mobile')
        .touchHintTarget,
    ).toBe('thrust-zone')
    expect(
      getTutorialOnboardingPromptContent('intro-thrust', 'mobile')
        .touchHintTarget,
    ).toBeUndefined()
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'mobile')
        .touchHintTarget,
    ).toBeUndefined()
    expect(
      getTutorialOnboardingPromptContent('intro-timewarp-thrust', 'mobile')
        .touchHintTarget,
    ).toBe('thrust-zone')
    expect(
      getTutorialOnboardingPromptContent('intro-show-thrust-control', 'desktop')
        .touchHintTarget,
    ).toBeUndefined()
  })

  it('uses input-specific instructions for turning thrust off', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'mobile'),
    ).toMatchObject({
      anchor: 'thrust-control',
      description:
        'You can now turn off by sliding the thrust control down. Do it now.',
      focusedTouchControl: 'burn',
    })
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'desktop'),
    ).toMatchObject({
      anchor: 'speed-pill',
      description: 'Release W or Up Arrow so the main engine shuts down.',
    })
  })

  it('focuses the burn control only for mobile thrust-control coach prompts', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-thrust', 'mobile')
        .focusedTouchControl,
    ).toBe('burn')
    expect(
      getTutorialOnboardingPromptContent('intro-thrust', 'desktop')
        .focusedTouchControl,
    ).toBeUndefined()
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'mobile')
        .focusedTouchControl,
    ).toBeUndefined()
  })

  it('focuses HUD pills for speed-pill coach prompts', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'mobile')
        .focusedHudElement,
    ).toBe('speed-pill')
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-complete', 'mobile')
        .focusedHudElement,
    ).toBe('speed-pill')
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'desktop')
        .focusedHudElement,
    ).toBe('speed-pill')
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'mobile')
        .focusedHudElement,
    ).toBeUndefined()
  })

  it('advances from show-control to use-thrust when the thrust control becomes interactive', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      visible: true,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-thrust')
    expect(onboarding.completedStepIds).toEqual(['intro-show-thrust-control'])
  })

  it('advances from thrust to keep-thrusting after sustained main thrust', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-thrust',
      completedStepIds: ['intro-show-thrust-control'],
    }

    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 3_050, 1)

    expect(onboarding.activeStepId).toBe('intro-keep-thrusting')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
    ])
  })

  it('requires the first thrust hold to be continuous', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      visible: true,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_050, 1)

    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_300, 1)
    runtime.simulation.state.controls.main = 0
    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: false,
      visible: false,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_450, 1)

    expect(onboarding.activeStepId).toBe('intro-show-thrust-control')

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      visible: true,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_500, 1)
    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_900, 1)
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 4_650, 1)
    expect(onboarding.activeStepId).toBe('intro-keep-thrusting')
  })

  it('falls back from keep-thrusting to show-control when thrust stops and the control is gone', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-keep-thrusting',
      completedStepIds: ['intro-show-thrust-control', 'intro-thrust'],
      progress: {
        ...onboarding.progress,
        accumulatedMainThrustMs: 2_000,
      },
    }

    runtime.simulation.state.controls.main = 0
    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: false,
      visible: false,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-show-thrust-control')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
    ])
  })

  it('advances from thrusting-off once the touch thrust control is disengaged and released', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    runtime.ui.touchThrustControl = {
      engaged: true,
      interactive: true,
      visible: true,
    }
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-thrusting-off',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-complete',
      ],
      progress: {
        ...onboarding.progress,
        stepStartTouchThrustControlEngaged: true,
      },
    }

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_050, 1)
    expect(onboarding.activeStepId).toBe('intro-thrusting-off')

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      visible: true,
    }
    runtime.simulation.state.controls.main = 0
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-thrusting-off')

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: false,
      visible: false,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_150, 1)

    expect(onboarding.activeStepId).toBe('intro-point-and-turn')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-thrusting-complete',
      'intro-thrusting-off',
    ])
  })

  it('uses direct heading selection, time warp, and high-warp thrust to reach trajectory explanation', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    onboarding = {
      ...onboarding,
      activeStepId: 'intro-point-and-turn',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
      ],
    }
    runtime.ui.targetHeadingSelectionEpoch = 1
    runtime.simulation.targetHeading = Math.PI / 2
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)
    expect(onboarding.activeStepId).toBe('intro-point-and-turn')

    runtime.simulation.targetHeading = null
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_150, 1)
    expect(onboarding.activeStepId).toBe('intro-timewarp')

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 60)
    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(runtime.simulation.targetHeading).toBeCloseTo(0, 6)

    runtime.simulation.state.spacecraft.heading = 0
    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 3_250, 60)

    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
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
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-point-and-turn',
        'intro-timewarp',
        'intro-timewarp-thrust',
      ],
    }

    const acknowledgedTrajectory = acknowledgeTutorialOnboardingPrompt(
      runtime,
      onboarding,
      1_050,
      60,
    )
    expect(acknowledgedTrajectory?.activeStepId).toBe('intro-complete')

    const acknowledgedComplete = acknowledgeTutorialOnboardingPrompt(
      runtime,
      // biome-ignore lint/style/noNonNullAssertion: acknowledgedTrajectory is guaranteed to exist after previous assertion
      acknowledgedTrajectory!,
      1_100,
      60,
    )
    expect(acknowledgedComplete).toMatchObject({
      activeStepId: null,
      gateActive: false,
    })
  })
})

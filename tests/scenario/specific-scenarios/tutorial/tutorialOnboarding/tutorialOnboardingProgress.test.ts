import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { getPromptTextContent } from '@/scenario/scenarioPrompts'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import {
  getHiddenOnboardingUIElements,
  getTutorialOnboardingPromptContent,
} from '@/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingFlow'
import {
  acknowledgeTutorialOnboardingPrompt,
  advanceTutorialOnboarding,
  createTutorialOnboardingState,
} from '@/scenario/specific-scenarios/tutorial/tutorialOnboarding/tutorialOnboardingProgress'

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 0,
    assistTargetSelectionMode: 'manual',
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
        fuelCapacity: 0,
      },
    },
    targetHeading: null,
    targetHeadingTurn: null,
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

const getOnboardingDescription = (
  ...args: Parameters<typeof getTutorialOnboardingPromptContent>
) =>
  getPromptTextContent(getTutorialOnboardingPromptContent(...args).description)

describe('tutorialOnboardingProgress', () => {
  it('does not use the old thrust-zone hint while mobile players are finding the thrust control', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-show-thrust-control', 'mobile')
        .touchHintTarget,
    ).toBeUndefined()
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
    ).toBeUndefined()
    expect(
      getTutorialOnboardingPromptContent('intro-show-thrust-control', 'desktop')
        .touchHintTarget,
    ).toBeUndefined()
  })

  it('uses current mobile copy for opening and using the burn control', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-show-thrust-control', 'mobile'),
    ).toMatchObject({
      anchor: 'thrust-control',
      focusedTouchControl: 'burn',
      title: 'Open Burn Control',
    })
    expect(
      getOnboardingDescription('intro-show-thrust-control', 'mobile'),
    ).toBe(
      'Swipe inward from the Burn tab on the screen edge to open the burn control.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-thrust', 'mobile'),
    ).toMatchObject({
      anchor: 'thrust-control',
      focusedTouchControl: 'burn',
      title: 'Start A Burn',
    })
    expect(getOnboardingDescription('intro-thrust', 'mobile')).toBe(
      'Drag the orange handle upward and hold it for a moment to give the ship a short burn.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-thrust', 'desktop'),
    ).toMatchObject({
      anchor: 'trajectory',
      title: 'Start A Burn',
    })
    expect(getOnboardingDescription('intro-thrust', 'desktop')).toBe(
      'Hold W or Up Arrow for a moment to give the ship a short burn.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'mobile'),
    ).toMatchObject({
      anchor: 'speed-pill',
      focusedHudElement: 'speed-pill',
      focusedTouchControl: 'burn',
      title: 'Keep Burning',
    })
    expect(getOnboardingDescription('intro-keep-thrusting', 'mobile')).toBe(
      "That's it. Keep the burn going for 5s. Watch the speed pill while the ship picks up speed.",
    )
  })

  it('uses current mobile copy for opening and using the time warp control', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-timewarp', 'mobile'),
    ).toMatchObject({
      anchor: 'time-warp-control',
      focusedTouchControl: 'warp',
      title: 'Set Time Warp',
    })
    expect(getOnboardingDescription('intro-timewarp', 'mobile')).toBe(
      'Swipe inward from the Warp tab on the screen edge, then drag the selector upward until the time pill reaches x30s.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-timewarp', 'desktop'),
    ).toMatchObject({
      anchor: 'trajectory',
      title: 'Set Time Warp',
    })
    expect(getOnboardingDescription('intro-timewarp', 'desktop')).toBe(
      'Increase time warp until the time pill reaches x30s.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-keep-timewarp', 'mobile'),
    ).toMatchObject({
      anchor: 'time-warp-pill',
      focusedHudElement: 'time-warp-pill',
      focusedTouchControl: 'warp',
      title: 'Keep x30s',
    })
    expect(getOnboardingDescription('intro-keep-timewarp', 'mobile')).toBe(
      'Keep time warp at x30s for 10s. Time warp speeds up the simulation so you can see the orbit change without waiting in real time.',
    )
  })

  it('does not focus or dim controls during the high-warp burn prompt', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-timewarp-thrust', 'mobile'),
    ).toMatchObject({
      anchor: 'trajectory',
      focusedHudElement: undefined,
      focusedTouchControl: undefined,
      layout: 'floating',
      pausesGameplay: false,
      title: 'Burn At x30s',
    })
  })

  it('explains that the high-warp burn needs the x30s time warp notch', () => {
    expect(getOnboardingDescription('intro-timewarp-thrust', 'mobile')).toBe(
      'Keep time warp at x30s, then open Burn and hold the handle up for a few seconds to move away from Earth.',
    )
    expect(getOnboardingDescription('intro-timewarp-thrust', 'desktop')).toBe(
      'Keep time warp at x30s, then hold W or Up Arrow for a few seconds to move away from Earth.',
    )
  })

  it('uses an automatic trajectory coach prompt before the final continue prompt', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-trajectory', 'desktop'),
    ).toMatchObject({
      layout: 'floating',
      pausesGameplay: false,
      title: 'This Is Your Trajectory',
    })
    expect(getOnboardingDescription('intro-trajectory', 'desktop')).toBe(
      'This line predicts your path from speed and gravity. Use it to tell whether your burn is moving you away from Earth. Aim near 10 km/s for the Earth-Moon setup, but treat it as guidance: trajectory shape matters, and too much speed makes Moon capture harder.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-trajectory', 'mobile'),
    ).toMatchObject({
      layout: 'floating',
      pausesGameplay: false,
      title: 'This Is Your Trajectory',
    })
    expect(
      getTutorialOnboardingPromptContent('intro-complete', 'desktop'),
    ).toMatchObject({
      confirmAction: 'advance-step',
      layout: 'anchored',
      pausesGameplay: true,
      title: 'Free Flight Unlocked',
    })
    expect(
      getTutorialOnboardingPromptContent('intro-complete', 'mobile'),
    ).toMatchObject({
      confirmAction: 'advance-step',
      layout: 'bottom',
      pausesGameplay: true,
      title: 'Free Flight Unlocked',
    })
    expect(
      getTutorialOnboardingPromptContent('intro-timewarp-thrust', 'desktop')
        .pausesGameplay,
    ).toBe(false)
  })

  it('uses input-specific instructions for turning thrust off', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'mobile'),
    ).toMatchObject({
      anchor: 'thrust-control',
      focusedTouchControl: 'burn',
    })
    expect(getOnboardingDescription('intro-thrusting-off', 'mobile')).toBe(
      'Drag the orange handle back down to stop the burn.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-thrusting-off', 'desktop'),
    ).toMatchObject({
      anchor: 'speed-pill',
    })
    expect(getOnboardingDescription('intro-thrusting-off', 'desktop')).toBe(
      'Release W or Up Arrow to stop the burn.',
    )
  })

  it('uses current copy for direct heading selection', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-point-and-turn', 'desktop'),
    ).toMatchObject({
      layout: 'playfield',
      title: 'Point By Double-Tapping',
    })
    expect(getOnboardingDescription('intro-point-and-turn', 'desktop')).toBe(
      'Double-tap open space away from Earth to set a new heading. Wait while the ship turns to face it.',
    )
    expect(
      getTutorialOnboardingPromptContent('intro-point-and-turn', 'desktop')
        .anchor,
    ).toBeUndefined()
  })

  it('keeps the burn control focused for mobile thrust-control guidance', () => {
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
    ).toBe('burn')
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'desktop')
        .focusedTouchControl,
    ).toBeUndefined()
  })

  it('focuses HUD pills for speed-pill coach prompts', () => {
    expect(
      getTutorialOnboardingPromptContent('intro-keep-thrusting', 'mobile')
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

  it('waits on show-control when the docked thrust control is interactive but not revealed', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      revealed: false,
      visible: true,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-show-thrust-control')
    expect(onboarding.completedStepIds).toEqual([])
  })

  it('advances from show-control to use-thrust when the burn control is revealed', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      revealed: true,
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

  it('advances from keep-burning directly to stopping the burn', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-keep-thrusting',
      completedStepIds: ['intro-show-thrust-control', 'intro-thrust'],
    }

    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 6_100, 1)

    expect(onboarding.activeStepId).toBe('intro-thrusting-off')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
    ])
  })

  it('requires the first thrust hold to be continuous', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      revealed: true,
      visible: true,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_050, 1)

    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_300, 1)
    runtime.simulation.state.controls.main = 0
    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_450, 1)

    expect(onboarding.activeStepId).toBe('intro-show-thrust-control')

    runtime.ui.touchThrustControl = {
      engaged: false,
      interactive: true,
      revealed: true,
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
      revealed: false,
      visible: false,
    }
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-show-thrust-control')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
    ])
  })

  it('advances from thrusting-off once the touch thrust control is disengaged', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    runtime.ui.touchThrustControl = {
      engaged: true,
      interactive: true,
      revealed: true,
      visible: true,
    }
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-thrusting-off',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
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
      revealed: true,
      visible: true,
    }
    runtime.simulation.state.controls.main = 0
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-point-and-turn')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-thrusting-off',
    ])
  })

  it('hides the burn control between point-and-turn and high-warp burn guidance', () => {
    const runtime = createRuntime()
    const onboarding = createTutorialOnboardingState(runtime, 1_000, 1)

    expect(getHiddenOnboardingUIElements(onboarding)).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'timeWarpPill',
        'trajectory',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-keep-thrusting',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'timeWarpPill',
        'trajectory',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-thrusting-off',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'timeWarpPill',
        'trajectory',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-point-and-turn',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'thrustControl',
        'timeWarpPill',
        'trajectory',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-timewarp',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'thrustControl',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-keep-timewarp',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'thrustControl',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-timewarp-thrust',
      }),
    ).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'trajectory',
      ]),
    )
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-timewarp-thrust',
        progress: {
          ...onboarding.progress,
          hasStartedMainBurn: true,
        },
      }),
    ).toEqual(new Set(['scenarioInfoButton', 'targetControl', 'targetPill']))
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-trajectory',
      }),
    ).toEqual(new Set(['scenarioInfoButton', 'targetControl']))
    expect(
      getHiddenOnboardingUIElements({
        ...onboarding,
        activeStepId: 'intro-complete',
      }),
    ).toEqual(new Set(['scenarioInfoButton', 'targetControl']))
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
    runtime.simulation.state.spacecraft.heading = Math.PI / 2
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)
    expect(onboarding.activeStepId).toBe('intro-point-and-turn')

    runtime.simulation.targetHeading = null
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_150, 1)
    expect(onboarding.activeStepId).toBe('intro-timewarp')

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 30)
    expect(onboarding.activeStepId).toBe('intro-keep-timewarp')

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 11_200, 30)
    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(runtime.simulation.targetHeading).toBeCloseTo(Math.PI / 2, 6)

    runtime.simulation.state.spacecraft.heading = Math.PI / 2
    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 12_200, 30)

    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-point-and-turn',
      'intro-timewarp',
      'intro-keep-timewarp',
      'intro-timewarp-thrust',
    ])
  })

  it('sets the high-warp burn target heading prograde instead of radial outward', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 30)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-keep-timewarp',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
        'intro-point-and-turn',
        'intro-timewarp',
      ],
      progress: {
        ...onboarding.progress,
        accumulatedTimeWarpMs: 9_900,
      },
    }
    runtime.simulation.state.spacecraft.position = {
      x: 0,
      y: 6_371_000 + 500_000,
    }
    runtime.simulation.state.spacecraft.velocity = { x: -7_500, y: 500 }

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 30)

    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(runtime.simulation.targetHeading).toBeCloseTo(Math.PI, 6)
    expect(runtime.simulation.targetHeading).not.toBeCloseTo(Math.PI / 2, 6)
  })

  it('uses the perpendicular fallback when high-warp burn velocity is purely radial', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 30)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-keep-timewarp',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
        'intro-point-and-turn',
        'intro-timewarp',
      ],
      progress: {
        ...onboarding.progress,
        accumulatedTimeWarpMs: 9_900,
      },
    }
    runtime.simulation.state.spacecraft.position = {
      x: 6_371_000 + 500_000,
      y: 0,
    }
    runtime.simulation.state.spacecraft.velocity = { x: 500, y: 0 }

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 30)

    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(runtime.simulation.targetHeading).toBeCloseTo(Math.PI / 2, 6)
  })

  it('returns to time warp control guidance if x30s is lowered during the hold step', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-keep-timewarp',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
        'intro-point-and-turn',
        'intro-timewarp',
      ],
      progress: {
        ...onboarding.progress,
        accumulatedTimeWarpMs: 2_000,
      },
    }

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_500, 10)

    expect(onboarding.activeStepId).toBe('intro-timewarp')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-thrusting-off',
      'intro-point-and-turn',
      'intro-timewarp',
    ])
    expect(onboarding.progress.accumulatedTimeWarpMs).toBeUndefined()
    expect(onboarding.progress.stepStartTimeWarpMultiplier).toBe(10)
  })

  it('waits for a meaningful heading change before completing the turning step', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-point-and-turn',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
      ],
    }

    runtime.ui.targetHeadingSelectionEpoch = 1
    runtime.simulation.state.spacecraft.heading = Math.PI / 8
    runtime.simulation.targetHeading = null
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-point-and-turn')
    expect(onboarding.progress.accumulatedHeadingChangeRadians).toBeCloseTo(
      Math.PI / 8,
      6,
    )

    runtime.simulation.state.spacecraft.heading = Math.PI / 2
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 1)

    expect(onboarding.activeStepId).toBe('intro-timewarp')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-thrusting-off',
      'intro-point-and-turn',
    ])
  })

  it('keeps trajectory hidden during the high-warp burn prompt until x30s burn starts', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-timewarp-thrust',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
        'intro-point-and-turn',
        'intro-timewarp',
      ],
      progress: {
        ...onboarding.progress,
        accumulatedMainThrustMs: 0,
        hasStartedMainBurn: false,
      },
    }

    expect(getHiddenOnboardingUIElements(onboarding)).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'trajectory',
      ]),
    )

    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_100, 1)

    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(onboarding.progress.hasStartedMainBurn).toBe(false)
    expect(getHiddenOnboardingUIElements(onboarding)).toEqual(
      new Set([
        'scenarioInfoButton',
        'targetControl',
        'targetPill',
        'trajectory',
      ]),
    )

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 1_200, 30)

    expect(onboarding.activeStepId).toBe('intro-timewarp-thrust')
    expect(onboarding.progress.hasStartedMainBurn).toBe(true)
    expect(getHiddenOnboardingUIElements(onboarding)).toEqual(
      new Set(['scenarioInfoButton', 'targetControl', 'targetPill']),
    )
  })

  it('counts high-warp thrust even while the ship is still turning outward', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-timewarp-thrust',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-thrusting-off',
        'intro-point-and-turn',
        'intro-timewarp',
      ],
    }

    runtime.simulation.state.spacecraft.heading = Math.PI / 2
    runtime.simulation.targetHeading = 0
    runtime.simulation.state.controls.main = 1
    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_000, 30)

    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.completedStepIds).toEqual([
      'intro-show-thrust-control',
      'intro-thrust',
      'intro-keep-thrusting',
      'intro-thrusting-off',
      'intro-point-and-turn',
      'intro-timewarp',
      'intro-timewarp-thrust',
    ])
  })

  it('requires a clear trajectory for 3s before the completion explanation', () => {
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

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_000, 30, {
      trajectoryExitReady: true,
    })
    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.progress.accumulatedTrajectoryClearMs).toBe(1_000)

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 2_500, 30, {
      trajectoryExitReady: false,
    })
    expect(onboarding.activeStepId).toBe('intro-trajectory')
    expect(onboarding.progress.accumulatedTrajectoryClearMs).toBe(0)

    onboarding = advanceTutorialOnboarding(runtime, onboarding, 5_500, 30, {
      trajectoryExitReady: true,
    })
    expect(onboarding.activeStepId).toBe('intro-complete')
  })

  it('requires acknowledgement for the completion explanation step', () => {
    const runtime = createRuntime()
    let onboarding = createTutorialOnboardingState(runtime, 1_000, 1)
    onboarding = {
      ...onboarding,
      activeStepId: 'intro-complete',
      completedStepIds: [
        'intro-show-thrust-control',
        'intro-thrust',
        'intro-keep-thrusting',
        'intro-point-and-turn',
        'intro-timewarp',
        'intro-timewarp-thrust',
        'intro-trajectory',
      ],
    }

    const acknowledgedComplete = acknowledgeTutorialOnboardingPrompt(
      runtime,
      onboarding,
      1_050,
      30,
    )
    expect(acknowledgedComplete).toMatchObject({
      activeStepId: null,
      gateActive: false,
    })
  })
})

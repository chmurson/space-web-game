import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { applyScenarioRuntimeTransition } from '@/runtime/runtimeStateTransitions'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import {
  dispatchScenarioPromptAction,
  reopenScenarioReplayPrompt,
  resolveScenarioPrompts,
} from '@/scenario/scenarioPrompts'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'off',
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
        position: { x: 6_371_000 * 5.2, y: 0 },
        velocity: { x: 0, y: 500 },
        heading: 0,
        fuel: 1,
        fuelUsed: 0,
        dryMass: 10_000,
        fuelMass: 8_000,
        fuelCapacity: 32_000,
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
    session: createRuntimeScenarioSession(
      'tutorial',
      { phase: 'escape-earth' },
      {
        activePromptId: 'phase-one-intro',
        replayPromptId: null,
      },
    ),
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
    performanceDebugEnabled: false,
  },
})

describe('scenarioPrompts', () => {
  it('resolves active blocking prompts from prompt ids', () => {
    const runtime = createRuntime()

    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'blocking',
      id: 'phase-one-intro',
      pausesGameplay: true,
      title: 'Leave Earth Orbit',
    })
  })

  it('resolves coach prompt anchor and mobile touch hint', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-keep-thrusting',
          completedStepIds: ['intro-show-thrust-control', 'intro-thrust'],
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
      },
      {
        activePromptId: 'intro-keep-thrusting',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      id: 'intro-keep-thrusting',
      anchor: 'speed-pill',
      focusedHudElement: 'speed-pill',
      focusedTouchControl: 'burn',
      layout: 'anchored',
    })
  })

  it('resolves mobile focused touch controls for coach prompts', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-thrust',
          completedStepIds: ['intro-show-thrust-control'],
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
      },
      {
        activePromptId: 'intro-thrust',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      id: 'intro-thrust',
      anchor: 'thrust-control',
      focusedTouchControl: 'burn',
    })
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'coach',
      id: 'intro-thrust',
      anchor: 'trajectory',
    })
    const desktopPrompt = resolveScenarioPrompts(runtime, 'desktop').active
    expect(
      desktopPrompt?.kind === 'coach'
        ? desktopPrompt.focusedTouchControl
        : null,
    ).toBeUndefined()
  })

  it('resolves mobile focused touch controls for time warp coach prompts', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-timewarp',
          completedStepIds: [
            'intro-show-thrust-control',
            'intro-thrust',
            'intro-keep-thrusting',
            'intro-thrusting-off',
            'intro-point-and-turn',
          ],
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
      },
      {
        activePromptId: 'intro-timewarp',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      id: 'intro-timewarp',
      anchor: 'time-warp-control',
      focusedTouchControl: 'warp',
    })
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'coach',
      id: 'intro-timewarp',
      anchor: 'trajectory',
    })
  })

  it('resolves the high-warp burn coach prompt without mobile focus dimming', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-timewarp-thrust',
          completedStepIds: [
            'intro-show-thrust-control',
            'intro-thrust',
            'intro-keep-thrusting',
            'intro-thrusting-off',
            'intro-point-and-turn',
            'intro-timewarp',
          ],
          gateActive: true,
          progress: {
            accumulatedHeadingChangeRadians: 0,
            accumulatedMainThrustMs: 0,
            lastSampleHeading: runtime.simulation.state.spacecraft.heading,
            lastSampleAtMs: 1_000,
            stepStartHeading: runtime.simulation.state.spacecraft.heading,
            stepStartTouchThrustControlEngaged: false,
            stepStartTargetHeadingSelectionEpoch: 0,
            stepStartTimeWarpMultiplier: 30,
          },
        },
      },
      {
        activePromptId: 'intro-timewarp-thrust',
        replayPromptId: 'phase-one-intro',
      },
    )

    const prompt = resolveScenarioPrompts(runtime, 'mobile').active
    expect(prompt).toMatchObject({
      kind: 'coach',
      id: 'intro-timewarp-thrust',
      anchor: 'trajectory',
      layout: 'floating',
      pausesGameplay: false,
    })
    expect(prompt?.kind === 'coach' ? prompt.focusedTouchControl : null).toBe(
      undefined,
    )
    expect(prompt?.kind === 'coach' ? prompt.focusedHudElement : null).toBe(
      undefined,
    )
  })

  it('resolves trajectory guidance as an automatic coach before final continue prompts', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
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
            lastSampleHeading: runtime.simulation.state.spacecraft.heading,
            lastSampleAtMs: 1_000,
            stepStartHeading: runtime.simulation.state.spacecraft.heading,
            stepStartTouchThrustControlEngaged: false,
            stepStartTargetHeadingSelectionEpoch: 0,
            stepStartTimeWarpMultiplier: 30,
          },
        },
      },
      {
        activePromptId: 'intro-trajectory',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'coach',
      id: 'intro-trajectory',
      layout: 'anchored',
      pausesGameplay: false,
      title: 'This Is Your Trajectory',
    })
    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      id: 'intro-trajectory',
      layout: 'anchored',
      pausesGameplay: false,
      title: 'This Is Your Trajectory',
    })

    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
        onboarding: {
          activeStepId: 'intro-complete',
          completedStepIds: [
            'intro-show-thrust-control',
            'intro-thrust',
            'intro-keep-thrusting',
            'intro-thrusting-off',
            'intro-point-and-turn',
            'intro-timewarp',
            'intro-timewarp-thrust',
            'intro-trajectory',
          ],
          gateActive: true,
          progress: {
            accumulatedHeadingChangeRadians: 0,
            accumulatedMainThrustMs: 0,
            lastSampleHeading: runtime.simulation.state.spacecraft.heading,
            lastSampleAtMs: 1_000,
            stepStartHeading: runtime.simulation.state.spacecraft.heading,
            stepStartTouchThrustControlEngaged: false,
            stepStartTargetHeadingSelectionEpoch: 0,
            stepStartTimeWarpMultiplier: 30,
          },
        },
      },
      {
        activePromptId: 'intro-complete',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'coach',
      id: 'intro-complete',
      layout: 'anchored',
      pausesGameplay: true,
    })
    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      id: 'intro-complete',
      layout: 'bottom',
      pausesGameplay: true,
    })
  })

  it('resolves replay labels from shortLabel or title and reopens replay prompts generically', () => {
    const runtime = createRuntime()
    runtime.scenario.session.promptUi = {
      activePromptId: null,
      replayPromptId: 'phase-two-intro',
    }

    expect(resolveScenarioPrompts(runtime, 'desktop').replay).toEqual({
      id: 'phase-two-intro',
      label: 'Reach the Moon',
    })
    expect(reopenScenarioReplayPrompt(runtime)).toBe(true)
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'phase-two-intro',
    )
  })

  it('handles builtin dismiss and dismiss_to_replay in one place', () => {
    const runtime = createRuntime()

    const dismissToReplay = dispatchScenarioPromptAction(runtime, {
      kind: 'builtin',
      id: 'dismiss_to_replay',
    })
    applyScenarioRuntimeTransition(runtime, dismissToReplay.transition)

    expect(dismissToReplay).toMatchObject({ handled: true })
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: null,
      replayPromptId: 'phase-one-intro',
    })

    runtime.scenario.session.promptUi.activePromptId = 'phase-two-intro'
    const dismiss = dispatchScenarioPromptAction(runtime, {
      kind: 'builtin',
      id: 'dismiss',
    })
    applyScenarioRuntimeTransition(runtime, dismiss.transition)

    expect(dismiss).toMatchObject({ handled: true })
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: null,
      replayPromptId: 'phase-one-intro',
    })
  })

  it('returns app-level effects for builtin navigation actions', () => {
    const runtime = createRuntime()
    runtime.scenario.session.promptUi.activePromptId = 'complete-intro'

    expect(
      dispatchScenarioPromptAction(runtime, {
        kind: 'builtin',
        id: 'start_free_roam',
      }),
    ).toMatchObject({
      handled: true,
      effect: 'start-free-roam',
    })
    runtime.scenario.session.promptUi.activePromptId = 'complete-intro'
    expect(
      dispatchScenarioPromptAction(runtime, {
        kind: 'builtin',
        id: 'exit_to_menu',
      }),
    ).toMatchObject({
      handled: true,
      effect: 'exit-to-menu',
    })
  })

  it('dispatches scenario-specific prompt actions through the scenario definition', () => {
    const runtime = createRuntime()

    const result = dispatchScenarioPromptAction(runtime, {
      kind: 'scenario',
      id: 'start-phase-one-onboarding',
    })
    applyScenarioRuntimeTransition(runtime, result.transition)

    expect(result).toMatchObject({ handled: true })
    expect(runtime.scenario.session.state).toMatchObject({
      onboarding: {
        activeStepId: 'intro-show-thrust-control',
        gateActive: true,
      },
    })
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: 'intro-show-thrust-control',
      replayPromptId: 'phase-one-intro',
    })
  })
})

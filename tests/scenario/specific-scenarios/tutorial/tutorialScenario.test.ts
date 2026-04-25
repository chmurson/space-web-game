import { describe, expect, it } from 'vitest'

import { EARTH_VIEWPORT_SIZE } from '@/domain/viewportPresets'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { applyScenarioRuntimeTransition } from '@/runtime/runtimeStateTransitions'
import { EARTH_MOON_DISTANCE, G } from '@/simulation/constants'
import { resolveRuntimeScenarioDirectives } from '@/scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '@/scenario/scenarioPrompts'
import { resolveCurrentScenarioScene } from '@/scenario/scenarioScenes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import { registerTutorialScenario } from '@/scenario/specific-scenarios/tutorial/tutorialScenario'

const globalScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: 48,
  defaultViewportSize: 520,
  maxViewportSize: 800,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 30, 60, 300, 1800, 3600, 7200, 18000],
}

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'off',
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

const setMoonOrbitState = (runtime: AppRuntimeState, angle: number) => {
  const moon = runtime.simulation.state.bodies.find(
    (body) => body.id === 'moon',
  )
  if (!moon) {
    throw new Error('Expected moon body in runtime.')
  }

  const orbitalRadius = moon.radius + 2_000_000
  const orbitalSpeed = Math.sqrt((G * moon.mass) / orbitalRadius)
  const tangent = { x: -Math.sin(angle), y: Math.cos(angle) }

  runtime.simulation.state.spacecraft.position = {
    x: moon.position.x + Math.cos(angle) * orbitalRadius,
    y: moon.position.y + Math.sin(angle) * orbitalRadius,
  }
  runtime.simulation.state.spacecraft.velocity = {
    x: moon.velocity.x + tangent.x * orbitalSpeed,
    y: moon.velocity.y + tangent.y * orbitalSpeed,
  }
}

const setEarthOrbitState = (runtime: AppRuntimeState, angle: number) => {
  const earth = runtime.simulation.state.bodies.find(
    (body) => body.id === 'earth',
  )
  if (!earth) {
    throw new Error('Expected earth body in runtime.')
  }

  const orbitalRadius = earth.radius + 2_000_000
  const orbitalSpeed = Math.sqrt((G * earth.mass) / orbitalRadius)
  const tangent = { x: -Math.sin(angle), y: Math.cos(angle) }

  runtime.simulation.state.spacecraft.position = {
    x: earth.position.x + Math.cos(angle) * orbitalRadius,
    y: earth.position.y + Math.sin(angle) * orbitalRadius,
  }
  runtime.simulation.state.spacecraft.velocity = {
    x: earth.velocity.x + tangent.x * orbitalSpeed,
    y: earth.velocity.y + tangent.y * orbitalSpeed,
  }
}

describe('tutorialScenario', () => {
  it('creates a tutorial session with explicit prompt UI state', () => {
    const tutorialScenario = registerTutorialScenario()
    const scenario = tutorialScenario.createScenario()

    expect(scenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      promptUi: {
        activePromptId: 'phase-one-intro',
        replayPromptId: null,
      },
      scenarioId: 'tutorial',
      state: { phase: 'escape-earth' },
    })
  })

  it('resolves the intro prompt from prompt definitions and keeps directives intact', () => {
    const tutorialScenario = registerTutorialScenario()
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      { phase: 'escape-earth' },
      {
        activePromptId: 'phase-one-intro',
        replayPromptId: null,
      },
    )
    if (!tutorialScenario.isState?.(runtime.scenario.session.state)) {
      throw new Error('Expected tutorial scenario state.')
    }
    const scene = tutorialScenario.getSceneDefinition(runtime.scenario.session.state)

    expect(
      scene.directives?.({
        limits: globalScenarioDirectiveLimits,
        state: runtime.scenario.session.state,
      }),
    ).toEqual({
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      forcedAssistTargetId: 'earth',
      hiddenBodyIds: ['moon'],
      hiddenUIElements: new Set(),
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 300,
      maxViewportSize: EARTH_VIEWPORT_SIZE,
      minViewportSize: null,
    })
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'blocking',
      title: 'Leave Earth Orbit',
      description:
        'Use thrust, turning, double-click heading, and the projected path. Fly far enough away from Earth to move on.',
    })
  })

  it('advances from phase 1 to phase 2 and activates the next prompt id', () => {
    const runtime = createRuntime()
    const resolvedScene = resolveCurrentScenarioScene(runtime)

    const transition =
      resolvedScene?.scene.advance?.({
        runtime,
        state: resolvedScene.state,
      }) ?? null
    applyScenarioRuntimeTransition(runtime, transition)

    expect(runtime.scenario.session.state).toEqual({
      phase: 'reach-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'phase-two-intro',
    )
    expect(runtime.scenario.session.checkpoint).not.toBeNull()
    expect(
      runtime.simulation.state.bodies.find((body) => body.id === 'moon')
        ?.position.y,
    ).toBeCloseTo(EARTH_MOON_DISTANCE, 6)
  })

  it('starts onboarding through prompt action handling and gates phase 1 directives', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      { phase: 'escape-earth' },
      {
        activePromptId: 'phase-one-intro',
        replayPromptId: null,
      },
    )
    const resolvedScene = resolveCurrentScenarioScene(runtime)

    const result =
      resolvedScene?.scene.actions?.['start-phase-one-onboarding']?.({
        runtime,
        state: resolvedScene.state,
      }) ?? { handled: false }
    applyScenarioRuntimeTransition(runtime, result.transition)

    expect(result).toMatchObject({ handled: true })
    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-thrust',
        gateActive: true,
      },
    })
    expect(runtime.scenario.session.promptUi).toEqual({
      activePromptId: 'intro-thrust',
      replayPromptId: 'phase-one-intro',
    })
    expect(
      resolveRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)
        .hiddenUIElements,
    ).toEqual(new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']))
  })

  it('resolves mobile onboarding prompts as coach prompts with touch hints', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession(
      'tutorial',
      {
        phase: 'escape-earth',
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
      },
      {
        activePromptId: 'intro-thrust',
        replayPromptId: 'phase-one-intro',
      },
    )

    expect(resolveScenarioPrompts(runtime, 'mobile').active).toMatchObject({
      kind: 'coach',
      title: 'Use Thrust',
      touchHintTarget: 'thrust-zone',
    })
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      kind: 'coach',
      title: 'Use Thrust',
    })
  })

  it('switches to moon orbit and then return-earth using prompt ids instead of pending prompt fields', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })

    setMoonOrbitState(runtime, 0)
    applyScenarioRuntimeTransition(
      runtime,
      resolveCurrentScenarioScene(runtime)?.scene.advance?.({
        runtime,
        state: runtime.scenario.session.state,
      }) ?? null,
    )
    expect(runtime.scenario.session.state).toEqual({
      phase: 'orbit-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'orbit-moon-intro',
    )

    runtime.scenario.session.promptUi.activePromptId = null
    const orbitAngles = [
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
    ]

    for (const angle of orbitAngles) {
      setMoonOrbitState(runtime, angle)
      applyScenarioRuntimeTransition(
        runtime,
        resolveCurrentScenarioScene(runtime)?.scene.advance?.({
          runtime,
          state: runtime.scenario.session.state,
        }) ?? null,
      )
    }

    expect(runtime.scenario.session.state).toEqual({
      phase: 'return-earth',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'phase-three-intro',
    )
  })

  it('completes the tutorial and activates the completion prompt', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'orbit-earth',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })

    const orbitAngles = [
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      0,
    ]

    for (const angle of orbitAngles) {
      setEarthOrbitState(runtime, angle)
      applyScenarioRuntimeTransition(
        runtime,
        resolveCurrentScenarioScene(runtime)?.scene.advance?.({
          runtime,
          state: runtime.scenario.session.state,
        }) ?? null,
      )
    }

    expect(runtime.scenario.session.completed).toBe(true)
    expect(runtime.scenario.session.state).toEqual({ phase: 'complete' })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'complete-intro',
    )
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      title: 'Tutorial Complete',
      buttons: [{ label: 'Free roam' }, { label: 'Exit' }],
    })
  })
})

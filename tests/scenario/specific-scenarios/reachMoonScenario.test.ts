import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '@/domain/viewportPresets'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { applyScenarioRuntimeTransition } from '@/runtime/runtimeStateTransitions'
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioStateFromId,
  type RuntimeScenarioOptions,
} from '@/scenario/runtimeScenario'
import { resolveRuntimeScenarioDirectives } from '@/scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '@/scenario/scenarioPrompts'
import { resolveCurrentScenarioScene } from '@/scenario/scenarioScenes'
import { G } from '@/simulation/constants'
import type { Body } from '@/simulation/types'

const runtimeScenarioOptions: RuntimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: 1,
  defaultViewportSize: 200,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minCoastPredictionHorizonHours: 0.5,
  minViewportSize: EARTH_VIEWPORT_SIZE,
}

const globalScenarioDirectiveLimits = {
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 50, 100, 500, 2000],
}

const createRuntime = (): AppRuntimeState => {
  const runtimeScenario = createRuntimeScenarioStateFromId(
    'reach-moon',
    runtimeScenarioOptions,
  )

  return {
    simulation: {
      assistMode: 'off',
      assistTargetIndex: 1,
      assistTargetSelectionMode: 'manual',
      coastPredictionHorizonHours: runtimeScenario.coastPredictionHorizonHours,
      crashedBodyName: null,
      state: runtimeScenario.state,
      targetHeading: null,
      targetHeadingTurn: null,
      timeWarpIndex: 0,
      viewportSize: runtimeScenario.viewportSize,
    },
    scenario: {
      directives: createDefaultScenarioDirectives(),
      metadata: {
        description: 'Reach the Moon description',
        title: 'Reach the Moon',
      },
      session: runtimeScenario.scenarioSession,
    },
    ui: {
      camera: {
        mode: runtimeScenario.cameraMode,
        panOffset: runtimeScenario.state.spacecraft.position,
      },
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
  }
}

const getBody = (runtime: AppRuntimeState, bodyId: 'earth' | 'moon'): Body => {
  const body = runtime.simulation.state.bodies.find(({ id }) => id === bodyId)
  if (!body) {
    throw new Error(`Expected ${bodyId} body in runtime.`)
  }

  return body
}

const setOrbitState = (
  runtime: AppRuntimeState,
  bodyId: 'earth' | 'moon',
  angle: number,
  options: {
    bound?: boolean
    orbitalRadius?: number
  } = {},
) => {
  const body = getBody(runtime, bodyId)
  const orbitalRadius = options.orbitalRadius ?? body.radius + 2_000_000
  const circularSpeed = Math.sqrt((G * body.mass) / orbitalRadius)
  const speed = options.bound === false ? circularSpeed * 1.8 : circularSpeed
  const tangent = { x: -Math.sin(angle), y: Math.cos(angle) }

  runtime.simulation.state.spacecraft.position = {
    x: body.position.x + Math.cos(angle) * orbitalRadius,
    y: body.position.y + Math.sin(angle) * orbitalRadius,
  }
  runtime.simulation.state.spacecraft.velocity = {
    x: body.velocity.x + tangent.x * speed,
    y: body.velocity.y + tangent.y * speed,
  }
}

const advanceScenario = (runtime: AppRuntimeState) => {
  const resolvedScene = resolveCurrentScenarioScene(runtime)
  const transition =
    resolvedScene?.scene.advance?.({
      runtime,
      state: resolvedScene.state,
    }) ?? null

  applyScenarioRuntimeTransition(runtime, transition)
  return transition
}

const completeOrbitTurns = (
  runtime: AppRuntimeState,
  bodyId: 'earth' | 'moon',
  turns: number,
) => {
  const angles = [0]
  for (let turn = 0; turn < turns; turn += 1) {
    angles.push(Math.PI / 2, Math.PI, -Math.PI / 2, 0)
  }

  for (const angle of angles) {
    setOrbitState(runtime, bodyId, angle)
    advanceScenario(runtime)
  }
}

describe('reachMoonScenario', () => {
  it('creates a finite-fuel mission with explicit objective state', () => {
    const scenario = createRequestedRuntimeScenario('reach-moon')

    expect(scenario.id).toBe('reach-moon')
    expect(scenario.spacecraft.fuelCapacity).toBe(32_000)
    expect(scenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      promptUi: {
        activePromptId: 'mission-start',
        replayPromptId: null,
      },
      scenarioId: 'reach-moon',
      state: { phase: 'reach-moon' },
    })
  })

  it('resolves the initial mission prompt from prompt definitions', () => {
    const runtime = createRuntime()

    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      id: 'mission-start',
      kind: 'blocking',
      title: 'Reach the Moon',
      buttons: [{ label: 'Start mission' }],
    })
  })

  it('advances through Moon reach, three lunar orbits, Earth return, and one Earth orbit', () => {
    const runtime = createRuntime()

    expect(runtime.scenario.session.state).toEqual({ phase: 'reach-moon' })
    expect(
      resolveRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)
        .forcedAssistTargetId,
    ).toBeNull()

    setOrbitState(runtime, 'moon', 0)
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toEqual({
      phase: 'orbit-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'moon-reached',
    )

    completeOrbitTurns(runtime, 'moon', 3)

    expect(runtime.scenario.session.state).toEqual({
      phase: 'return-earth',
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'lunar-orbits-complete',
    )

    setOrbitState(runtime, 'earth', 0)
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toEqual({
      phase: 'orbit-earth',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'earth-reached',
    )
    expect(
      resolveRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)
        .forcedAssistTargetId,
    ).toBeNull()

    completeOrbitTurns(runtime, 'earth', 1)

    expect(runtime.scenario.session.completed).toBe(true)
    expect(runtime.scenario.session.state).toEqual({ phase: 'complete' })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'mission-complete',
    )
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      title: 'Mission Complete',
      buttons: [{ label: 'Free roam' }, { label: 'Exit' }],
    })
  })

  it('does not count angular backtracking as completed lunar orbits', () => {
    const runtime = createRuntime()
    runtime.scenario.session.state = {
      phase: 'orbit-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    }

    for (const angle of [0, Math.PI / 2, 0, Math.PI / 2, 0, Math.PI / 2, 0]) {
      setOrbitState(runtime, 'moon', angle)
      advanceScenario(runtime)
    }

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'orbit-moon',
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.completed).toBe(false)
  })

  it('resets orbit progress while the spacecraft is not bound to the target', () => {
    const runtime = createRuntime()
    runtime.scenario.session.state = {
      phase: 'orbit-earth',
      orbitProgressRadians: Math.PI,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: 0,
    }

    setOrbitState(runtime, 'earth', Math.PI / 2, { bound: false })
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'orbit-earth',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: Math.PI / 2,
    })
    expect(runtime.scenario.session.completed).toBe(false)
  })

  it('resets orbit progress outside the objective radius', () => {
    const runtime = createRuntime()
    runtime.scenario.session.state = {
      phase: 'orbit-moon',
      orbitProgressRadians: Math.PI,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: 0,
    }
    const moon = getBody(runtime, 'moon')

    setOrbitState(runtime, 'moon', Math.PI / 2, {
      orbitalRadius: moon.radius * 40,
    })
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'orbit-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: Math.PI / 2,
    })
    expect(runtime.scenario.session.completed).toBe(false)
  })

  it('keeps the mission in approach phase until the Moon objective area is reached', () => {
    const runtime = createRuntime()

    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toEqual({ phase: 'reach-moon' })
  })
})

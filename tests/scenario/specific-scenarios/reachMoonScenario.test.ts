import { describe, expect, it } from 'vitest'

import { gameConfig } from '@/config/gameConfig'
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
import {
  applyRuntimeScenarioDirectiveConstraints,
  getConstrainedTimeWarpIndex,
  resolveRuntimeScenarioDirectives,
} from '@/scenario/scenarioDirectives'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import {
  getPromptTextContent,
  resolveScenarioPrompts,
} from '@/scenario/scenarioPrompts'
import { resolveCurrentScenarioScene } from '@/scenario/scenarioScenes'
import { getReachMoonCompletedHighscorePayload } from '@/scenario/specific-scenarios/reachMoonScenario'
import { G } from '@/simulation/constants'
import type { Body } from '@/simulation/types'
import {
  reachMoonCompletedRunInput,
  reachMoonCompletedRunScore,
} from '../../fixtures/reachMoonCompletedRun'

const neutralLunarOrbitQuality = {
  orbitApoapsisAltitudeMeters: 2_000_000,
  orbitPeriapsisAltitudeMeters: 2_000_000,
}
const neutralLunarOrbitCompletedRunInput = {
  ...reachMoonCompletedRunInput,
  lunarOrbitQuality: neutralLunarOrbitQuality,
}
const neutralLunarOrbitCompletedRunScore = {
  ...reachMoonCompletedRunScore,
  lunarOrbitCircularityPoints: 25,
  lunarOrbitEccentricity: 0,
  lunarOrbitQuality: neutralLunarOrbitQuality,
  lunarOrbitQualityPoints: 25,
  totalScore: 196.2,
}
const neutralLunarOrbitCompletedRunHighscore = {
  input: neutralLunarOrbitCompletedRunInput,
  score: neutralLunarOrbitCompletedRunScore,
}

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
  timeWarps: [...gameConfig.controls.timeWarps],
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

  it('uses the global time warp cap while preserving the mission viewport directive', () => {
    const runtime = createRuntime()
    const globalMaxTimeWarpIndex =
      globalScenarioDirectiveLimits.timeWarps.length - 1
    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives.maxCoastPredictionHorizonHours).toBeNull()
    expect(directives.maxTimeWarp).toBeNull()
    expect(directives.maxViewportSize).toBe(EARTH_MOON_VIEWPORT_SIZE)
    expect(
      globalScenarioDirectiveLimits.timeWarps[globalMaxTimeWarpIndex],
    ).toBe(18_000)
    expect(
      getConstrainedTimeWarpIndex(
        globalMaxTimeWarpIndex,
        globalScenarioDirectiveLimits.timeWarps,
        directives.maxTimeWarp,
      ),
    ).toBe(globalMaxTimeWarpIndex)
  })

  it('resolves the initial mission prompt from prompt definitions', () => {
    const runtime = createRuntime()
    const prompt = resolveScenarioPrompts(runtime, 'desktop').active

    expect(prompt).toMatchObject({
      id: 'mission-start',
      kind: 'blocking',
      title: 'Reach the Moon',
      buttons: [{ label: 'Start mission' }],
    })
    expect(prompt?.description).toEqual([
      'Launch from ',
      { text: 'Earth', tone: 'concept' },
      ', reach the ',
      { text: 'Moon', tone: 'concept' },
      ', complete ',
      { text: 'three lunar orbits', tone: 'number' },
      ', return to Earth, then complete one final Earth orbit. ',
      { text: 'Fuel is finite', tone: 'constraint' },
      ', so keep burns deliberate.',
    ])
    expect(getPromptTextContent(prompt?.description)).toBe(
      'Launch from Earth, reach the Moon, complete three lunar orbits, return to Earth, then complete one final Earth orbit. Fuel is finite, so keep burns deliberate.',
    )
  })

  it('uses the global trajectory horizon cap for mission directives', () => {
    const runtime = createRuntime()
    const limits = {
      ...globalScenarioDirectiveLimits,
      maxCoastPredictionHorizonHours: 768,
    }

    const directives = resolveRuntimeScenarioDirectives(runtime, limits)

    expect(directives.maxCoastPredictionHorizonHours).toBeNull()

    runtime.scenario.directives = directives
    runtime.simulation.coastPredictionHorizonHours = 800

    applyRuntimeScenarioDirectiveConstraints(runtime, limits)

    expect(runtime.simulation.coastPredictionHorizonHours).toBe(768)
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
      currentOrbitApoapsisAltitudeMeters: 2_000_000,
      currentOrbitPeriapsisAltitudeMeters: 2_000_000,
      phase: 'orbit-moon',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'safe-lunar-orbit-bonus',
    )
    expect(
      getPromptTextContent(
        resolveScenarioPrompts(runtime, 'desktop').active?.description,
      ),
    ).toBe(
      'Close lunar orbits can earn bonus points during this phase. Keep apoapsis low and the orbit near circular, but dipping below 25 km periapsis is risky and can cost points.',
    )

    completeOrbitTurns(runtime, 'moon', 3)

    expect(runtime.scenario.session.state).toEqual({
      bestLunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 2_000_000,
        orbitPeriapsisAltitudeMeters: 2_000_000,
      },
      phase: 'return-earth',
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'lunar-orbits-complete',
    )
    expect(
      getPromptTextContent(
        resolveScenarioPrompts(runtime, 'desktop').active?.description,
      ),
    ).toBe(
      'Three lunar orbits are complete. Head back toward Earth and enter the Earth objective zone.',
    )

    setOrbitState(runtime, 'earth', 0)
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toEqual({
      bestLunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 2_000_000,
        orbitPeriapsisAltitudeMeters: 2_000_000,
      },
      phase: 'orbit-earth',
      orbitProgressRadians: 0,
      orbitTurnsCompleted: 0,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'earth-reached',
    )
    expect(
      getPromptTextContent(
        resolveScenarioPrompts(runtime, 'desktop').active?.description,
      ),
    ).toBe(
      'You are back in Earth range. Complete one bound Earth orbit to finish the mission.',
    )
    expect(
      resolveRuntimeScenarioDirectives(runtime, globalScenarioDirectiveLimits)
        .forcedAssistTargetId,
    ).toBeNull()

    runtime.simulation.state.elapsed = 90_000
    runtime.simulation.state.spacecraft.fuel = 0.5
    completeOrbitTurns(runtime, 'earth', 1)

    expect(runtime.scenario.session.completed).toBe(true)
    expect(runtime.scenario.session.state).toEqual({
      bestLunarOrbitQuality: neutralLunarOrbitQuality,
      phase: 'complete',
      highscore: neutralLunarOrbitCompletedRunHighscore,
      score: neutralLunarOrbitCompletedRunScore,
    })
    expect(getReachMoonCompletedHighscorePayload(runtime)).toEqual({
      input: neutralLunarOrbitCompletedRunInput,
      score: neutralLunarOrbitCompletedRunScore,
    })
    expect(runtime.scenario.session.promptUi.activePromptId).toBe(
      'mission-complete',
    )
    expect(resolveScenarioPrompts(runtime, 'desktop').active).toMatchObject({
      title: 'Mission Complete',
      description:
        'Score 196.2. Time used 1d 1h (+49.7). Fuel left 50% (+121.5). Lunar orbit Ap 2,000 km / Pe 2,000 km - near circular (25).',
      buttons: [{ label: 'Highscores' }, { label: 'Free roam' }],
    })
    expect(
      getPromptTextContent(
        resolveScenarioPrompts(runtime, 'desktop').active?.description,
      ),
    ).toBe(
      'Score 196.2. Time used 1d 1h (+49.7). Fuel left 50% (+121.5). Lunar orbit Ap 2,000 km / Pe 2,000 km - near circular (25).',
    )
  })

  it('keeps the best completed lunar orbit quality and emits only improved notices', () => {
    const runtime = createRuntime()
    const moon = getBody(runtime, 'moon')
    runtime.scenario.session.state = {
      currentOrbitApoapsisAltitudeMeters: 600_000,
      currentOrbitPeriapsisAltitudeMeters: 600_000,
      phase: 'orbit-moon',
      orbitProgressRadians: Math.PI * 1.75,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: -Math.PI / 2,
    }

    setOrbitState(runtime, 'moon', 0, { orbitalRadius: moon.radius + 600_000 })
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toMatchObject({
      bestLunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 600_000,
        orbitPeriapsisAltitudeMeters: 600_000,
      },
      orbitTurnsCompleted: 1,
      phase: 'orbit-moon',
    })
    expect(runtime.ui.transientNotice).toMatchObject({
      body: 'Ap 600 km - Pe 600 km - near circular',
      title: 'Excellent lunar orbit recorded',
    })

    runtime.scenario.session.state = {
      ...(runtime.scenario.session.state as Record<string, unknown>),
      currentOrbitApoapsisAltitudeMeters: 90_000,
      currentOrbitPeriapsisAltitudeMeters: 25_000,
      orbitProgressRadians: Math.PI * 3.75,
      orbitTurnsCompleted: 1,
      previousOrbitAngle: -Math.PI / 2,
    }
    setOrbitState(runtime, 'moon', 0, { orbitalRadius: moon.radius + 90_000 })
    advanceScenario(runtime)

    expect(runtime.scenario.session.state).toMatchObject({
      bestLunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 90_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      },
      orbitTurnsCompleted: 2,
      phase: 'orbit-moon',
    })
    expect(runtime.ui.transientNotice).toMatchObject({
      body: 'Ap 90 km - Pe 25 km - near circular',
      title: 'Excellent lunar orbit recorded',
    })

    const previousNotice = runtime.ui.transientNotice
    runtime.scenario.session.state = {
      ...(runtime.scenario.session.state as Record<string, unknown>),
      currentOrbitApoapsisAltitudeMeters: 800_000,
      currentOrbitPeriapsisAltitudeMeters: 25_000,
      orbitProgressRadians: Math.PI * 5.75,
      orbitTurnsCompleted: 2,
      previousOrbitAngle: -Math.PI / 2,
    }
    setOrbitState(runtime, 'moon', 0, { orbitalRadius: moon.radius + 800_000 })
    advanceScenario(runtime)

    expect(runtime.ui.transientNotice).toBe(previousNotice)
    expect(runtime.scenario.session.state).toMatchObject({
      bestLunarOrbitQuality: {
        orbitApoapsisAltitudeMeters: 90_000,
        orbitPeriapsisAltitudeMeters: 25_000,
      },
      phase: 'return-earth',
    })
  })

  it.each([
    [
      'risky low periapsis',
      100_000,
      6_000,
      {
        body: 'Pe 6 km - too close to the Moon',
        title: 'Risky lunar orbit recorded',
      },
    ],
    [
      'high but circular',
      1_400_000,
      1_250_000,
      {
        body: 'Ap 1,400 km - Pe 1,250 km - higher than ideal',
        title: 'Circular lunar orbit recorded',
      },
    ],
    [
      'close but elongated',
      620_000,
      210_000,
      {
        body: 'Ap 620 km - Pe 210 km - elongated',
        title: 'Close lunar orbit recorded',
      },
    ],
  ])('uses the combined lunar orbit notice category for %s', (_label, apoapsis, periapsis, notice) => {
    const runtime = createRuntime()
    const moon = getBody(runtime, 'moon')
    runtime.scenario.session.state = {
      currentOrbitApoapsisAltitudeMeters: apoapsis,
      currentOrbitPeriapsisAltitudeMeters: periapsis,
      phase: 'orbit-moon',
      orbitProgressRadians: Math.PI * 1.75,
      orbitTurnsCompleted: 0,
      previousOrbitAngle: -Math.PI / 2,
    }

    setOrbitState(runtime, 'moon', 0, {
      orbitalRadius: moon.radius + apoapsis,
    })
    advanceScenario(runtime)

    expect(runtime.ui.transientNotice).toMatchObject(notice)
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

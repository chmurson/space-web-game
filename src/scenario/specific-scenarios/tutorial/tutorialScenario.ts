import { getCaptureMetricsForState } from '../../../assist/orbitalAssist'
import { gameConfig } from '../../../config/gameConfig'
import type { RuntimeScenario } from '../../../debugScenarioSnapshot'
import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../../../domain/viewportPresets'
import type { AppRuntimeState } from '../../../runtime/appRuntimeState'
import {
  EARTH_MOON_DISTANCE,
  EARTH_RADIUS,
  G,
} from '../../../simulation/constants'
import { createEarthMoonScenario } from '../../../simulation/scenarios/earthMoon'
import {
  add,
  length,
  normalize,
  scale,
  sub,
  vec,
} from '../../../simulation/vector'
import {
  createDefaultScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
  type RuntimeScenarioDirectives,
} from '../../scenarioDirectiveTypes'
import type {
  RuntimeScenarioDefinition,
  ScenarioPromptActionDispatchResult,
} from '../../scenarioRegistry'
import type { PromptDefinition } from '../../scenarioPromptTypes'
import type { ScenarioRuntimeTransition } from '../../scenarioRuntimeTransition'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
  type RuntimeScenarioCheckpoint,
  type ScenarioPromptUiState,
} from '../../scenarioSession'
import {
  getHiddenOnboardingUIElements,
  getTutorialOnboardingPromptDefinitions,
  tutorialOnboardingStepOrder,
} from './tutorialOnboarding/tutorialOnboardingFlow'
import {
  acknowledgeTutorialOnboardingPrompt,
  advanceTutorialOnboarding,
  createTutorialOnboardingState,
} from './tutorialOnboarding/tutorialOnboardingProgress'
import type { TutorialOnboardingState } from './tutorialOnboarding/tutorialOnboardingTypes'

type TutorialScenarioPhase =
  | 'escape-earth'
  | 'reach-moon'
  | 'orbit-moon'
  | 'return-earth'
  | 'orbit-earth'
  | 'complete'

export type TutorialScenarioState = {
  onboarding?: TutorialOnboardingState
  orbitProgressRadians?: number
  orbitTurnsCompleted?: number
  previousOrbitAngle?: number
  phase: TutorialScenarioPhase
}

const requiredMoonOrbitTurns = 3
const fullTurnRadians = Math.PI * 2
const earthOrbitPhaseThresholdRadiusMultiplier = 20
const moonOrbitPhaseThresholdRadiusMultiplier = 35
const tutorialTimeWarps = gameConfig.controls.timeWarps
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const createTutorialScenarioSession = (
  state: TutorialScenarioState = {
    phase: 'escape-earth',
  },
) =>
  createRuntimeScenarioSession('tutorial', state, {
    activePromptId: 'phase-one-intro',
    replayPromptId: null,
  })

const isTutorialScenarioState = (
  value: unknown,
): value is TutorialScenarioState =>
  typeof value === 'object' &&
  value !== null &&
  'phase' in value &&
  (value.phase === 'escape-earth' ||
    value.phase === 'reach-moon' ||
    value.phase === 'orbit-moon' ||
    value.phase === 'orbit-earth' ||
    value.phase === 'return-earth' ||
    value.phase === 'complete')

const getTutorialScenarioState = (
  runtime: AppRuntimeState,
): TutorialScenarioState | null =>
  isTutorialScenarioState(runtime.scenario.session.state)
    ? runtime.scenario.session.state
    : null

const createTutorialScenario = (): RuntimeScenario => {
  const scenario = createEarthMoonScenario()

  return {
    ...scenario,
    id: 'tutorial',
    name: 'Tutorial: Escape Earth',
    description: "Leave low Earth orbit and break free from Earth's pull.",
    coastPredictionHorizonHours: 2,
    scenarioSession: createTutorialScenarioSession(),
  }
}

const getTutorialScenarioDirectives = (
  state: TutorialScenarioState,
  _limits: GlobalScenarioDirectiveLimits,
): RuntimeScenarioDirectives => {
  if (state.phase === 'escape-earth') {
    return {
      ...createDefaultScenarioDirectives(),
      forcedAssistTargetId: 'earth',
      hiddenBodyIds: ['moon'],
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 500,
      maxViewportSize: EARTH_VIEWPORT_SIZE,
      hiddenUIElements: getHiddenOnboardingUIElements(state.onboarding),
    }
  }

  if (state.phase === 'reach-moon' || state.phase === 'orbit-moon') {
    return {
      ...createDefaultScenarioDirectives(),
      forcedAssistTargetId: 'moon',
      maxCoastPredictionHorizonHours: 24,
      maxTimeWarp: 2000,
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }
  }

  if (state.phase === 'return-earth' || state.phase === 'orbit-earth') {
    return {
      ...createDefaultScenarioDirectives(),
      forcedAssistTargetId: 'earth',
      maxCoastPredictionHorizonHours: 24,
      maxTimeWarp: 2000,
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }
  }

  return createDefaultScenarioDirectives()
}

const getTutorialHudContent = (state: TutorialScenarioState) => {
  if (state.phase === 'escape-earth') {
    return {
      title: 'Tutorial: Escape Earth',
      description:
        'Build an outbound path and get at least five Earth radii away from the planet.',
    }
  }

  if (state.phase === 'reach-moon') {
    return {
      title: 'Tutorial: Reach the Moon',
      description:
        'Approach the Moon and get close enough to begin the orbit phase.',
    }
  }

  if (state.phase === 'orbit-moon') {
    const completedTurns = Math.min(
      requiredMoonOrbitTurns,
      state.orbitTurnsCompleted ?? 0,
    )
    return {
      title: 'Tutorial: Orbit the Moon',
      description: `Stay captured and complete ${requiredMoonOrbitTurns} turns around the Moon (${completedTurns}/${requiredMoonOrbitTurns}).`,
    }
  }

  if (state.phase === 'return-earth') {
    return {
      title: 'Tutorial: Return to Earth',
      description:
        'Leave the Moon behind and get close enough to Earth to begin the final orbit phase.',
    }
  }

  if (state.phase === 'orbit-earth') {
    const completedTurns = Math.min(
      requiredMoonOrbitTurns,
      state.orbitTurnsCompleted ?? 0,
    )
    return {
      title: 'Tutorial: Orbit Earth',
      description: `Stabilize your return and complete ${requiredMoonOrbitTurns} turns around Earth (${completedTurns}/${requiredMoonOrbitTurns}).`,
    }
  }

  return {
    title: 'Tutorial Complete',
    description: 'You reached the end of the current tutorial flow.',
  }
}

const tutorialPromptDefinitions = {
  'phase-one-intro': {
    id: 'phase-one-intro',
    title: 'Leave Earth Orbit',
    shortLabel: 'Leave Earth Orbit',
    description:
      'Use thrust, turning, double-click heading, and the projected path. Fly far enough away from Earth to move on.',
    buttons: [
      {
        action: { kind: 'scenario', id: 'start-phase-one-onboarding' },
        label: 'Start',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'phase-two-intro': {
    id: 'phase-two-intro',
    title: 'Reach the Moon',
    shortLabel: 'Reach the Moon',
    description:
      'The Moon is now your target. You can zoom out more and look farther ahead. Use that to line up an approach.',
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'orbit-moon-intro': {
    id: 'orbit-moon-intro',
    title: 'Approach the Moon',
    shortLabel: 'Approach the Moon',
    description:
      'You are close to the Moon. Orbit around it three times to complete the lunar phase of the tutorial.',
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'phase-three-intro': {
    id: 'phase-three-intro',
    title: 'Return to Earth',
    shortLabel: 'Return to Earth',
    description:
      'You have completed three lunar orbits. The next goal is to head back toward Earth and get close enough to start the final orbit.',
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'orbit-earth-intro': {
    id: 'orbit-earth-intro',
    title: 'Back at Earth',
    shortLabel: 'Back at Earth',
    description:
      'You are back in Earth range. Stabilize and complete three Earth orbits to finish the tutorial.',
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'complete-intro': {
    id: 'complete-intro',
    title: 'Tutorial Complete',
    shortLabel: 'Tutorial Complete',
    description:
      'You completed the Earth-Moon round trip. Start free roam immediately or return to the main menu.',
    buttons: [
      {
        action: { kind: 'builtin', id: 'start_free_roam' },
        label: 'Free roam',
        tone: 'primary',
      },
      {
        action: { kind: 'builtin', id: 'exit_to_menu' },
        label: 'Exit',
        tone: 'secondary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  ...getTutorialOnboardingPromptDefinitions(),
} satisfies Record<string, PromptDefinition>

const isTutorialOnboardingPromptId = (
  promptId: string | null,
): promptId is NonNullable<TutorialOnboardingState['activeStepId']> =>
  tutorialOnboardingStepOrder.includes(
    promptId as NonNullable<TutorialOnboardingState['activeStepId']>,
  )

const getTutorialPromptUiForOnboarding = (
  state: TutorialScenarioState,
  currentPromptUi: ScenarioPromptUiState,
): ScenarioPromptUiState => {
  if (state.onboarding?.gateActive && state.onboarding.activeStepId) {
    return {
      ...currentPromptUi,
      activePromptId: state.onboarding.activeStepId,
    }
  }

  if (isTutorialOnboardingPromptId(currentPromptUi.activePromptId)) {
    return {
      ...currentPromptUi,
      activePromptId: null,
    }
  }

  return currentPromptUi
}

const positionMoonForPhaseTwo = (runtime: AppRuntimeState) => {
  const earth = runtime.simulation.state.bodies.find(
    (body) => body.id === 'earth',
  )
  const moon = runtime.simulation.state.bodies.find(
    (body) => body.id === 'moon',
  )
  if (!earth || !moon) {
    return
  }

  const spacecraftRelativeVelocity = sub(
    runtime.simulation.state.spacecraft.velocity,
    earth.velocity,
  )
  const outboundReference =
    length(spacecraftRelativeVelocity) > 1
      ? spacecraftRelativeVelocity
      : sub(runtime.simulation.state.spacecraft.position, earth.position)
  const outboundDirection = normalize(outboundReference)
  const moonDirection =
    length(outboundDirection) > 0 ? outboundDirection : vec(1, 0)
  const tangentialDirection = {
    x: -moonDirection.y,
    y: moonDirection.x,
  }
  const moonOrbitSpeed = Math.sqrt((G * earth.mass) / EARTH_MOON_DISTANCE)

  moon.position = add(earth.position, scale(moonDirection, EARTH_MOON_DISTANCE))
  moon.velocity = add(
    earth.velocity,
    scale(tangentialDirection, moonOrbitSpeed),
  )
}

const createDefaultRuntimeScenarioSession = (
  runtime: AppRuntimeState,
): RuntimeScenarioCheckpoint => {
  return createRuntimeScenarioCheckpoint({
    assistMode: runtime.simulation.assistMode,
    assistTargetIndex: runtime.simulation.assistTargetIndex,
    coastPredictionHorizonHours: runtime.simulation.coastPredictionHorizonHours,
    targetHeading: runtime.simulation.targetHeading,
    viewportSize: runtime.simulation.viewportSize,
    world: runtime.simulation.state,
  })
}

const createOrbitProgressState = (): Pick<
  TutorialScenarioState,
  'orbitProgressRadians' | 'orbitTurnsCompleted'
> => ({
  orbitProgressRadians: 0,
  orbitTurnsCompleted: 0,
})

const createTutorialTransition = (
  state: TutorialScenarioState,
  options: {
    checkpoint?: RuntimeScenarioCheckpoint | null
    completed?: boolean
    promptUi?: ScenarioPromptUiState
  } = {},
): ScenarioRuntimeTransition<TutorialScenarioState> => ({
  checkpoint: options.checkpoint,
  completed: options.completed,
  nextState: state,
  promptUi: options.promptUi,
})

const isWithinOrbitPhaseThreshold = (
  runtime: AppRuntimeState,
  targetId: 'earth' | 'moon',
) => {
  const target = runtime.simulation.state.bodies.find(
    (body) => body.id === targetId,
  )
  if (!target) {
    return false
  }

  const captureMetrics = getCaptureMetricsForState(
    runtime.simulation.state,
    target,
  )
  const radiusMultiplier =
    targetId === 'earth'
      ? earthOrbitPhaseThresholdRadiusMultiplier
      : moonOrbitPhaseThresholdRadiusMultiplier
  return captureMetrics.distance < target.radius * radiusMultiplier
}

const advanceOrbitPhase = (
  runtime: AppRuntimeState,
  state: TutorialScenarioState,
  targetId: 'earth' | 'moon',
): ScenarioRuntimeTransition<TutorialScenarioState> | null => {
  const target = runtime.simulation.state.bodies.find(
    (body) => body.id === targetId,
  )
  if (!target) {
    return null
  }

  const captureMetrics = getCaptureMetricsForState(
    runtime.simulation.state,
    target,
  )
  const orbitAngle = Math.atan2(
    runtime.simulation.state.spacecraft.position.y - target.position.y,
    runtime.simulation.state.spacecraft.position.x - target.position.x,
  )
  const previousOrbitAngle = state.previousOrbitAngle

  if (captureMetrics.specificEnergy >= 0) {
    return createTutorialTransition({
      ...state,
      ...createOrbitProgressState(),
      previousOrbitAngle: orbitAngle,
    })
  }

  const additionalProgress =
    typeof previousOrbitAngle === 'number'
      ? Math.abs(normalizeAngleDelta(orbitAngle - previousOrbitAngle))
      : 0
  const orbitProgressRadians =
    (state.orbitProgressRadians ?? 0) + additionalProgress
  const orbitTurnsCompleted = Math.floor(orbitProgressRadians / fullTurnRadians)

  return createTutorialTransition(
    {
      ...state,
      orbitProgressRadians,
      orbitTurnsCompleted,
      previousOrbitAngle: orbitAngle,
    },
    { completed: orbitTurnsCompleted >= requiredMoonOrbitTurns },
  )
}

const advanceTutorialScenario = (
  runtime: AppRuntimeState,
): ScenarioRuntimeTransition<TutorialScenarioState> | null => {
  const state = getTutorialScenarioState(runtime)
  if (!state) {
    return null
  }

  let nextState = state

  if (nextState.phase === 'escape-earth') {
    const onboarding = nextState.onboarding
    if (onboarding?.gateActive) {
      const advancedOnboarding = advanceTutorialOnboarding(
        runtime,
        onboarding,
        performance.now(),
        tutorialTimeWarps[runtime.simulation.timeWarpIndex] ??
          tutorialTimeWarps[0] ??
          1,
      )
      nextState = {
        ...nextState,
        onboarding: advancedOnboarding,
      }
      if (advancedOnboarding.gateActive) {
        return createTutorialTransition(nextState, {
          promptUi: getTutorialPromptUiForOnboarding(
            nextState,
            runtime.scenario.session.promptUi,
          ),
        })
      }
    }

    const earth = runtime.simulation.state.bodies.find(
      (body) => body.id === 'earth',
    )
    if (!earth) {
      return null
    }

    const distanceFromEarth = length(
      sub(runtime.simulation.state.spacecraft.position, earth.position),
    )
    if (distanceFromEarth < EARTH_RADIUS * 5) {
      return null
    }

    positionMoonForPhaseTwo(runtime)

    return createTutorialTransition(
      {
        phase: 'reach-moon',
        ...createOrbitProgressState(),
      },
      {
        checkpoint: createDefaultRuntimeScenarioSession(runtime),
        promptUi: {
          ...runtime.scenario.session.promptUi,
          activePromptId: 'phase-two-intro',
        },
      },
    )
  }

  if (state.phase === 'reach-moon') {
    if (isWithinOrbitPhaseThreshold(runtime, 'moon')) {
      return createTutorialTransition(
        {
          ...nextState,
          ...createOrbitProgressState(),
          phase: 'orbit-moon',
        },
        {
          checkpoint: createDefaultRuntimeScenarioSession(runtime),
          promptUi: {
            ...runtime.scenario.session.promptUi,
            activePromptId: 'orbit-moon-intro',
          },
        },
      )
    }

    return null
  }

  if (state.phase === 'orbit-moon') {
    const orbitProgress = advanceOrbitPhase(runtime, nextState, 'moon')
    if (!orbitProgress?.completed) {
      return orbitProgress
    }

    return createTutorialTransition(
      {
        phase: 'return-earth',
        ...createOrbitProgressState(),
      },
      {
        checkpoint: createDefaultRuntimeScenarioSession(runtime),
        promptUi: {
          ...runtime.scenario.session.promptUi,
          activePromptId: 'phase-three-intro',
        },
      },
    )
  }

  if (state.phase === 'return-earth') {
    if (isWithinOrbitPhaseThreshold(runtime, 'earth')) {
      return createTutorialTransition(
        {
          ...nextState,
          ...createOrbitProgressState(),
          phase: 'orbit-earth',
        },
        {
          checkpoint: createDefaultRuntimeScenarioSession(runtime),
          promptUi: {
            ...runtime.scenario.session.promptUi,
            activePromptId: 'orbit-earth-intro',
          },
        },
      )
    }
    return null
  }

  if (state.phase === 'orbit-earth') {
    const orbitProgress = advanceOrbitPhase(runtime, state, 'earth')
    if (!orbitProgress?.completed) {
      return orbitProgress
    }

    return createTutorialTransition(
      {
        phase: 'complete',
      },
      {
        checkpoint: createDefaultRuntimeScenarioSession(runtime),
        completed: true,
        promptUi: {
          ...runtime.scenario.session.promptUi,
          activePromptId: 'complete-intro',
        },
      },
    )
  }

  return null
}

const handleTutorialPromptAction = (
  runtime: AppRuntimeState,
  actionId: string,
): ScenarioPromptActionDispatchResult<TutorialScenarioState> => {
  const state = getTutorialScenarioState(runtime)
  if (!state) {
    return { handled: false }
  }

  if (
    actionId === 'start-phase-one-onboarding' &&
    runtime.scenario.session.promptUi.activePromptId === 'phase-one-intro'
  ) {
    const nextOnboarding = createTutorialOnboardingState(
      runtime,
      performance.now(),
      tutorialTimeWarps[runtime.simulation.timeWarpIndex] ??
        tutorialTimeWarps[0] ??
        1,
    )

    return {
      handled: true,
      transition: createTutorialTransition(
        {
          ...state,
          onboarding: nextOnboarding,
        },
        {
          promptUi: {
            activePromptId: nextOnboarding.activeStepId,
            replayPromptId: 'phase-one-intro',
          },
        },
      ),
    }
  }

  const activeOnboarding = state.onboarding
  if (actionId === 'advance-onboarding-step' && activeOnboarding?.gateActive) {
    const acknowledgedOnboarding = acknowledgeTutorialOnboardingPrompt(
      runtime,
      activeOnboarding,
      performance.now(),
      tutorialTimeWarps[runtime.simulation.timeWarpIndex] ??
        tutorialTimeWarps[0] ??
        1,
    )

    if (!acknowledgedOnboarding) {
      return { handled: false }
    }

    return {
      handled: true,
      transition: createTutorialTransition(
        {
          ...state,
          onboarding: acknowledgedOnboarding,
        },
        {
          promptUi: getTutorialPromptUiForOnboarding(
            {
              ...state,
              onboarding: acknowledgedOnboarding,
            },
            runtime.scenario.session.promptUi,
          ),
        },
      ),
    }
  }

  return { handled: false }
}

export const registerTutorialScenario =
  (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
    advance: advanceTutorialScenario,
    id: 'tutorial',
    createScenario: createTutorialScenario,
    getDirectiveOverrides: getTutorialScenarioDirectives,
    getHudContent: getTutorialHudContent,
    handleScenarioPromptAction: handleTutorialPromptAction,
    isState: isTutorialScenarioState,
    prompts: tutorialPromptDefinitions,
    shouldAutoRestartOnCrash: () => true,
  })

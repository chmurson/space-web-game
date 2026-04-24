import { getCaptureMetricsForState } from '../../../assist/orbitalAssist'
import { gameConfig } from '../../../config/gameConfig'
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
  type RuntimeScenarioDirectives,
} from '../../scenarioDirectiveTypes'
import type {
  ScenarioSceneContext,
  ScenarioSceneDefinition,
} from '../../scenarioRegistry'
import type { ScenarioRuntimeTransition } from '../../scenarioRuntimeTransition'
import {
  createRuntimeScenarioCheckpoint,
  type RuntimeScenarioCheckpoint,
  type ScenarioPromptUiState,
} from '../../scenarioSession'
import {
  getHiddenOnboardingUIElements,
  tutorialOnboardingStepOrder,
} from './tutorialOnboarding/tutorialOnboardingFlow'
import {
  acknowledgeTutorialOnboardingPrompt,
  advanceTutorialOnboarding,
  createTutorialOnboardingState,
} from './tutorialOnboarding/tutorialOnboardingProgress'
import type { TutorialOnboardingState } from './tutorialOnboarding/tutorialOnboardingTypes'
import {
  createOrbitProgressState,
  type EscapeEarthTutorialSceneState,
  type OrbitEarthTutorialSceneState,
  type OrbitMoonTutorialSceneState,
  type TutorialScenarioState,
} from './tutorialScenarioTypes'

const requiredMoonOrbitTurns = 3
const fullTurnRadians = Math.PI * 2
const earthOrbitPhaseThresholdRadiusMultiplier = 20
const moonOrbitPhaseThresholdRadiusMultiplier = 35
const tutorialTimeWarps = gameConfig.controls.timeWarps

const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const getTutorialTimeWarpMultiplier = (runtime: AppRuntimeState) =>
  tutorialTimeWarps[runtime.simulation.timeWarpIndex] ??
  tutorialTimeWarps[0] ??
  1

const createDefaultRuntimeScenarioCheckpoint = (
  runtime: AppRuntimeState,
): RuntimeScenarioCheckpoint =>
  createRuntimeScenarioCheckpoint({
    assistMode: runtime.simulation.assistMode,
    assistTargetIndex: runtime.simulation.assistTargetIndex,
    coastPredictionHorizonHours: runtime.simulation.coastPredictionHorizonHours,
    targetHeading: runtime.simulation.targetHeading,
    viewportSize: runtime.simulation.viewportSize,
    world: runtime.simulation.state,
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

const createPromptUiWithActivePrompt = (
  runtime: AppRuntimeState,
  activePromptId: string | null,
): ScenarioPromptUiState => ({
  ...runtime.scenario.session.promptUi,
  activePromptId,
})

const isTutorialOnboardingPromptId = (
  promptId: string | null,
): promptId is NonNullable<TutorialOnboardingState['activeStepId']> =>
  tutorialOnboardingStepOrder.includes(
    promptId as NonNullable<TutorialOnboardingState['activeStepId']>,
  )

const resolveOnboardingPromptUi = (
  onboarding: TutorialOnboardingState | undefined,
  currentPromptUi: ScenarioPromptUiState,
): ScenarioPromptUiState => {
  if (onboarding?.gateActive && onboarding.activeStepId) {
    return {
      ...currentPromptUi,
      activePromptId: onboarding.activeStepId,
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

const createEarthFocusDirectives = (options: {
  hiddenBodyIds?: string[]
  hiddenUIElements?: RuntimeScenarioDirectives['hiddenUIElements']
  maxCoastPredictionHorizonHours: number
  maxTimeWarp: number
  maxViewportSize: number
}): RuntimeScenarioDirectives => ({
  ...createDefaultScenarioDirectives(),
  forcedAssistTargetId: 'earth',
  hiddenBodyIds: options.hiddenBodyIds ?? [],
  hiddenUIElements: options.hiddenUIElements ?? new Set(),
  maxCoastPredictionHorizonHours: options.maxCoastPredictionHorizonHours,
  maxTimeWarp: options.maxTimeWarp,
  maxViewportSize: options.maxViewportSize,
})

const createMoonFocusDirectives = (): RuntimeScenarioDirectives => ({
  ...createDefaultScenarioDirectives(),
  forcedAssistTargetId: 'moon',
  maxCoastPredictionHorizonHours: 24,
  maxTimeWarp: 2000,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
})

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

const advanceOrbitScene = <
  TState extends OrbitMoonTutorialSceneState | OrbitEarthTutorialSceneState,
>(
  runtime: AppRuntimeState,
  state: TState,
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

  if (captureMetrics.specificEnergy >= 0) {
    return createTutorialTransition({
      ...state,
      ...createOrbitProgressState(),
      previousOrbitAngle: orbitAngle,
    })
  }

  const additionalProgress =
    typeof state.previousOrbitAngle === 'number'
      ? Math.abs(normalizeAngleDelta(orbitAngle - state.previousOrbitAngle))
      : 0
  const orbitProgressRadians = state.orbitProgressRadians + additionalProgress
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

type TutorialSceneContext<TState extends TutorialScenarioState> = {
  nowMs: number
  runtime: AppRuntimeState
  state: TState
  timeWarpMultiplier: number
}

type TutorialSceneDefinitionMap = {
  [TPhase in TutorialScenarioState['phase']]: ScenarioSceneDefinition<
    Extract<TutorialScenarioState, { phase: TPhase }>,
    TutorialScenarioState
  >
}

const tutorialSceneDefinitions: TutorialSceneDefinitionMap = {
  'escape-earth': {
    advance: (context) => {
      const { runtime, state, nowMs, timeWarpMultiplier } =
        createTutorialSceneContext(context)
      const onboarding = state.onboarding
      if (onboarding?.gateActive) {
        const advancedOnboarding = advanceTutorialOnboarding(
          runtime,
          onboarding,
          nowMs,
          timeWarpMultiplier,
        )
        const nextState: EscapeEarthTutorialSceneState = {
          ...state,
          onboarding: advancedOnboarding,
        }
        if (advancedOnboarding.gateActive) {
          return createTutorialTransition(nextState, {
            promptUi: resolveOnboardingPromptUi(
              advancedOnboarding,
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
          checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime),
          promptUi: createPromptUiWithActivePrompt(runtime, 'phase-two-intro'),
        },
      )
    },
    actions: {
      'advance-onboarding-step': (context) => {
        const { runtime, state, nowMs, timeWarpMultiplier } =
          createTutorialSceneContext(context)
        const activeOnboarding = state.onboarding
        if (!activeOnboarding?.gateActive) {
          return { handled: false }
        }

        const acknowledgedOnboarding = acknowledgeTutorialOnboardingPrompt(
          runtime,
          activeOnboarding,
          nowMs,
          timeWarpMultiplier,
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
              promptUi: resolveOnboardingPromptUi(
                acknowledgedOnboarding,
                runtime.scenario.session.promptUi,
              ),
            },
          ),
        }
      },
      'start-phase-one-onboarding': (context) => {
        const { runtime, state, nowMs, timeWarpMultiplier } =
          createTutorialSceneContext(context)
        if (
          runtime.scenario.session.promptUi.activePromptId !== 'phase-one-intro'
        ) {
          return { handled: false }
        }

        const nextOnboarding = createTutorialOnboardingState(
          runtime,
          nowMs,
          timeWarpMultiplier,
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
      },
    },
    directives: ({ state }) =>
      createEarthFocusDirectives({
        hiddenBodyIds: ['moon'],
        hiddenUIElements: getHiddenOnboardingUIElements(state.onboarding),
        maxCoastPredictionHorizonHours: 2,
        maxTimeWarp: 500,
        maxViewportSize: EARTH_VIEWPORT_SIZE,
      }),
  },
  'reach-moon': {
    advance: ({ runtime }) =>
      isWithinOrbitPhaseThreshold(runtime, 'moon')
        ? createTutorialTransition(
            {
              phase: 'orbit-moon',
              ...createOrbitProgressState(),
            },
            {
              checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime),
              promptUi: createPromptUiWithActivePrompt(
                runtime,
                'orbit-moon-intro',
              ),
            },
          )
        : null,
    directives: () => createMoonFocusDirectives(),
  },
  'orbit-moon': {
    advance: ({ runtime, state }) => {
      const orbitProgress = advanceOrbitScene(runtime, state, 'moon')
      if (!orbitProgress?.completed) {
        return orbitProgress
      }

      return createTutorialTransition(
        {
          phase: 'return-earth',
          ...createOrbitProgressState(),
        },
        {
          checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime),
          promptUi: createPromptUiWithActivePrompt(
            runtime,
            'phase-three-intro',
          ),
        },
      )
    },
    directives: () => createMoonFocusDirectives(),
  },
  'return-earth': {
    advance: ({ runtime }) =>
      isWithinOrbitPhaseThreshold(runtime, 'earth')
        ? createTutorialTransition(
            {
              phase: 'orbit-earth',
              ...createOrbitProgressState(),
            },
            {
              checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime),
              promptUi: createPromptUiWithActivePrompt(
                runtime,
                'orbit-earth-intro',
              ),
            },
          )
        : null,
    directives: () =>
      createEarthFocusDirectives({
        maxCoastPredictionHorizonHours: 24,
        maxTimeWarp: 2000,
        maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
      }),
  },
  'orbit-earth': {
    advance: ({ runtime, state }) => {
      const orbitProgress = advanceOrbitScene(runtime, state, 'earth')
      if (!orbitProgress?.completed) {
        return orbitProgress
      }

      return createTutorialTransition(
        {
          phase: 'complete',
        },
        {
          checkpoint: createDefaultRuntimeScenarioCheckpoint(runtime),
          completed: true,
          promptUi: createPromptUiWithActivePrompt(runtime, 'complete-intro'),
        },
      )
    },
    directives: () =>
      createEarthFocusDirectives({
        maxCoastPredictionHorizonHours: 24,
        maxTimeWarp: 2000,
        maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
      }),
  },
  complete: {
    directives: () => createDefaultScenarioDirectives(),
  },
}

export const getTutorialSceneDefinition = <
  TState extends TutorialScenarioState,
>(
  state: TState,
): ScenarioSceneDefinition<TState> =>
  tutorialSceneDefinitions[
    state.phase
  ] as unknown as ScenarioSceneDefinition<TState>

const createTutorialSceneContext = <TState extends TutorialScenarioState>(
  context: ScenarioSceneContext<TState>,
): TutorialSceneContext<TState> => ({
  nowMs: performance.now(),
  runtime: context.runtime,
  state: context.state,
  timeWarpMultiplier: getTutorialTimeWarpMultiplier(context.runtime),
})

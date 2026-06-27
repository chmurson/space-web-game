import { gameConfig } from '../../../config/gameConfig'
import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../../../domain/viewportPresets'
import type { AppRuntimeState } from '../../../runtime/appRuntimeState'
import type { TrajectoryPredictionState } from '../../../runtime/trajectoryPredictionRuntime'
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
import {
  advanceScenarioOrbitProgress,
  fullTurnRadians,
  isWithinScenarioObjectiveRadius,
  normalizeScenarioAngleDelta,
} from '../../scenarioObjectiveProgress'
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
const escapeEarthPredictionHorizonHours = 48
const escapeEarthCompletedOnboardingMaxTimeWarp = 300
const escapeEarthOnboardingMaxTimeWarp = 30
export const escapeEarthTrajectoryViewportSize =
  (EARTH_VIEWPORT_SIZE + EARTH_MOON_VIEWPORT_SIZE) / 2
export const escapeEarthVisiblePredictionHorizonHours = 2
export const escapeEarthPhaseThresholdRadiusMultiplier = 5
const earthOrbitPhaseThresholdRadiusMultiplier = 20
const moonOrbitPhaseThresholdRadiusMultiplier = 35
const tutorialTimeWarps = gameConfig.controls.timeWarps

const getTutorialTimeWarpMultiplier = (runtime: AppRuntimeState) =>
  tutorialTimeWarps[runtime.simulation.timeWarpIndex] ??
  tutorialTimeWarps[0] ??
  1

const hasCompletedLoopAroundTarget = (
  relativePoints: Array<{ x: number; y: number }>,
) => {
  if (relativePoints.length < 2) {
    return false
  }

  let previousAngle = Math.atan2(relativePoints[0].y, relativePoints[0].x)
  let angularTravel = 0

  for (const point of relativePoints.slice(1)) {
    const angle = Math.atan2(point.y, point.x)
    angularTravel += normalizeScenarioAngleDelta(angle - previousAngle)
    previousAngle = angle

    if (Math.abs(angularTravel) >= fullTurnRadians) {
      return true
    }
  }

  return false
}

const isEscapeTrajectoryReady = (
  runtime: AppRuntimeState,
  trajectoryPrediction?: TrajectoryPredictionState,
) => {
  if (!trajectoryPrediction) {
    return false
  }

  const earth = runtime.simulation.state.bodies.find(
    (body) => body.id === 'earth',
  )
  if (!earth) {
    return false
  }

  const earthImpact =
    trajectoryPrediction.predictedImpact?.bodyName === earth.name
  if (earthImpact) {
    return false
  }

  const currentRelativePosition = sub(
    runtime.simulation.state.spacecraft.position,
    earth.position,
  )
  return !hasCompletedLoopAroundTarget([
    currentRelativePosition,
    ...trajectoryPrediction.targetRelativePredictionPoints,
  ])
}

const createDefaultRuntimeScenarioCheckpoint = (
  runtime: AppRuntimeState,
): RuntimeScenarioCheckpoint =>
  createRuntimeScenarioCheckpoint({
    assistMode: runtime.simulation.assistMode,
    assistTargetIndex: runtime.simulation.assistTargetIndex,
    cameraMode: runtime.ui.camera.mode,
    cameraPanOffset: runtime.ui.camera.panOffset,
    coastPredictionHorizonHours: runtime.simulation.coastPredictionHorizonHours,
    targetHeading: runtime.simulation.targetHeading,
    targetHeadingTurn: runtime.simulation.targetHeadingTurn ?? null,
    viewportSize: runtime.simulation.viewportSize,
    world: runtime.simulation.state,
  })

const createTutorialTransition = (
  state: TutorialScenarioState,
  options: {
    checkpoint?: RuntimeScenarioCheckpoint | null
    completed?: boolean
    promptUi?: ScenarioPromptUiState
    refreshTrajectoryPrediction?: boolean
  } = {},
): ScenarioRuntimeTransition<TutorialScenarioState> => ({
  checkpoint: options.checkpoint,
  completed: options.completed,
  nextState: state,
  promptUi: options.promptUi,
  refreshTrajectoryPrediction: options.refreshTrajectoryPrediction,
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

const hasReachedTrajectoryCoach = (
  state: EscapeEarthTutorialSceneState,
): boolean =>
  state.onboarding?.activeStepId === 'intro-trajectory' ||
  state.onboarding?.activeStepId === 'intro-complete' ||
  state.onboarding?.gateActive === false ||
  state.onboarding?.completedStepIds.includes('intro-trajectory') === true

const createEarthFocusDirectives = (options: {
  cameraMode?: RuntimeScenarioDirectives['cameraMode']
  cameraModeChangesLocked?: RuntimeScenarioDirectives['cameraModeChangesLocked']
  hiddenBodyIds?: string[]
  hiddenUIElements?: RuntimeScenarioDirectives['hiddenUIElements']
  maxCoastPredictionHorizonHours: number
  maxTimeWarp: number
  maxViewportSize: number
}): RuntimeScenarioDirectives => ({
  ...createDefaultScenarioDirectives(),
  cameraMode: options.cameraMode ?? null,
  cameraModeChangesLocked: options.cameraModeChangesLocked ?? false,
  hiddenBodyIds: options.hiddenBodyIds ?? [],
  hiddenUIElements: options.hiddenUIElements ?? new Set(),
  maxCoastPredictionHorizonHours: options.maxCoastPredictionHorizonHours,
  maxTimeWarp: options.maxTimeWarp,
  maxViewportSize: options.maxViewportSize,
})

const createMoonFocusDirectives = (): RuntimeScenarioDirectives => ({
  ...createDefaultScenarioDirectives(),
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
  const radiusMultiplier =
    targetId === 'earth'
      ? earthOrbitPhaseThresholdRadiusMultiplier
      : moonOrbitPhaseThresholdRadiusMultiplier

  return isWithinScenarioObjectiveRadius(runtime, {
    radiusMultiplier,
    targetId,
  })
}

const advanceOrbitScene = <
  TState extends OrbitMoonTutorialSceneState | OrbitEarthTutorialSceneState,
>(
  runtime: AppRuntimeState,
  state: TState,
  targetId: 'earth' | 'moon',
): ScenarioRuntimeTransition<TutorialScenarioState> | null => {
  const orbitProgress = advanceScenarioOrbitProgress(runtime, state, {
    progressMode: 'absolute',
    requiredTurns: requiredMoonOrbitTurns,
    targetId,
  })
  if (!orbitProgress) {
    return null
  }

  if (orbitProgress.status === 'reset') {
    return createTutorialTransition(orbitProgress.state)
  }

  const shouldCaptureFirstOrbitAttemptCheckpoint =
    orbitProgress.state.orbitAttemptCheckpointCaptured !== true

  return createTutorialTransition(
    {
      ...orbitProgress.state,
      ...(shouldCaptureFirstOrbitAttemptCheckpoint
        ? { orbitAttemptCheckpointCaptured: true }
        : {}),
    },
    {
      checkpoint: shouldCaptureFirstOrbitAttemptCheckpoint
        ? createDefaultRuntimeScenarioCheckpoint(runtime)
        : undefined,
      completed: orbitProgress.completed,
    },
  )
}

type TutorialSceneContext<TState extends TutorialScenarioState> = {
  getTrajectoryPredictionForHorizonHours?: (
    horizonHours: number,
  ) => TrajectoryPredictionState
  nowMs: number
  trajectoryPrediction?: TrajectoryPredictionState
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
        const trajectoryPrediction =
          onboarding.activeStepId === 'intro-trajectory'
            ? (context.getTrajectoryPredictionForHorizonHours?.(
                escapeEarthPredictionHorizonHours,
              ) ?? context.trajectoryPrediction)
            : undefined
        const advancedOnboarding = advanceTutorialOnboarding(
          runtime,
          onboarding,
          nowMs,
          timeWarpMultiplier,
          {
            trajectoryExitReady: isEscapeTrajectoryReady(
              runtime,
              trajectoryPrediction,
            ),
          },
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
      if (
        distanceFromEarth <
        EARTH_RADIUS * escapeEarthPhaseThresholdRadiusMultiplier
      ) {
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
          refreshTrajectoryPrediction: true,
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
              checkpoint: acknowledgedOnboarding.gateActive
                ? undefined
                : createDefaultRuntimeScenarioCheckpoint(runtime),
              promptUi: acknowledgedOnboarding.gateActive
                ? resolveOnboardingPromptUi(
                    acknowledgedOnboarding,
                    runtime.scenario.session.promptUi,
                  )
                : {
                    activePromptId: null,
                    replayPromptId: 'phase-one-objective',
                  },
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
        cameraMode: state.onboarding?.gateActive === false ? null : 'centered',
        cameraModeChangesLocked: state.onboarding?.gateActive !== false,
        hiddenBodyIds: ['moon'],
        hiddenUIElements: getHiddenOnboardingUIElements(state.onboarding),
        maxCoastPredictionHorizonHours:
          escapeEarthVisiblePredictionHorizonHours,
        maxTimeWarp:
          state.onboarding?.gateActive === false
            ? escapeEarthCompletedOnboardingMaxTimeWarp
            : escapeEarthOnboardingMaxTimeWarp,
        maxViewportSize: hasReachedTrajectoryCoach(state)
          ? escapeEarthTrajectoryViewportSize
          : EARTH_VIEWPORT_SIZE,
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
          completedElapsedGameSeconds: runtime.simulation.state.elapsed,
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
  getTrajectoryPredictionForHorizonHours:
    context.getTrajectoryPredictionForHorizonHours,
  nowMs: performance.now(),
  trajectoryPrediction: context.trajectoryPrediction,
  runtime: context.runtime,
  state: context.state,
  timeWarpMultiplier: getTutorialTimeWarpMultiplier(context.runtime),
})

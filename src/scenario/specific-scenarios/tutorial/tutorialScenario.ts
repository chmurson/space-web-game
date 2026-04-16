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
  type RuntimeScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
} from '../../scenarioDirectiveTypes'
import type {
  PromptAcknowledgeResult,
  PromptActionEffect,
  RuntimePromptContent,
  RuntimeScenarioDefinition,
  ScenarioPromptContent,
} from '../../scenarioRegistry'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
  type RuntimeScenarioCheckpoint,
} from '../../scenarioSession'
import {
  getHiddenOnboardingUIElements,
  getTutorialOnboardingPromptContent,
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
type TutorialScenarioPrompt =
  | 'phase-one-intro'
  | 'phase-two-intro'
  | 'orbit-moon-intro'
  | 'phase-three-intro'
  | 'orbit-earth-intro'
  | 'complete-intro'
  | null

export type TutorialScenarioState = {
  onboarding?: TutorialOnboardingState
  lastAcknowledgedPrompt?: Exclude<TutorialScenarioPrompt, null>
  orbitProgressRadians?: number
  orbitTurnsCompleted?: number
  previousOrbitAngle?: number
  phase: TutorialScenarioPhase
  pendingPrompt: TutorialScenarioPrompt
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
    pendingPrompt: 'phase-one-intro',
  },
) => createRuntimeScenarioSession('tutorial', state)

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

const getTutorialPromptContent = (
  state: TutorialScenarioState,
): ScenarioPromptContent | null => {
  return getTutorialPromptContentForPrompt(state.pendingPrompt)
}

const getActivePrompt = (
  runtime: AppRuntimeState,
  inputMode: 'desktop' | 'mobile',
): RuntimePromptContent | null => {
  const state = runtime.scenarioSession.state as TutorialScenarioState

  // Check onboarding (non-blocking coach tips) first
  if (state.onboarding?.gateActive && state.onboarding.activeStepId) {
    const onboardingContent = getTutorialOnboardingPromptContent(
      state.onboarding.activeStepId,
      inputMode,
    )
    const prompt: RuntimePromptContent = {
      mode: 'coach',
      title: onboardingContent.title,
      description: onboardingContent.description,
      confirmButton: onboardingContent.confirmLabel
        ? { label: onboardingContent.confirmLabel }
        : undefined,
      anchor: onboardingContent.anchor,
    }

    return prompt
  }

  // Check phase prompts (blocking)
  const phasePrompt = getTutorialPromptContentForPrompt(state.pendingPrompt)
  if (phasePrompt) {
    return {
      mode: 'blocking',
      title: phasePrompt.title,
      description: phasePrompt.description,
      confirmButton: phasePrompt.confirmLabel
        ? { label: phasePrompt.confirmLabel, action: phasePrompt.confirmAction }
        : undefined,
      secondaryButton: phasePrompt.secondaryLabel
        ? {
            label: phasePrompt.secondaryLabel,
            action: phasePrompt.secondaryAction,
          }
        : undefined,
    }
  }

  return null
}

const getTutorialPromptContentForPrompt = (
  prompt: TutorialScenarioPrompt,
): ScenarioPromptContent | null => {
  if (prompt === 'phase-one-intro') {
    return {
      title: 'Leave Earth Orbit',
      description:
        'Use thrust, turning, double-click heading, and the projected path. Fly far enough away from Earth to move on.',
      confirmLabel: 'Start',
    }
  }

  if (prompt === 'phase-two-intro') {
    return {
      title: 'Reach the Moon',
      description:
        'The Moon is now your target. You can zoom out more and look farther ahead. Use that to line up an approach.',
      confirmLabel: 'Continue',
    }
  }

  if (prompt === 'phase-three-intro') {
    return {
      title: 'Return to Earth',
      description:
        'You have completed three lunar orbits. The next goal is to head back toward Earth and get close enough to start the final orbit.',
      confirmLabel: 'Continue',
    }
  }

  if (prompt === 'orbit-moon-intro') {
    return {
      title: 'Approach the Moon',
      description:
        'You are close to the Moon. Orbit around it three times to complete the lunar phase of the tutorial.',
      confirmLabel: 'Continue',
    }
  }

  if (prompt === 'orbit-earth-intro') {
    return {
      title: 'Back at Earth',
      description:
        'You are back in Earth range. Stabilize and complete three Earth orbits to finish the tutorial.',
      confirmLabel: 'Continue',
    }
  }

  if (prompt === 'complete-intro') {
    return {
      title: 'Tutorial Complete',
      description:
        'You completed the Earth-Moon round trip. Start free roam immediately or return to the main menu.',
      confirmAction: 'start-free-roam',
      confirmLabel: 'Free roam',
      secondaryAction: 'exit-to-menu',
      secondaryLabel: 'Exit',
    }
  }

  return null
}

const positionMoonForPhaseTwo = (runtime: AppRuntimeState) => {
  const earth = runtime.state.bodies.find((body) => body.id === 'earth')
  const moon = runtime.state.bodies.find((body) => body.id === 'moon')
  if (!earth || !moon) {
    return
  }

  const spacecraftRelativeVelocity = sub(
    runtime.state.spacecraft.velocity,
    earth.velocity,
  )
  const outboundReference =
    length(spacecraftRelativeVelocity) > 1
      ? spacecraftRelativeVelocity
      : sub(runtime.state.spacecraft.position, earth.position)
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
    assistMode: runtime.assistMode,
    assistTargetIndex: runtime.assistTargetIndex,
    coastPredictionHorizonHours: runtime.coastPredictionHorizonHours,
    targetHeading: runtime.targetHeading,
    viewportSize: runtime.viewportSize,
    world: runtime.state,
  })
}

const createOrbitProgressState = (): Pick<
  TutorialScenarioState,
  'orbitProgressRadians' | 'orbitTurnsCompleted'
> => ({
  orbitProgressRadians: 0,
  orbitTurnsCompleted: 0,
})

const isWithinOrbitPhaseThreshold = (
  runtime: AppRuntimeState,
  targetId: 'earth' | 'moon',
) => {
  const target = runtime.state.bodies.find((body) => body.id === targetId)
  if (!target) {
    return false
  }

  const captureMetrics = getCaptureMetricsForState(runtime.state, target)
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
) => {
  const target = runtime.state.bodies.find((body) => body.id === targetId)
  if (!target) {
    return null
  }

  const captureMetrics = getCaptureMetricsForState(runtime.state, target)
  const orbitAngle = Math.atan2(
    runtime.state.spacecraft.position.y - target.position.y,
    runtime.state.spacecraft.position.x - target.position.x,
  )
  const previousOrbitAngle = state.previousOrbitAngle

  if (captureMetrics.specificEnergy >= 0) {
    runtime.scenarioSession = {
      ...runtime.scenarioSession,
      state: {
        ...state,
        ...createOrbitProgressState(),
        previousOrbitAngle: orbitAngle,
      },
    }
    return { completed: false }
  }

  const additionalProgress =
    typeof previousOrbitAngle === 'number'
      ? Math.abs(normalizeAngleDelta(orbitAngle - previousOrbitAngle))
      : 0
  const orbitProgressRadians =
    (state.orbitProgressRadians ?? 0) + additionalProgress
  const orbitTurnsCompleted = Math.floor(orbitProgressRadians / fullTurnRadians)

  runtime.scenarioSession = {
    ...runtime.scenarioSession,
    state: {
      ...state,
      orbitProgressRadians,
      orbitTurnsCompleted,
      previousOrbitAngle: orbitAngle,
    },
  }

  return { completed: orbitTurnsCompleted >= requiredMoonOrbitTurns }
}

const advanceTutorialScenario = (runtime: AppRuntimeState) => {
  if (!isTutorialScenarioState(runtime.scenarioSession.state)) {
    return
  }

  if (runtime.scenarioSession.state.phase === 'escape-earth') {
    const onboarding = runtime.scenarioSession.state.onboarding
    if (onboarding?.gateActive) {
      const advancedOnboarding = advanceTutorialOnboarding(
        runtime,
        onboarding,
        performance.now(),
        tutorialTimeWarps[runtime.timeWarpIndex] ?? tutorialTimeWarps[0] ?? 1,
      )
      runtime.scenarioSession = {
        ...runtime.scenarioSession,
        state: {
          ...runtime.scenarioSession.state,
          onboarding: advancedOnboarding,
        },
      }
      if (advancedOnboarding.gateActive) {
        return
      }
    }

    const earth = runtime.state.bodies.find((body) => body.id === 'earth')
    if (!earth) {
      return
    }

    const distanceFromEarth = length(
      sub(runtime.state.spacecraft.position, earth.position),
    )
    if (distanceFromEarth < EARTH_RADIUS * 5) {
      return
    }

    positionMoonForPhaseTwo(runtime)

    runtime.scenarioSession = {
      ...runtime.scenarioSession,
      checkpoint: createDefaultRuntimeScenarioSession(runtime),
      state: {
        phase: 'reach-moon',
        pendingPrompt: 'phase-two-intro',
        ...createOrbitProgressState(),
      },
    }
    return
  }

  if (runtime.scenarioSession.state.phase === 'reach-moon') {
    if (isWithinOrbitPhaseThreshold(runtime, 'moon')) {
      runtime.scenarioSession = {
        ...runtime.scenarioSession,
        checkpoint: createDefaultRuntimeScenarioSession(runtime),
        state: {
          ...runtime.scenarioSession.state,
          ...createOrbitProgressState(),
          phase: 'orbit-moon',
          pendingPrompt: 'orbit-moon-intro',
        },
      }
    }

    return
  }

  if (runtime.scenarioSession.state.phase === 'orbit-moon') {
    const orbitProgress = advanceOrbitPhase(
      runtime,
      runtime.scenarioSession.state,
      'moon',
    )
    if (!orbitProgress?.completed) {
      return
    }

    runtime.scenarioSession = {
      ...runtime.scenarioSession,
      checkpoint: createDefaultRuntimeScenarioSession(runtime),
      state: {
        phase: 'return-earth',
        pendingPrompt: 'phase-three-intro',
        ...createOrbitProgressState(),
      },
    }
    return
  }

  if (runtime.scenarioSession.state.phase === 'return-earth') {
    if (isWithinOrbitPhaseThreshold(runtime, 'earth')) {
      runtime.scenarioSession = {
        ...runtime.scenarioSession,
        checkpoint: createDefaultRuntimeScenarioSession(runtime),
        state: {
          ...runtime.scenarioSession.state,
          ...createOrbitProgressState(),
          phase: 'orbit-earth',
          pendingPrompt: 'orbit-earth-intro',
        },
      }
    }
    return
  }

  if (runtime.scenarioSession.state.phase === 'orbit-earth') {
    const orbitProgress = advanceOrbitPhase(
      runtime,
      runtime.scenarioSession.state,
      'earth',
    )
    if (!orbitProgress?.completed) {
      return
    }

    runtime.scenarioSession = {
      ...runtime.scenarioSession,
      checkpoint: createDefaultRuntimeScenarioSession(runtime),
      completed: true,
      state: {
        phase: 'complete',
        pendingPrompt: 'complete-intro',
      },
    }
    return
  }

  return
}

const acknowledgeTutorialPrompt = (
  runtime: AppRuntimeState,
): PromptAcknowledgeResult => {
  if (!isTutorialScenarioState(runtime.scenarioSession.state)) {
    return { acknowledged: false }
  }

  const activeOnboarding = runtime.scenarioSession.state.onboarding
  if (activeOnboarding?.gateActive) {
    const acknowledgedOnboarding = acknowledgeTutorialOnboardingPrompt(
      runtime,
      activeOnboarding,
      performance.now(),
      tutorialTimeWarps[runtime.timeWarpIndex] ?? tutorialTimeWarps[0] ?? 1,
    )

    if (!acknowledgedOnboarding) {
      return { acknowledged: false }
    }

    runtime.scenarioSession = {
      ...runtime.scenarioSession,
      state: {
        ...runtime.scenarioSession.state,
        onboarding: acknowledgedOnboarding,
      },
    }
    return { acknowledged: true }
  }

  if (runtime.scenarioSession.state.pendingPrompt === null) {
    return { acknowledged: false }
  }

  const acknowledgedPrompt = runtime.scenarioSession.state.pendingPrompt
  const promptContent = getTutorialPromptContentForPrompt(acknowledgedPrompt)
  const effect = promptContent?.confirmAction as PromptActionEffect | undefined
  const nextOnboarding =
    acknowledgedPrompt === 'phase-one-intro'
      ? createTutorialOnboardingState(
          runtime,
          performance.now(),
          tutorialTimeWarps[runtime.timeWarpIndex] ?? tutorialTimeWarps[0] ?? 1,
        )
      : runtime.scenarioSession.state.onboarding
  runtime.scenarioSession = {
    ...runtime.scenarioSession,
    state: {
      ...runtime.scenarioSession.state,
      lastAcknowledgedPrompt: acknowledgedPrompt,
      ...(nextOnboarding ? { onboarding: nextOnboarding } : {}),
      pendingPrompt: null,
    },
  }
  return { acknowledged: true, effect }
}

const reopenTutorialPrompt = (runtime: AppRuntimeState) => {
  if (
    !isTutorialScenarioState(runtime.scenarioSession.state) ||
    runtime.scenarioSession.state.pendingPrompt !== null ||
    !runtime.scenarioSession.state.lastAcknowledgedPrompt
  ) {
    return false
  }

  runtime.scenarioSession = {
    ...runtime.scenarioSession,
    state: {
      ...runtime.scenarioSession.state,
      pendingPrompt: runtime.scenarioSession.state.lastAcknowledgedPrompt,
    },
  }
  return true
}

export const registerTutorialScenario =
  (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
    acknowledgePrompt: acknowledgeTutorialPrompt,
    advance: advanceTutorialScenario,
    id: 'tutorial',
    createScenario: createTutorialScenario,
    getActivePrompt,
    getDirectiveOverrides: getTutorialScenarioDirectives,
    getHudContent: getTutorialHudContent,
    getPromptContent: getTutorialPromptContent,
    getReplayPromptContent: (state) =>
      getTutorialPromptContentForPrompt(state.lastAcknowledgedPrompt ?? null),
    isState: isTutorialScenarioState,
    reopenPrompt: reopenTutorialPrompt,
    shouldAutoRestartOnCrash: () => true,
  })

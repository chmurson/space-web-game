import type { RuntimeScenario } from '../../../debugScenarioSnapshot'
import type { AppRuntimeState } from '../../../runtime/appRuntimeState'
import { EARTH_RADIUS } from '../../../simulation/constants'
import { createEarthMoonScenario } from '../../../simulation/scenarios/earthMoon'
import { length, sub } from '../../../simulation/vector'
import type { PromptDefinition } from '../../scenarioPromptTypes'
import type { RuntimeScenarioDefinition } from '../../scenarioRegistry'
import { createRuntimeScenarioSession } from '../../scenarioSession'
import { getTutorialOnboardingPromptDefinitions } from './tutorialOnboarding/tutorialOnboardingFlow'
import {
  escapeEarthPhaseThresholdRadiusMultiplier,
  escapeEarthVisiblePredictionHorizonHours,
  getTutorialSceneDefinition,
} from './tutorialSceneRouter'
import {
  createInitialTutorialScenarioState,
  isTutorialScenarioState,
  type TutorialScenarioState,
} from './tutorialScenarioTypes'

const createTutorialScenarioSession = (
  state: TutorialScenarioState = createInitialTutorialScenarioState(),
) =>
  createRuntimeScenarioSession('tutorial', state, {
    activePromptId: 'phase-one-intro',
    replayPromptId: null,
  })

const createTutorialScenario = (): RuntimeScenario => {
  const scenario = createEarthMoonScenario()

  return {
    ...scenario,
    id: 'tutorial',
    name: 'Tutorial: Escape Earth',
    description: "Leave low Earth orbit and break free from Earth's pull.",
    coastPredictionHorizonHours: escapeEarthVisiblePredictionHorizonHours,
    scenarioSession: createTutorialScenarioSession(),
  }
}

const getCurrentEarthRadiiDistance = (
  runtime: AppRuntimeState,
): string | null => {
  const earth = runtime.simulation.state.bodies.find(
    (body) => body.id === 'earth',
  )

  if (!earth) {
    return null
  }

  const distance = length(
    sub(runtime.simulation.state.spacecraft.position, earth.position),
  )

  return (distance / EARTH_RADIUS).toFixed(1)
}

const getEscapeEarthObjectiveDescription = (runtime: AppRuntimeState) => {
  const currentDistance = getCurrentEarthRadiiDistance(runtime)
  const currentDistanceSentence = currentDistance
    ? ` You are about ${currentDistance} Earth radii out now.`
    : ''

  return `Keep flying until you reach ${escapeEarthPhaseThresholdRadiusMultiplier} Earth radii from Earth's center.${currentDistanceSentence} Use burns, time warp, and the projected path to keep opening the gap.`
}

const tutorialPromptDefinitions = {
  'phase-one-intro': {
    id: 'phase-one-intro',
    title: 'Leave Earth Orbit',
    shortLabel: 'Leave Earth Orbit',
    description:
      "We'll start simple: learn the ship and game controls, use them to leave Earth orbit, circle the Moon, then make it back home.",
    buttons: [
      {
        action: { kind: 'scenario', id: 'start-phase-one-onboarding' },
        label: 'Start',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'phase-one-objective': {
    id: 'phase-one-objective',
    title: 'Escape Earth',
    shortLabel: 'Escape Earth',
    description: ({ runtime }) => getEscapeEarthObjectiveDescription(runtime),
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
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

export const registerTutorialScenario =
  (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
    id: 'tutorial',
    createScenario: createTutorialScenario,
    getSceneDefinition: getTutorialSceneDefinition,
    isState: isTutorialScenarioState,
    prompts: tutorialPromptDefinitions,
    shouldAutoRestartOnCrash: () => true,
  })

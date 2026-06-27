import type { RuntimeScenario } from '../../../debugScenarioSnapshot'
import type { AppRuntimeState } from '../../../runtime/appRuntimeState'
import { EARTH_RADIUS } from '../../../simulation/constants'
import { createEarthMoonScenario } from '../../../simulation/scenarios/earthMoon'
import { length, sub } from '../../../simulation/vector'
import type { PromptDefinition, PromptText } from '../../scenarioPromptTypes'
import type { RuntimeScenarioDefinition } from '../../scenarioRegistry'
import { createRuntimeScenarioSession } from '../../scenarioSession'
import { getTutorialOnboardingPromptDefinitions } from './tutorialOnboarding/tutorialOnboardingFlow'
import {
  createInitialTutorialScenarioState,
  isTutorialScenarioState,
  type TutorialScenarioState,
} from './tutorialScenarioTypes'
import {
  escapeEarthPhaseThresholdRadiusMultiplier,
  escapeEarthVisiblePredictionHorizonHours,
  getTutorialSceneDefinition,
} from './tutorialSceneRouter'

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

const getEscapeEarthObjectiveDescription = (
  runtime: AppRuntimeState,
): PromptText => {
  const currentDistance = getCurrentEarthRadiiDistance(runtime)

  if (currentDistance) {
    return [
      'Keep flying until you reach ',
      {
        text: `${escapeEarthPhaseThresholdRadiusMultiplier} Earth radii`,
        tone: 'number',
      },
      " from Earth's center. You are about ",
      { text: `${currentDistance} Earth radii`, tone: 'number' },
      ' out now. Use ',
      { text: 'burns', tone: 'concept' },
      ', ',
      { text: 'time warp', tone: 'concept' },
      ', and the ',
      { text: 'projected path', tone: 'concept' },
      ' to keep opening the gap.',
    ]
  }

  return [
    'Keep flying until you reach ',
    {
      text: `${escapeEarthPhaseThresholdRadiusMultiplier} Earth radii`,
      tone: 'number',
    },
    " from Earth's center. Use ",
    { text: 'burns', tone: 'concept' },
    ', ',
    { text: 'time warp', tone: 'concept' },
    ', and the ',
    { text: 'projected path', tone: 'concept' },
    ' to keep opening the gap.',
  ]
}

const formatTutorialCompletionElapsed = (seconds: number) => {
  const roundedSeconds = Math.max(0, Math.round(seconds))
  const days = Math.floor(roundedSeconds / 86_400)
  const hours = Math.floor((roundedSeconds % 86_400) / 3_600)
  const minutes = Math.floor((roundedSeconds % 3_600) / 60)
  const remainingSeconds = roundedSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${remainingSeconds}s`
}

const getTutorialCompletionElapsedSeconds = (runtime: AppRuntimeState) => {
  const state = runtime.scenario.session.state
  if (
    isTutorialScenarioState(state) &&
    state.phase === 'complete' &&
    typeof state.completedElapsedGameSeconds === 'number'
  ) {
    return state.completedElapsedGameSeconds
  }

  return runtime.simulation.state.elapsed
}

const getTutorialCompletionDescription = (
  runtime: AppRuntimeState,
): PromptText => [
  'You completed the ',
  { text: 'Earth-Moon round trip', tone: 'concept' },
  ' in ',
  {
    text: formatTutorialCompletionElapsed(
      getTutorialCompletionElapsedSeconds(runtime),
    ),
    tone: 'number',
  },
  ' game time. Return to the main menu when you are ready.',
]

const tutorialPromptDefinitions = {
  'phase-one-intro': {
    id: 'phase-one-intro',
    title: 'Leave Earth Orbit',
    shortLabel: 'Leave Earth Orbit',
    description: [
      "We'll start simple: learn the ",
      { text: 'ship and game controls', tone: 'concept' },
      ', use them to leave ',
      { text: 'Earth orbit', tone: 'concept' },
      ', circle the ',
      { text: 'Moon', tone: 'concept' },
      ', then make it back home.',
    ],
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
    description: [
      'The ',
      { text: 'Moon', tone: 'concept' },
      ' is now your target. You can ',
      { text: 'zoom out', tone: 'concept' },
      ' more and look farther ahead. Use that to line up an approach.',
    ],
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
    description: [
      'You are close to the ',
      { text: 'Moon', tone: 'concept' },
      '. Orbit around it ',
      { text: 'three times', tone: 'number' },
      ' to complete the lunar phase of the tutorial.',
    ],
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
    description: [
      'You have completed ',
      { text: 'three lunar orbits', tone: 'number' },
      '. The next goal is to head back toward ',
      { text: 'Earth', tone: 'concept' },
      ' and get close enough to start the ',
      { text: 'final orbit', tone: 'constraint' },
      '.',
    ],
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
    description: [
      'You are back in ',
      { text: 'Earth', tone: 'concept' },
      ' range. Stabilize and complete ',
      { text: 'three Earth orbits', tone: 'number' },
      ' to finish the tutorial.',
    ],
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
    description: ({ runtime }) => getTutorialCompletionDescription(runtime),
    buttons: [
      {
        action: { kind: 'builtin', id: 'exit_to_menu' },
        label: 'Main menu',
        tone: 'primary',
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

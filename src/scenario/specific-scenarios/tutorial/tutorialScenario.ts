import type { RuntimeScenario } from '../../../debugScenarioSnapshot'
import { createEarthMoonScenario } from '../../../simulation/scenarios/earthMoon'
import type { PromptDefinition } from '../../scenarioPromptTypes'
import type { RuntimeScenarioDefinition } from '../../scenarioRegistry'
import { createRuntimeScenarioSession } from '../../scenarioSession'
import { getTutorialOnboardingPromptDefinitions } from './tutorialOnboarding/tutorialOnboardingFlow'
import { getTutorialSceneDefinition } from './tutorialSceneRouter'
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
    coastPredictionHorizonHours: 2,
    scenarioSession: createTutorialScenarioSession(),
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

export const registerTutorialScenario =
  (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
    id: 'tutorial',
    createScenario: createTutorialScenario,
    getSceneDefinition: getTutorialSceneDefinition,
    isState: isTutorialScenarioState,
    prompts: tutorialPromptDefinitions,
    shouldAutoRestartOnCrash: () => true,
  })

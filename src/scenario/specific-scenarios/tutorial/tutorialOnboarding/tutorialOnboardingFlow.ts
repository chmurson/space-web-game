import { formatDuration } from '../../../../ui/formatters'
import type {
  PromptDefinition,
  PromptResolverContext,
  PromptValue,
} from '../../../scenarioPromptTypes'
import type { RuntimeScenarioDirectives } from '../../../scenarioDirectiveTypes'
import { requiredIntroKeepThrustMs } from './config'
import type {
  TutorialOnboardingPromptContent,
  TutorialOnboardingState,
  TutorialOnboardingStepId,
} from './tutorialOnboardingTypes'

export const tutorialOnboardingStepOrder: TutorialOnboardingStepId[] = [
  'intro-thrust',
  'intro-keep-thrusting',
  'intro-thrusting-complete',
  'intro-turn',
  'intro-point-and-turn',
  'intro-timewarp',
  'intro-timewarp-thrust',
  'intro-trajectory',
  'intro-complete',
]

const tutorialOnboardingPromptDefinitions = {
  'intro-thrust': {
    id: 'intro-thrust',
    title: 'Use Thrust',
    shortLabel: 'Use Thrust',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? `Press and hold in the lower control area for about ${formatDuration(requiredIntroKeepThrustMs / 1000)} to fire the main engine and start changing your path.`
        : 'Hold W or Up Arrow for about 2 seconds to fire the main engine and start changing your path.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'trajectory',
      touchHintTarget: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-zone' : undefined,
    },
  },
  'intro-keep-thrusting': {
    id: 'intro-keep-thrusting',
    title: 'Keep Thrusting',
    shortLabel: 'Keep Thrusting',
    description: `That's great. Keep thrusting for ${formatDuration(requiredIntroKeepThrustMs / 1000)}.`,
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'speed-pill',
      touchHintTarget: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-zone' : undefined,
    },
  },
  'intro-thrusting-complete': {
    id: 'intro-thrusting-complete',
    title: 'Nice!',
    shortLabel: 'Nice!',
    description:
      "That's great. Here you can see if your thrust is active. Also, your current speed is displayed.",
    buttons: [
      {
        action: { kind: 'scenario', id: 'advance-onboarding-step' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
  'intro-turn': {
    id: 'intro-turn',
    title: 'Turn The Ship',
    shortLabel: 'Turn The Ship',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Drag sideways in the lower control area until you have turned a total of at least 90 degrees. You can do it in one direction or split it across both directions.'
        : 'Press A or D, or Left/Right Arrow keys to turn the ship. Rotate at least 90 degrees in total, which you can do in one direction or split across both directions.',
    buttons: [],
    presentation: { kind: 'coach', anchor: 'speed-pill' },
  },
  'intro-point-and-turn': {
    id: 'intro-point-and-turn',
    title: 'Point By Double-Tapping',
    shortLabel: 'Point By Double-Tapping',
    description:
      'Double-tap the playfield to set a heading directly. Wait until the ship finishes turning to that new heading.',
    buttons: [],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
  'intro-timewarp': {
    id: 'intro-timewarp',
    title: 'Raise Time Warp',
    shortLabel: 'Raise Time Warp',
    description:
      'Increase time warp until the time pill reaches at least 100x.',
    buttons: [],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
  'intro-timewarp-thrust': {
    id: 'intro-timewarp-thrust',
    title: 'Burn At 100x',
    shortLabel: 'Burn At 100x',
    description:
      'The tutorial is turning you outward from the nearest body. Keep time warp at 100x or higher, then hold thrust in the lower control area for 2 seconds.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'trajectory',
      touchHintTarget: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-zone' : undefined,
    },
  },
  'intro-trajectory': {
    id: 'intro-trajectory',
    title: 'Read The Trajectory',
    shortLabel: 'Read The Trajectory',
    description:
      'The projected line shows where your current motion is taking you. Thrust, turning, and time warp let you inspect and reshape that future path.',
    buttons: [
      {
        action: { kind: 'scenario', id: 'advance-onboarding-step' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
  'intro-complete': {
    id: 'intro-complete',
    title: 'Free Flight Unlocked',
    shortLabel: 'Free Flight Unlocked',
    description:
      'You have the core controls. Keep flying until you get five Earth radii away from the planet.',
    buttons: [
      {
        action: { kind: 'scenario', id: 'advance-onboarding-step' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
} satisfies Record<TutorialOnboardingStepId, PromptDefinition>

export const getTutorialOnboardingPromptDefinitions = () =>
  tutorialOnboardingPromptDefinitions

const resolvePromptValue = <T>(
  value: PromptValue<T>,
  inputMode: 'desktop' | 'mobile',
): T =>
  typeof value === 'function'
    ? (value as (context: PromptResolverContext) => T)({
        inputMode,
        runtime: {} as PromptResolverContext['runtime'],
      })
    : value

export const getTutorialOnboardingPromptContent = (
  stepId: TutorialOnboardingStepId,
  inputMode: 'desktop' | 'mobile',
): TutorialOnboardingPromptContent => {
  const definition = tutorialOnboardingPromptDefinitions[stepId]
  const presentation = definition.presentation
  const primaryButton = definition.buttons[0]
  const anchor =
    presentation.kind === 'coach'
      ? resolvePromptValue(presentation.anchor, inputMode)
      : undefined
  const touchHintTarget =
    presentation.kind === 'coach' && 'touchHintTarget' in presentation
      ? presentation.touchHintTarget
        ? resolvePromptValue(presentation.touchHintTarget, inputMode)
        : undefined
      : undefined

  return {
    title: resolvePromptValue(definition.title, inputMode),
    description: resolvePromptValue(definition.description, inputMode),
    confirmAction:
      primaryButton?.action.kind === 'scenario' &&
      primaryButton.action.id === 'advance-onboarding-step'
        ? 'advance-step'
        : undefined,
    confirmLabel: primaryButton
      ? resolvePromptValue(primaryButton.label, inputMode)
      : undefined,
    anchor,
    touchHintTarget,
  }
}

const emptyHiddenUIElements =
  new Set() as RuntimeScenarioDirectives['hiddenUIElements']

export const getHiddenOnboardingUIElements = (
  state?: TutorialOnboardingState,
): RuntimeScenarioDirectives['hiddenUIElements'] => {
  if (!state) return emptyHiddenUIElements

  if (
    state.activeStepId === 'intro-thrust' ||
    state.activeStepId === 'intro-keep-thrusting' ||
    state.activeStepId === 'intro-turn' ||
    state.activeStepId === 'intro-point-and-turn' ||
    state.activeStepId === 'intro-thrusting-complete'
  ) {
    return new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory'])
  }

  if (
    state.activeStepId === 'intro-timewarp' ||
    state.activeStepId === 'intro-timewarp-thrust'
  ) {
    return new Set(['scenarioInfoButton', 'trajectory'])
  }

  if (state.activeStepId === 'intro-trajectory') {
    return new Set(['scenarioInfoButton'])
  }

  return emptyHiddenUIElements
}

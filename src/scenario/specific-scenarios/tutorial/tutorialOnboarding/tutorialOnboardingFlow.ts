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
  'intro-show-thrust-control',
  'intro-thrust',
  'intro-keep-thrusting',
  'intro-thrusting-complete',
  'intro-thrusting-off',
  'intro-point-and-turn',
  'intro-timewarp',
  'intro-timewarp-thrust',
  'intro-trajectory',
  'intro-complete',
]

const tutorialOnboardingPromptDefinitions = {
  'intro-show-thrust-control': {
    id: 'intro-show-thrust-control',
    title: 'Show Thrust Control',
    shortLabel: 'Show Thrust Control',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Press and hold in the lower-right control area until the thrust control appears. That is where you will light the engine to start pushing away from Earth.'
        : 'Press W or Up Arrow to wake the main engine and start pushing your path away from Earth.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'trajectory',
      touchHintTarget: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-zone' : undefined,
    },
  },
  'intro-thrust': {
    id: 'intro-thrust',
    title: 'Use Thrust',
    shortLabel: 'Use Thrust',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Swipe the visible thrust control upward and keep it on briefly. A short burn starts bending your path away from Earth.'
        : 'Keep W or Up Arrow held briefly so the main engine can start widening your escape path.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-control' : 'trajectory',
    },
  },
  'intro-keep-thrusting': {
    id: 'intro-keep-thrusting',
    title: 'Keep Thrusting',
    shortLabel: 'Keep Thrusting',
    description: `That's it. Keep the burn going for ${formatDuration(requiredIntroKeepThrustMs / 1000)} so your path opens away from Earth.`,
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'speed-pill',
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
    presentation: { kind: 'coach', anchor: 'speed-pill' },
  },
  'intro-thrusting-off': {
    id: 'intro-thrusting-off',
    title: 'Thrusting Off',
    shortLabel: 'Thrusting Off',
    buttons: [],
    description:
      'You can now turn off by sliding the thrust control down. Do it now.',
    presentation: { kind: 'coach', anchor: 'thrust-control' },
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
    description: 'Increase time warp until the time pill reaches at least x1m.',
    buttons: [],
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
  'intro-timewarp-thrust': {
    id: 'intro-timewarp-thrust',
    title: 'Burn At x1m',
    shortLabel: 'Burn At x1m',
    description:
      'The tutorial is turning you outward from the nearest body. Keep time warp at x1m or higher, then hold thrust in the lower control area for 2 seconds.',
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
    state.activeStepId === 'intro-show-thrust-control' ||
    state.activeStepId === 'intro-thrust' ||
    state.activeStepId === 'intro-keep-thrusting' ||
    state.activeStepId === 'intro-thrusting-off' ||
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

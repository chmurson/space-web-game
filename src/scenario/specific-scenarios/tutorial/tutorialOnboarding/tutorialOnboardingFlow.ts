import { formatDuration } from '../../../../ui/formatters'
import type { RuntimeScenarioDirectives } from '../../../scenarioDirectiveTypes'
import type {
  PromptDefinition,
  PromptResolverContext,
  PromptValue,
} from '../../../scenarioPromptTypes'
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

const tutorialOnboardingPromptDefinitions: Record<
  TutorialOnboardingStepId,
  PromptDefinition
> = {
  'intro-show-thrust-control': {
    id: 'intro-show-thrust-control',
    title: ({ inputMode }) =>
      inputMode === 'mobile' ? 'Open Burn Control' : 'Show Thrust Control',
    shortLabel: ({ inputMode }) =>
      inputMode === 'mobile' ? 'Open Burn Control' : 'Show Thrust Control',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Swipe inward from the Burn tab on the screen edge to open the thrust control.'
        : 'Press W or Up Arrow to wake the main engine and start pushing your path away from Earth.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-control' : 'trajectory',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'burn' : undefined,
    },
  },
  'intro-thrust': {
    id: 'intro-thrust',
    title: 'Use Thrust',
    shortLabel: 'Use Thrust',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Drag the orange handle upward to turn thrust on. Hold it briefly while your path starts bending away from Earth.'
        : 'Keep W or Up Arrow held briefly so the main engine can start widening your escape path.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-control' : 'trajectory',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'burn' : undefined,
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
      focusedHudElement: 'speed-pill',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'burn' : undefined,
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
    presentation: {
      kind: 'coach',
      anchor: 'speed-pill',
      focusedHudElement: 'speed-pill',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'burn' : undefined,
    },
  },
  'intro-thrusting-off': {
    id: 'intro-thrusting-off',
    title: 'Thrusting Off',
    shortLabel: 'Thrusting Off',
    buttons: [],
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Drag the orange handle back down to turn thrust off.'
        : 'Release W or Up Arrow so the main engine shuts down.',
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'thrust-control' : 'speed-pill',
      focusedHudElement: ({ inputMode }) =>
        inputMode === 'mobile' ? undefined : 'speed-pill',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'burn' : undefined,
    },
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
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'Swipe inward from the Warp tab on the screen edge, then drag the selector upward until the time pill reaches at least x1m.'
        : 'Increase time warp until the time pill reaches at least x1m.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'time-warp-control' : 'trajectory',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'warp' : undefined,
    },
  },
  'intro-timewarp-thrust': {
    id: 'intro-timewarp-thrust',
    title: 'Burn At x1m',
    shortLabel: 'Burn At x1m',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? 'The tutorial is turning you outward from the nearest body. Keep the time pill at x1m, the one-minute warp notch, then open Burn and hold the orange handle upward for 2 seconds.'
        : 'The tutorial is turning you outward from the nearest body. Keep the time pill at x1m, the one-minute warp notch, then hold W or Up Arrow for 2 seconds.',
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'trajectory',
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
    pausesGameplay: true,
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
    pausesGameplay: true,
    presentation: { kind: 'coach', anchor: 'trajectory' },
  },
}

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
  const focusedTouchControl =
    presentation.kind === 'coach' && 'focusedTouchControl' in presentation
      ? presentation.focusedTouchControl
        ? resolvePromptValue(presentation.focusedTouchControl, inputMode)
        : undefined
      : undefined
  const focusedHudElement =
    presentation.kind === 'coach' && 'focusedHudElement' in presentation
      ? presentation.focusedHudElement
        ? resolvePromptValue(presentation.focusedHudElement, inputMode)
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
    focusedHudElement,
    focusedTouchControl,
    pausesGameplay: definition.pausesGameplay ?? false,
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
    return new Set([
      'scenarioInfoButton',
      'targetControl',
      'timeWarpPill',
      'trajectory',
    ])
  }

  if (
    state.activeStepId === 'intro-timewarp' ||
    state.activeStepId === 'intro-timewarp-thrust'
  ) {
    return new Set(['scenarioInfoButton', 'targetControl', 'trajectory'])
  }

  if (state.activeStepId === 'intro-trajectory') {
    return new Set(['scenarioInfoButton'])
  }

  return emptyHiddenUIElements
}

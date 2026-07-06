import { formatDuration } from '../../../../ui/formatters'
import type { RuntimeScenarioDirectives } from '../../../scenarioDirectiveTypes'
import type {
  PromptDefinition,
  PromptResolverContext,
  PromptValue,
} from '../../../scenarioPromptTypes'
import { requiredIntroKeepThrustMs, requiredTimeWarpKeepMs } from './config'
import type {
  TutorialOnboardingPromptContent,
  TutorialOnboardingState,
  TutorialOnboardingStepId,
} from './tutorialOnboardingTypes'

export const tutorialOnboardingStepOrder: TutorialOnboardingStepId[] = [
  'intro-show-thrust-control',
  'intro-thrust',
  'intro-keep-thrusting',
  'intro-thrusting-off',
  'intro-point-and-turn',
  'intro-timewarp',
  'intro-keep-timewarp',
  'intro-timewarp-thrust',
  'intro-trajectory',
  'intro-complete',
]

const getActionPromptLayout = ({ inputMode }: PromptResolverContext) =>
  inputMode === 'mobile' ? 'bottom' : 'anchored'

const hasOnboardingAdvanceButton = (definition: PromptDefinition): boolean =>
  definition.buttons.some(
    (button) =>
      button.action.kind === 'scenario' &&
      button.action.id === 'advance-onboarding-step',
  )

const withMobileBottomLayoutForActionPrompts = (
  definitions: Record<TutorialOnboardingStepId, PromptDefinition>,
): Record<TutorialOnboardingStepId, PromptDefinition> => {
  const nextDefinitions = { ...definitions }

  for (const stepId of tutorialOnboardingStepOrder) {
    const definition = definitions[stepId]
    if (
      !hasOnboardingAdvanceButton(definition) ||
      definition.presentation.kind !== 'coach'
    ) {
      continue
    }

    nextDefinitions[stepId] = {
      ...definition,
      presentation: {
        ...definition.presentation,
        layout: getActionPromptLayout,
      },
    }
  }

  return nextDefinitions
}

const tutorialOnboardingPromptDefinitions: Record<
  TutorialOnboardingStepId,
  PromptDefinition
> = withMobileBottomLayoutForActionPrompts({
  'intro-show-thrust-control': {
    id: 'intro-show-thrust-control',
    title: ({ inputMode }) =>
      inputMode === 'mobile' ? 'Open Burn Control' : 'Start A Burn',
    shortLabel: ({ inputMode }) =>
      inputMode === 'mobile' ? 'Open Burn Control' : 'Start A Burn',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? [
            'Swipe inward from the ',
            { text: 'Burn tab', tone: 'concept' },
            ' on the screen edge to open the burn control.',
          ]
        : [
            'Press ',
            { text: 'W or Up Arrow', tone: 'concept' },
            ' to start a burn.',
          ],
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
    title: 'Start A Burn',
    shortLabel: 'Start A Burn',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? [
            'Drag the ',
            { text: 'orange handle', tone: 'concept' },
            ' upward and hold it for a moment to give the ship a short burn.',
          ]
        : [
            'Hold ',
            { text: 'W or Up Arrow', tone: 'concept' },
            ' for a moment to give the ship a short burn.',
          ],
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
    title: 'Keep Burning',
    shortLabel: 'Keep Burning',
    description: [
      "That's it. Keep the ",
      { text: 'burn', tone: 'concept' },
      ' going for ',
      {
        text: formatDuration(requiredIntroKeepThrustMs / 1000),
        tone: 'number',
      },
      '. Watch the ',
      { text: 'speed pill', tone: 'concept' },
      ' while the ship picks up speed.',
    ],
    buttons: [],
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
    title: 'Stop The Burn',
    shortLabel: 'Stop The Burn',
    buttons: [],
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? [
            'Drag the ',
            { text: 'orange handle', tone: 'concept' },
            ' back down to stop the burn.',
          ]
        : [
            'Release ',
            { text: 'W or Up Arrow', tone: 'concept' },
            ' to stop the burn.',
          ],
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
    description: [
      { text: 'Double-tap open space', tone: 'concept' },
      ' away from ',
      { text: 'Earth', tone: 'concept' },
      ' to set a new heading. Wait while the ship turns to face it.',
    ],
    buttons: [],
    presentation: { kind: 'coach', layout: 'playfield' },
  },
  'intro-timewarp': {
    id: 'intro-timewarp',
    title: 'Set Time Warp',
    shortLabel: 'Set Time Warp',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? [
            'Swipe inward from the ',
            { text: 'Warp tab', tone: 'concept' },
            ' on the screen edge, then drag the selector upward until the ',
            { text: 'time pill', tone: 'concept' },
            ' reaches ',
            { text: 'x30s', tone: 'number' },
            '.',
          ]
        : [
            'Increase ',
            { text: 'time warp', tone: 'concept' },
            ' until the time pill reaches ',
            { text: 'x30s', tone: 'number' },
            '.',
          ],
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: ({ inputMode }) =>
        inputMode === 'mobile' ? 'time-warp-control' : 'trajectory',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'warp' : undefined,
    },
  },
  'intro-keep-timewarp': {
    id: 'intro-keep-timewarp',
    title: 'Keep x30s',
    shortLabel: 'Keep x30s',
    description: [
      'Keep ',
      { text: 'time warp', tone: 'concept' },
      ' at ',
      { text: 'x30s', tone: 'number' },
      ' for ',
      {
        text: formatDuration(requiredTimeWarpKeepMs / 1000),
        tone: 'number',
      },
      '. Time warp speeds up the simulation so you can see the orbit change without waiting in real time.',
    ],
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'time-warp-pill',
      focusedHudElement: 'time-warp-pill',
      focusedTouchControl: ({ inputMode }) =>
        inputMode === 'mobile' ? 'warp' : undefined,
    },
  },
  'intro-timewarp-thrust': {
    id: 'intro-timewarp-thrust',
    title: 'Burn At x30s',
    shortLabel: 'Burn At x30s',
    description: ({ inputMode }) =>
      inputMode === 'mobile'
        ? [
            'Keep ',
            { text: 'time warp', tone: 'concept' },
            ' at ',
            { text: 'x30s', tone: 'number' },
            ', then open ',
            { text: 'Burn', tone: 'concept' },
            ' and hold the handle up for a few seconds to move away from ',
            { text: 'Earth', tone: 'concept' },
            '.',
          ]
        : [
            'Keep ',
            { text: 'time warp', tone: 'concept' },
            ' at ',
            { text: 'x30s', tone: 'number' },
            ', then hold ',
            { text: 'W or Up Arrow', tone: 'concept' },
            ' for a few seconds to move away from ',
            { text: 'Earth', tone: 'concept' },
            '.',
          ],
    buttons: [],
    presentation: {
      kind: 'coach',
      anchor: 'trajectory',
      layout: 'floating',
    },
  },
  'intro-trajectory': {
    id: 'intro-trajectory',
    title: 'This Is Your Trajectory',
    shortLabel: 'This Is Your Trajectory',
    description: [
      'This line predicts your path from ',
      { text: 'speed and gravity', tone: 'concept' },
      '. Use it to tell whether your ',
      { text: 'burn', tone: 'concept' },
      ' is moving you away from ',
      { text: 'Earth', tone: 'concept' },
      '. Aim near ',
      { text: '10 km/s', tone: 'number' },
      ' for the Earth-Moon setup, but treat it as guidance: trajectory shape matters, and too much speed makes Moon capture harder.',
    ],
    buttons: [],
    presentation: { kind: 'coach', anchor: 'trajectory', layout: 'floating' },
  },
  'intro-complete': {
    id: 'intro-complete',
    title: 'Free Flight Unlocked',
    shortLabel: 'Free Flight Unlocked',
    description: [
      'You have the ',
      { text: 'core controls', tone: 'concept' },
      '. Keep flying until you get ',
      { text: 'five Earth radii', tone: 'number' },
      ' away from the planet.',
    ],
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
})

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
    presentation.kind === 'coach' && presentation.anchor
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
  const layout =
    presentation.kind === 'coach'
      ? presentation.layout
        ? (resolvePromptValue(presentation.layout, inputMode) ?? 'anchored')
        : 'anchored'
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
    layout,
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
    state.activeStepId === 'intro-thrust'
  ) {
    return new Set([
      'scenarioInfoButton',
      'targetControl',
      'targetPill',
      'timeWarpPill',
      'trajectory',
    ])
  }

  if (
    state.activeStepId === 'intro-keep-thrusting' ||
    state.activeStepId === 'intro-thrusting-off'
  ) {
    return new Set([
      'scenarioInfoButton',
      'targetControl',
      'targetPill',
      'timeWarpPill',
      'trajectory',
    ])
  }

  if (state.activeStepId === 'intro-point-and-turn') {
    return new Set([
      'scenarioInfoButton',
      'targetControl',
      'targetPill',
      'thrustControl',
      'timeWarpPill',
      'trajectory',
    ])
  }

  if (
    state.activeStepId === 'intro-timewarp' ||
    state.activeStepId === 'intro-keep-timewarp'
  ) {
    return new Set([
      'scenarioInfoButton',
      'targetControl',
      'targetPill',
      'thrustControl',
    ])
  }

  if (state.activeStepId === 'intro-timewarp-thrust') {
    const hiddenElements: RuntimeScenarioDirectives['hiddenUIElements'] =
      new Set(['scenarioInfoButton', 'targetControl', 'targetPill'])

    if (state.progress.hasStartedMainBurn !== true) {
      hiddenElements.add('trajectory')
    }

    return hiddenElements
  }

  if (state.activeStepId === 'intro-trajectory') {
    return new Set(['scenarioInfoButton', 'targetControl'])
  }

  if (state.activeStepId === 'intro-complete') {
    return new Set(['scenarioInfoButton', 'targetControl'])
  }

  return emptyHiddenUIElements
}

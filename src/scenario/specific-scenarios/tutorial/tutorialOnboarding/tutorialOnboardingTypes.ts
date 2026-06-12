import type {
  ScenarioHudFocusTarget,
  ScenarioPromptAnchor,
  ScenarioTouchControlFocusTarget,
  ScenarioTouchHintTarget,
} from '../../../scenarioPromptTypes'

export type TutorialOnboardingStepId =
  | 'intro-show-thrust-control'
  | 'intro-thrust'
  | 'intro-keep-thrusting'
  | 'intro-thrusting-complete'
  | 'intro-thrusting-off'
  | 'intro-point-and-turn'
  | 'intro-timewarp'
  | 'intro-timewarp-thrust'
  | 'intro-trajectory'
  | 'intro-complete'

export type TutorialOnboardingPromptContent = {
  confirmAction?: 'advance-step'
  confirmLabel?: string
  description: string
  title: string
  anchor?: ScenarioPromptAnchor
  focusedHudElement?: ScenarioHudFocusTarget
  focusedTouchControl?: ScenarioTouchControlFocusTarget
  touchHintTarget?: ScenarioTouchHintTarget
}

export type TutorialOnboardingStepProgress = {
  accumulatedHeadingChangeRadians: number
  accumulatedMainThrustMs: number
  lastSampleHeading: number | null
  lastSampleAtMs: number | null
  stepStartHeading: number | null
  stepStartTouchThrustControlEngaged: boolean
  stepStartTargetHeadingSelectionEpoch: number
  stepStartTimeWarpMultiplier: number
}

export type TutorialOnboardingState = {
  activeStepId: TutorialOnboardingStepId | null
  completedStepIds: TutorialOnboardingStepId[]
  gateActive: boolean
  progress: TutorialOnboardingStepProgress
}

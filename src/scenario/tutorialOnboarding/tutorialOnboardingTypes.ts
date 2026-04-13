export type TutorialOnboardingStepId =
  | "intro-thrust"
  | "intro-turn"
  | "intro-point-and-turn"
  | "intro-timewarp"
  | "intro-timewarp-thrust"
  | "intro-trajectory"
  | "intro-complete";

export type TutorialOnboardingFocusTarget = "playfield" | "timewarp-pill" | "touch-controls";

export type TutorialOnboardingPromptContent = {
  confirmLabel?: string;
  description: string;
  focusTargets: TutorialOnboardingFocusTarget[];
  title: string;
};

export type TutorialOnboardingStepProgress = {
  accumulatedHeadingChangeRadians: number;
  accumulatedMainThrustMs: number;
  lastSampleHeading: number | null;
  lastSampleAtMs: number | null;
  stepStartHeading: number | null;
  stepStartTargetHeadingSelectionEpoch: number;
  stepStartTimeWarpMultiplier: number;
};

export type TutorialOnboardingState = {
  activeStepId: TutorialOnboardingStepId | null;
  completedStepIds: TutorialOnboardingStepId[];
  gateActive: boolean;
  progress: TutorialOnboardingStepProgress;
};

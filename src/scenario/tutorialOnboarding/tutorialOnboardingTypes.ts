import type { ScenarioPromptAnchor } from "../scenarioRegistry";

export type TutorialOnboardingStepId =
	| "intro-thrust"
	| "intro-keep-thrusting"
	| "intro-thrusting-complete"
	| "intro-turn"
	| "intro-point-and-turn"
	| "intro-timewarp"
	| "intro-timewarp-thrust"
	| "intro-trajectory"
	| "intro-complete";

export type TutorialOnboardingPromptContent = {
	confirmAction?: "advance-step";
	confirmLabel?: string;
	description: string;
	title: string;
	anchor?: ScenarioPromptAnchor;
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

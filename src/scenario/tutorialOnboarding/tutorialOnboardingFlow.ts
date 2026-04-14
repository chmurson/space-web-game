import { formatDuration } from "../../ui/formatters";
import type { RuntimeScenarioDirectives } from "../scenarioDirectiveTypes";
import { requiredIntroKeepThrustMs } from "./config";
import type {
	TutorialOnboardingPromptContent,
	TutorialOnboardingState,
	TutorialOnboardingStepId,
} from "./tutorialOnboardingTypes";

export const tutorialOnboardingStepOrder: TutorialOnboardingStepId[] = [
	"intro-thrust",
	"intro-keep-thrusting",
	"intro-thrusting-complete",
	"intro-turn",
	"intro-point-and-turn",
	"intro-timewarp",
	"intro-timewarp-thrust",
	"intro-trajectory",
	"intro-complete",
];

export const getTutorialOnboardingPromptContent = (
	stepId: TutorialOnboardingStepId,
	inputMode: "desktop" | "mobile",
): TutorialOnboardingPromptContent => {
	if (stepId === "intro-thrust") {
		return {
			title: "Use Thrust",
			description:
				inputMode === "mobile"
					? `Press and hold in the lower control area for about ${formatDuration(requiredIntroKeepThrustMs / 1000)} to fire the main engine and start changing your path.`
					: "Hold W or Up Arrow for about 2 seconds to fire the main engine and start changing your path.",
		};
	}

	if (stepId === "intro-keep-thrusting") {
		return {
			title: "Keep Thrusting",
      description: `That's great. Keep thrusting for ${formatDuration(requiredIntroKeepThrustMs / 1000)}.`,
			anchor: 'speed-pill'
		};
	}

	if (stepId === "intro-thrusting-complete") {
		return {
			title: "Nice!",
			description: `That's great. Here you can see if your thrust is active. Also, your current speed is displayed.`,
			confirmAction: "advance-step",
			confirmLabel: "Continue",
			anchor: 'speed-pill'
		};
	}

	if (stepId === "intro-turn") {
		return {
			title: "Turn The Ship",
			description:
				inputMode === "mobile"
					? "Drag sideways in the lower control area until you have turned a total of at least 90 degrees. You can do it in one direction or split it across both directions."
					: "Press A or D, or Left/Right Arrow keys to turn the ship. Rotate at least 90 degrees in total, which you can do in one direction or split across both directions."
		};
	}

	if (stepId === "intro-point-and-turn") {
		return {
			title: "Point By Double-Tapping",
			description:
				"Double-tap the playfield to set a heading directly. Wait until the ship finishes turning to that new heading.",
		};
	}

	if (stepId === "intro-timewarp") {
		return {
			title: "Raise Time Warp",
			description:
				"Increase time warp until the time pill reaches at least 100x.",
		};
	}

	if (stepId === "intro-timewarp-thrust") {
		return {
			title: "Burn At 100x",
			description:
				"The tutorial is turning you outward from the nearest body. Keep time warp at 100x or higher, then hold thrust in the lower control area for 2 seconds.",
		};
	}

	if (stepId === "intro-trajectory") {
		return {
			title: "Read The Trajectory",
			description:
				"The projected line shows where your current motion is taking you. Thrust, turning, and time warp let you inspect and reshape that future path.",
			confirmAction: "advance-step",
			confirmLabel: "Continue",
		};
	}

	return {
		title: "Free Flight Unlocked",
		description:
			"You have the core controls. Keep flying until you get five Earth radii away from the planet.",
		confirmAction: "advance-step",
		confirmLabel: "Continue",
	};
};

const emptyHiddenUIElements =
	new Set() as RuntimeScenarioDirectives["hiddenUIElements"];

export const getHiddenOnboardingUIElements = (
	state?: TutorialOnboardingState,
): RuntimeScenarioDirectives["hiddenUIElements"] => {
	if (!state) return emptyHiddenUIElements;

	if (
		state.activeStepId === "intro-thrust" ||
		state.activeStepId === "intro-keep-thrusting" ||
		state.activeStepId === "intro-turn" ||
		state.activeStepId === "intro-point-and-turn" ||
		state.activeStepId === "intro-thrusting-complete"
	) {
		return new Set(["scenarioInfoButton", "timeWarpPill", "trajectory"]);
	}

	if (
		state.activeStepId === "intro-timewarp" ||
		state.activeStepId === "intro-timewarp-thrust"
	) {
		return new Set(["scenarioInfoButton", "trajectory"]);
	}

	if (state.activeStepId === "intro-trajectory") {
		return new Set(["scenarioInfoButton"]);
	}

	return emptyHiddenUIElements;
};

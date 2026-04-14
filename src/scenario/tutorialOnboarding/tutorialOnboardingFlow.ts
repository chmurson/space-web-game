import type { RuntimeScenarioDirectives } from "../scenarioDirectiveTypes";
import type {
  TutorialOnboardingFocusTarget,
  TutorialOnboardingPromptContent,
  TutorialOnboardingState,
  TutorialOnboardingStepId,
} from "./tutorialOnboardingTypes";

const emptyFocusTargets: TutorialOnboardingFocusTarget[] = [];
export const tutorialOnboardingStepOrder: TutorialOnboardingStepId[] = [
  "intro-thrust",
  "intro-keep-thrusting",
  "intro-turn",
  "intro-point-and-turn",
  "intro-timewarp",
  "intro-timewarp-thrust",
  "intro-trajectory",
  "intro-complete",
];

const getDesktopPromptContent = (stepId: TutorialOnboardingStepId): TutorialOnboardingPromptContent => {
  if (stepId === "intro-thrust") {
    return {
      title: "Use Thrust",
      description: "Hold W or Up Arrow for about 2 seconds to fire the main engine and start changing your path.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-keep-thrusting") {
    return {
      title: "Keep Thrusting",
      description: "That's great. Here you can see if your thrust is active and your current speed. Keep thrusting for 2 seconds.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-turn") {
    return {
      title: "Turn The Ship",
      description: "Use A/D or Left/Right Arrow until you have turned a total of at least 90 degrees. You can do it in one direction or split it across both directions.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-point-and-turn") {
    return {
      title: "Point By Double-Clicking",
      description: "Double-click somewhere in space to set a heading directly. Wait until the ship finishes turning to that new heading.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-timewarp") {
    return {
      title: "Raise Time Warp",
      description: "Increase time warp until the time pill reaches at least 100x.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-timewarp-thrust") {
    return {
      title: "Burn At 100x",
      description: "The tutorial is turning you outward from the nearest body. Keep time warp at 100x or higher and hold thrust for 2 seconds.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-trajectory") {
    return {
      title: "Read The Trajectory",
      description:
        "The projected line shows where your current motion is taking you. Thrust, turning, and time warp let you inspect and reshape that future path.",
      confirmLabel: "Continue",
      focusTargets: emptyFocusTargets,
    };
  }

  return {
    title: "Free Flight Unlocked",
    description: "You have the core controls. Keep flying until you get five Earth radii away from the planet.",
    confirmLabel: "Continue",
    focusTargets: emptyFocusTargets,
  };
};

const getMobilePromptContent = (stepId: TutorialOnboardingStepId): TutorialOnboardingPromptContent => {
  if (stepId === "intro-thrust") {
    return {
      title: "Use Thrust",
      description: "Press and hold in the lower control area for about 2 seconds to fire the main engine and start changing your path.",
      focusTargets: ["touch-controls"],
    };
  }

  if (stepId === "intro-keep-thrusting") {
    return {
      title: "Keep Thrusting",
      description: "That's great. Here you can see if your thrust is active and your current speed. Keep thrusting for 2 seconds.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-turn") {
    return {
      title: "Turn The Ship",
      description: "Drag sideways in the lower control area until you have turned a total of at least 90 degrees. You can do it in one direction or split it across both directions.",
      focusTargets: ["touch-controls"],
    };
  }

  if (stepId === "intro-point-and-turn") {
    return {
      title: "Point By Double-Tapping",
      description: "Double-tap the playfield to set a heading directly. Wait until the ship finishes turning to that new heading.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-timewarp") {
    return {
      title: "Raise Time Warp",
      description: "Increase time warp until the time pill reaches at least 100x.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-timewarp-thrust") {
    return {
      title: "Burn At 100x",
      description:
        "The tutorial is turning you outward from the nearest body. Keep time warp at 100x or higher, then hold thrust in the lower control area for 2 seconds.",
      focusTargets: emptyFocusTargets,
    };
  }

  if (stepId === "intro-trajectory") {
    return {
      title: "Read The Trajectory",
      description:
        "The projected line shows where your current motion is taking you. Thrust, turning, and time warp let you inspect and reshape that future path.",
      confirmLabel: "Continue",
      focusTargets: emptyFocusTargets,
    };
  }

  return {
    title: "Free Flight Unlocked",
    description: "You have the core controls. Keep flying until you get five Earth radii away from the planet.",
    confirmLabel: "Continue",
    focusTargets: emptyFocusTargets,
  };
};

export const getTutorialOnboardingPromptContent = (
  stepId: TutorialOnboardingStepId,
  inputMode: "desktop" | "mobile",
): TutorialOnboardingPromptContent => (inputMode === "mobile" ? getMobilePromptContent(stepId) : getDesktopPromptContent(stepId));

const emptyHiddenUIElements = new Set() as RuntimeScenarioDirectives['hiddenUIElements'];

export const getHiddenOnboardingUIElements = (state?: TutorialOnboardingState): RuntimeScenarioDirectives['hiddenUIElements']  => {
  if (!state) return emptyHiddenUIElements;

  if (state.activeStepId === "intro-thrust" || state.activeStepId === "intro-keep-thrusting" || state.activeStepId === "intro-turn" || state.activeStepId === "intro-point-and-turn") {
    return new Set(["scenarioInfoButton", "timeWarpPill", "trajectory"]);
  }

  if (state.activeStepId === "intro-timewarp" || state.activeStepId === "intro-timewarp-thrust") {
    return new Set(["scenarioInfoButton", "trajectory"]);
  }

  if (state.activeStepId === "intro-trajectory")  {
    return new Set(["scenarioInfoButton"]);
  }

  return emptyHiddenUIElements;
};

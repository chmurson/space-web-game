import type { AppRuntimeState } from "../../runtime/appRuntimeState";
import { length, normalize, sub, vec } from "../../simulation/vector";
import type { Body } from "../../simulation/types";
import { getTutorialOnboardingPromptContent, tutorialOnboardingStepOrder } from "./tutorialOnboardingFlow";
import type { TutorialOnboardingState, TutorialOnboardingStepId, TutorialOnboardingStepProgress } from "./tutorialOnboardingTypes";

const requiredIntroThrustMs = 2_000;
const requiredTurnRadians = Math.PI / 2;
const requiredHighWarpMultiplier = 100;
const requiredHighWarpThrustMs = 2_000;
const outwardHeadingToleranceRadians = Math.PI / 6;

const normalizeAngleDelta = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

const createStepProgress = (
  runtime: AppRuntimeState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingStepProgress => ({
  accumulatedHeadingChangeRadians: 0,
  accumulatedMainThrustMs: 0,
  lastSampleHeading: runtime.state.spacecraft.heading,
  lastSampleAtMs: nowMs,
  stepStartHeading: runtime.state.spacecraft.heading,
  stepStartTargetHeadingSelectionEpoch: runtime.targetHeadingSelectionEpoch,
  stepStartTimeWarpMultiplier: timeWarpMultiplier,
});

const getNextStepId = (stepId: TutorialOnboardingStepId): TutorialOnboardingStepId | null => {
  const stepIndex = tutorialOnboardingStepOrder.indexOf(stepId);
  if (stepIndex < 0 || stepIndex >= tutorialOnboardingStepOrder.length - 1) {
    return null;
  }

  return tutorialOnboardingStepOrder[stepIndex + 1] ?? null;
};

const getNearestBody = (runtime: AppRuntimeState): Body | null => {
  let nearestBody: Body | null = null;
  let nearestSurfaceDistance = Number.POSITIVE_INFINITY;

  for (const body of runtime.state.bodies) {
    const surfaceDistance = Math.max(0, length(sub(runtime.state.spacecraft.position, body.position)) - body.radius);
    if (surfaceDistance < nearestSurfaceDistance) {
      nearestSurfaceDistance = surfaceDistance;
      nearestBody = body;
    }
  }

  return nearestBody;
};

const getOutwardHeading = (runtime: AppRuntimeState, nearestBody: Body | null) => {
  if (!nearestBody) {
    return runtime.state.spacecraft.heading;
  }

  const radialDirection = normalize(sub(runtime.state.spacecraft.position, nearestBody.position));
  const safeDirection = length(radialDirection) > 0 ? radialDirection : vec(1, 0);
  return Math.atan2(safeDirection.y, safeDirection.x);
};

const isHeadingOutwardFromNearestBody = (runtime: AppRuntimeState, nearestBody: Body | null) => {
  if (!nearestBody) {
    return true;
  }

  const outwardHeading = getOutwardHeading(runtime, nearestBody);
  return Math.abs(normalizeAngleDelta(runtime.state.spacecraft.heading - outwardHeading)) <= outwardHeadingToleranceRadians;
};

const setStepId = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nextStepId: TutorialOnboardingStepId | null,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState => {
  if (nextStepId === null) {
    return {
      ...onboarding,
      activeStepId: null,
      gateActive: false,
      progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
    };
  }

  if (nextStepId === "intro-timewarp-thrust") {
    const nearestBody = getNearestBody(runtime);
    runtime.targetHeading = getOutwardHeading(runtime, nearestBody);
    runtime.assistMode = "off";
  }

  return {
    activeStepId: nextStepId,
    completedStepIds: onboarding.activeStepId ? [...onboarding.completedStepIds, onboarding.activeStepId] : onboarding.completedStepIds,
    gateActive: true,
    progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
  };
};

const advanceToNextStep = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
) => setStepId(runtime, onboarding, onboarding.activeStepId ? getNextStepId(onboarding.activeStepId) : null, nowMs, timeWarpMultiplier);

export const createTutorialOnboardingState = (runtime: AppRuntimeState, nowMs: number, timeWarpMultiplier: number): TutorialOnboardingState => ({
  activeStepId: tutorialOnboardingStepOrder[0],
  completedStepIds: [],
  gateActive: true,
  progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
});

export const getTutorialOnboardingDisplayPrompt = (
  onboarding: TutorialOnboardingState | undefined,
  inputMode: "desktop" | "mobile",
) => {
  if (!onboarding?.gateActive || !onboarding.activeStepId) {
    return null;
  }

  return getTutorialOnboardingPromptContent(onboarding.activeStepId, inputMode);
};

export const advanceTutorialOnboarding = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState => {
  if (!onboarding.gateActive || !onboarding.activeStepId) {
    return onboarding;
  }

  const deltaMs = onboarding.progress.lastSampleAtMs === null ? 0 : Math.max(0, nowMs - onboarding.progress.lastSampleAtMs);
  const nextProgress: TutorialOnboardingStepProgress = {
    ...onboarding.progress,
    lastSampleAtMs: nowMs,
  };

  if (onboarding.activeStepId === "intro-thrust") {
    nextProgress.accumulatedMainThrustMs =
      runtime.state.controls.main > 0 ? onboarding.progress.accumulatedMainThrustMs + deltaMs : 0;
    return nextProgress.accumulatedMainThrustMs >= requiredIntroThrustMs
      ? advanceToNextStep(runtime, { ...onboarding, progress: nextProgress }, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress };
  }

  if (onboarding.activeStepId === "intro-keep-thrusting") {
    nextProgress.accumulatedMainThrustMs =
      runtime.state.controls.main > 0 ? onboarding.progress.accumulatedMainThrustMs + deltaMs : 0;
    return nextProgress.accumulatedMainThrustMs >= requiredIntroThrustMs
      ? advanceToNextStep(runtime, { ...onboarding, progress: nextProgress }, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress };
  }

  if (onboarding.activeStepId === "intro-turn") {
    nextProgress.accumulatedHeadingChangeRadians =
      onboarding.progress.accumulatedHeadingChangeRadians +
      Math.abs(normalizeAngleDelta(runtime.state.spacecraft.heading - (onboarding.progress.lastSampleHeading ?? runtime.state.spacecraft.heading)));
    nextProgress.lastSampleHeading = runtime.state.spacecraft.heading;
    return nextProgress.accumulatedHeadingChangeRadians >= requiredTurnRadians
      ? advanceToNextStep(runtime, { ...onboarding, progress: nextProgress }, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress };
  }

  if (onboarding.activeStepId === "intro-point-and-turn") {
    return runtime.targetHeadingSelectionEpoch > onboarding.progress.stepStartTargetHeadingSelectionEpoch && runtime.targetHeading === null
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress };
  }

  if (onboarding.activeStepId === "intro-timewarp") {
    const stepStartedBelowRequirement = onboarding.progress.stepStartTimeWarpMultiplier < requiredHighWarpMultiplier;
    if (stepStartedBelowRequirement) {
      return timeWarpMultiplier >= requiredHighWarpMultiplier
        ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
        : { ...onboarding, progress: nextProgress };
    }

    return onboarding.progress.stepStartTimeWarpMultiplier >= requiredHighWarpMultiplier && timeWarpMultiplier < requiredHighWarpMultiplier
      ? {
          ...onboarding,
          progress: {
            ...nextProgress,
            stepStartTimeWarpMultiplier: 0,
          },
        }
      : { ...onboarding, progress: nextProgress };
  }

  if (onboarding.activeStepId === "intro-timewarp-thrust") {
    const nearestBody = getNearestBody(runtime);
    const outwardAligned = isHeadingOutwardFromNearestBody(runtime, nearestBody);
    nextProgress.accumulatedMainThrustMs =
      outwardAligned && timeWarpMultiplier >= requiredHighWarpMultiplier && runtime.state.controls.main > 0
        ? onboarding.progress.accumulatedMainThrustMs + deltaMs
        : 0;
    return nextProgress.accumulatedMainThrustMs >= requiredHighWarpThrustMs
      ? advanceToNextStep(runtime, { ...onboarding, progress: nextProgress }, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress };
  }

  return { ...onboarding, progress: nextProgress };
};

export const acknowledgeTutorialOnboardingPrompt = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState | null => {
  if (!onboarding.gateActive || !onboarding.activeStepId) {
    return null;
  }

  if (onboarding.activeStepId !== "intro-trajectory" && onboarding.activeStepId !== "intro-complete") {
    return null;
  }

  return advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier);
};

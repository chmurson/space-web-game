import type { AppRuntimeState } from '../../../../runtime/appRuntimeState'
import type { Body } from '../../../../simulation/types'
import { length, normalize, sub, vec } from '../../../../simulation/vector'
import {
  outwardHeadingToleranceRadians,
  requiredHighWarpMultiplier,
  requiredHighWarpThrustMs,
  requiredIntroKeepThrustMs,
  requiredIntroThrustMs,
} from './config'
import {
  getTutorialOnboardingPromptContent,
  tutorialOnboardingStepOrder,
} from './tutorialOnboardingFlow'
import type {
  TutorialOnboardingState,
  TutorialOnboardingStepId,
  TutorialOnboardingStepProgress,
} from './tutorialOnboardingTypes'

const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const hasMainThrust = (runtime: AppRuntimeState) =>
  runtime.simulation.state.controls.main > 0

const hasVisibleTouchThrustControl = (runtime: AppRuntimeState) =>
  runtime.ui.touchThrustControl.visible

const hasInteractiveTouchThrustControl = (runtime: AppRuntimeState) =>
  runtime.ui.touchThrustControl.interactive

const isTouchThrustEngaged = (runtime: AppRuntimeState) =>
  runtime.ui.touchThrustControl.engaged

const createStepProgress = (
  runtime: AppRuntimeState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingStepProgress => ({
  accumulatedHeadingChangeRadians: 0,
  accumulatedMainThrustMs: 0,
  lastSampleHeading: runtime.simulation.state.spacecraft.heading,
  lastSampleAtMs: nowMs,
  stepStartHeading: runtime.simulation.state.spacecraft.heading,
  stepStartTouchThrustControlEngaged: runtime.ui.touchThrustControl.engaged,
  stepStartTargetHeadingSelectionEpoch: runtime.ui.targetHeadingSelectionEpoch,
  stepStartTimeWarpMultiplier: timeWarpMultiplier,
})

const getNextStepId = (
  stepId: TutorialOnboardingStepId,
): TutorialOnboardingStepId | null => {
  const stepIndex = tutorialOnboardingStepOrder.indexOf(stepId)
  if (stepIndex < 0 || stepIndex >= tutorialOnboardingStepOrder.length - 1) {
    return null
  }

  return tutorialOnboardingStepOrder[stepIndex + 1] ?? null
}

const getThrustRecoveryStepId = (
  runtime: AppRuntimeState,
): TutorialOnboardingStepId =>
  hasVisibleTouchThrustControl(runtime)
    ? 'intro-thrust'
    : 'intro-show-thrust-control'

const getNearestBody = (runtime: AppRuntimeState): Body | null => {
  let nearestBody: Body | null = null
  let nearestSurfaceDistance = Number.POSITIVE_INFINITY

  for (const body of runtime.simulation.state.bodies) {
    const surfaceDistance = Math.max(
      0,
      length(sub(runtime.simulation.state.spacecraft.position, body.position)) -
        body.radius,
    )
    if (surfaceDistance < nearestSurfaceDistance) {
      nearestSurfaceDistance = surfaceDistance
      nearestBody = body
    }
  }

  return nearestBody
}

const getOutwardHeading = (
  runtime: AppRuntimeState,
  nearestBody: Body | null,
) => {
  if (!nearestBody) {
    return runtime.simulation.state.spacecraft.heading
  }

  const radialDirection = normalize(
    sub(runtime.simulation.state.spacecraft.position, nearestBody.position),
  )
  const safeDirection =
    length(radialDirection) > 0 ? radialDirection : vec(1, 0)
  return Math.atan2(safeDirection.y, safeDirection.x)
}

const isHeadingOutwardFromNearestBody = (
  runtime: AppRuntimeState,
  nearestBody: Body | null,
) => {
  if (!nearestBody) {
    return true
  }

  const outwardHeading = getOutwardHeading(runtime, nearestBody)
  return (
    Math.abs(
      normalizeAngleDelta(
        runtime.simulation.state.spacecraft.heading - outwardHeading,
      ),
    ) <= outwardHeadingToleranceRadians
  )
}

const setStepId = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nextStepId: TutorialOnboardingStepId | null,
  nowMs: number,
  timeWarpMultiplier: number,
  options: {
    markCurrentStepCompleted: boolean
  },
): TutorialOnboardingState => {
  if (nextStepId === null) {
    return {
      ...onboarding,
      activeStepId: null,
      gateActive: false,
      progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
    }
  }

  if (nextStepId === 'intro-timewarp-thrust') {
    const nearestBody = getNearestBody(runtime)
    runtime.simulation.targetHeading = getOutwardHeading(runtime, nearestBody)
    runtime.simulation.assistMode = 'off'
  }

  return {
    activeStepId: nextStepId,
    completedStepIds:
      options.markCurrentStepCompleted && onboarding.activeStepId
        ? [...onboarding.completedStepIds, onboarding.activeStepId]
        : onboarding.completedStepIds,
    gateActive: true,
    progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
  }
}

const advanceToNextStep = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
) =>
  setStepId(
    runtime,
    onboarding,
    onboarding.activeStepId ? getNextStepId(onboarding.activeStepId) : null,
    nowMs,
    timeWarpMultiplier,
    { markCurrentStepCompleted: true },
  )

const goToStep = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nextStepId: TutorialOnboardingStepId,
  nowMs: number,
  timeWarpMultiplier: number,
) =>
  setStepId(runtime, onboarding, nextStepId, nowMs, timeWarpMultiplier, {
    markCurrentStepCompleted: false,
  })

export const createTutorialOnboardingState = (
  runtime: AppRuntimeState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState => ({
  activeStepId: tutorialOnboardingStepOrder[0],
  completedStepIds: [],
  gateActive: true,
  progress: createStepProgress(runtime, nowMs, timeWarpMultiplier),
})

export const getTutorialOnboardingDisplayPrompt = (
  onboarding: TutorialOnboardingState | undefined,
  inputMode: 'desktop' | 'mobile',
) => {
  if (!onboarding?.gateActive || !onboarding.activeStepId) {
    return null
  }

  return getTutorialOnboardingPromptContent(onboarding.activeStepId, inputMode)
}

export const advanceTutorialOnboarding = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState => {
  if (!onboarding.gateActive || !onboarding.activeStepId) {
    return onboarding
  }

  const deltaMs =
    onboarding.progress.lastSampleAtMs === null
      ? 0
      : Math.max(0, nowMs - onboarding.progress.lastSampleAtMs)
  const nextProgress: TutorialOnboardingStepProgress = {
    ...onboarding.progress,
    lastSampleAtMs: nowMs,
  }

  if (onboarding.activeStepId === 'intro-show-thrust-control') {
    return hasInteractiveTouchThrustControl(runtime) || hasMainThrust(runtime)
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-thrust') {
    if (!hasMainThrust(runtime)) {
      nextProgress.accumulatedMainThrustMs = 0
      return !hasVisibleTouchThrustControl(runtime)
        ? goToStep(
            runtime,
            { ...onboarding, progress: nextProgress },
            'intro-show-thrust-control',
            nowMs,
            timeWarpMultiplier,
          )
        : { ...onboarding, progress: nextProgress }
    }

    nextProgress.accumulatedMainThrustMs =
      onboarding.progress.accumulatedMainThrustMs + deltaMs
    return nextProgress.accumulatedMainThrustMs >= requiredIntroThrustMs
      ? advanceToNextStep(
          runtime,
          { ...onboarding, progress: nextProgress },
          nowMs,
          timeWarpMultiplier,
        )
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-keep-thrusting') {
    if (!hasMainThrust(runtime)) {
      nextProgress.accumulatedMainThrustMs = Math.max(
        0,
        onboarding.progress.accumulatedMainThrustMs - deltaMs * 2,
      )
      return goToStep(
        runtime,
        { ...onboarding, progress: nextProgress },
        getThrustRecoveryStepId(runtime),
        nowMs,
        timeWarpMultiplier,
      )
    }

    nextProgress.accumulatedMainThrustMs =
      onboarding.progress.accumulatedMainThrustMs + deltaMs

    return nextProgress.accumulatedMainThrustMs >= requiredIntroKeepThrustMs
      ? advanceToNextStep(
          runtime,
          { ...onboarding, progress: nextProgress },
          nowMs,
          timeWarpMultiplier,
        )
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-thrusting-off') {
    const touchControlEngaged = isTouchThrustEngaged(runtime)
    const usingTouchControlState =
      onboarding.progress.stepStartTouchThrustControlEngaged ||
      hasVisibleTouchThrustControl(runtime)

    if (
      !onboarding.progress.stepStartTouchThrustControlEngaged &&
      touchControlEngaged
    ) {
      return {
        ...onboarding,
        progress: {
          ...nextProgress,
          stepStartTouchThrustControlEngaged: true,
        },
      }
    }

    const thrustTurnedOffAndReleased = usingTouchControlState
      ? !touchControlEngaged && !hasVisibleTouchThrustControl(runtime)
      : !hasMainThrust(runtime)

    return thrustTurnedOffAndReleased
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-point-and-turn') {
    return runtime.ui.targetHeadingSelectionEpoch >
      onboarding.progress.stepStartTargetHeadingSelectionEpoch &&
      runtime.simulation.targetHeading === null
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-timewarp') {
    const stepStartedBelowRequirement =
      onboarding.progress.stepStartTimeWarpMultiplier <
      requiredHighWarpMultiplier
    if (stepStartedBelowRequirement) {
      return timeWarpMultiplier >= requiredHighWarpMultiplier
        ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
        : { ...onboarding, progress: nextProgress }
    }

    return onboarding.progress.stepStartTimeWarpMultiplier >=
      requiredHighWarpMultiplier &&
      timeWarpMultiplier < requiredHighWarpMultiplier
      ? {
          ...onboarding,
          progress: {
            ...nextProgress,
            stepStartTimeWarpMultiplier: 0,
          },
        }
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-timewarp-thrust') {
    const nearestBody = getNearestBody(runtime)
    const outwardAligned = isHeadingOutwardFromNearestBody(runtime, nearestBody)
    nextProgress.accumulatedMainThrustMs =
      outwardAligned &&
      timeWarpMultiplier >= requiredHighWarpMultiplier &&
      hasMainThrust(runtime)
        ? onboarding.progress.accumulatedMainThrustMs + deltaMs
        : 0
    return nextProgress.accumulatedMainThrustMs >= requiredHighWarpThrustMs
      ? advanceToNextStep(
          runtime,
          { ...onboarding, progress: nextProgress },
          nowMs,
          timeWarpMultiplier,
        )
      : { ...onboarding, progress: nextProgress }
  }

  return { ...onboarding, progress: nextProgress }
}

export const acknowledgeTutorialOnboardingPrompt = (
  runtime: AppRuntimeState,
  onboarding: TutorialOnboardingState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingState | null => {
  if (!onboarding.gateActive || !onboarding.activeStepId) {
    return null
  }

  const promptContent = getTutorialOnboardingPromptContent(
    onboarding.activeStepId,
    'desktop',
  )

  if (promptContent.confirmAction !== 'advance-step') {
    return null
  }

  return advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
}

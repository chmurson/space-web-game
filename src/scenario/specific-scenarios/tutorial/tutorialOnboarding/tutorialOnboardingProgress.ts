import type { AppRuntimeState } from '../../../../runtime/appRuntimeState'
import type { Body } from '../../../../simulation/types'
import {
  length,
  normalize,
  scale,
  sub,
  vec,
} from '../../../../simulation/vector'
import {
  requiredHighWarpMultiplier,
  requiredHighWarpThrustMs,
  requiredIntroKeepThrustMs,
  requiredIntroThrustMs,
  requiredTimeWarpKeepMs,
  requiredTrajectoryClearMs,
  requiredTurnRadians,
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

const hasMainThrust = (runtime: AppRuntimeState) =>
  runtime.simulation.state.controls.main > 0

const hasRevealedTouchThrustControl = (runtime: AppRuntimeState) =>
  runtime.ui.touchThrustControl.revealed

const isTouchThrustEngaged = (runtime: AppRuntimeState) =>
  runtime.ui.touchThrustControl.engaged

const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const createStepProgress = (
  runtime: AppRuntimeState,
  nowMs: number,
  timeWarpMultiplier: number,
): TutorialOnboardingStepProgress => ({
  accumulatedHeadingChangeRadians: 0,
  accumulatedMainThrustMs: 0,
  accumulatedTrajectoryClearMs: 0,
  hasStartedMainBurn: hasMainThrust(runtime),
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
  hasRevealedTouchThrustControl(runtime)
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

const getProgradeHeading = (
  runtime: AppRuntimeState,
  nearestBody: Body | null,
) => {
  if (!nearestBody) {
    return runtime.simulation.state.spacecraft.heading
  }

  const spacecraft = runtime.simulation.state.spacecraft
  const radialDirection = normalize(
    sub(spacecraft.position, nearestBody.position),
  )
  if (length(radialDirection) === 0) {
    return spacecraft.heading
  }

  const relativeVelocity = sub(spacecraft.velocity, nearestBody.velocity)
  const radialVelocity =
    relativeVelocity.x * radialDirection.x +
    relativeVelocity.y * radialDirection.y
  const tangentDirection = sub(
    relativeVelocity,
    scale(radialDirection, radialVelocity),
  )
  const safeDirection =
    length(tangentDirection) > 0
      ? tangentDirection
      : vec(-radialDirection.y, radialDirection.x)
  return Math.atan2(safeDirection.y, safeDirection.x)
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
    runtime.simulation.targetHeading = getProgradeHeading(runtime, nearestBody)
    runtime.simulation.assistMode = 'off'
  }

  return {
    activeStepId: nextStepId,
    completedStepIds:
      options.markCurrentStepCompleted &&
      onboarding.activeStepId &&
      !onboarding.completedStepIds.includes(onboarding.activeStepId)
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
  options: {
    trajectoryExitReady?: boolean
  } = {},
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
    return hasRevealedTouchThrustControl(runtime) || hasMainThrust(runtime)
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-thrust') {
    if (!hasMainThrust(runtime)) {
      nextProgress.accumulatedMainThrustMs = 0
      return !hasRevealedTouchThrustControl(runtime)
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
      hasRevealedTouchThrustControl(runtime)

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
      ? !touchControlEngaged
      : !hasMainThrust(runtime)

    return thrustTurnedOffAndReleased
      ? advanceToNextStep(runtime, onboarding, nowMs, timeWarpMultiplier)
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-point-and-turn') {
    const heading = runtime.simulation.state.spacecraft.heading
    nextProgress.accumulatedHeadingChangeRadians =
      onboarding.progress.lastSampleHeading === null
        ? onboarding.progress.accumulatedHeadingChangeRadians
        : onboarding.progress.accumulatedHeadingChangeRadians +
          Math.abs(
            normalizeAngleDelta(
              heading - onboarding.progress.lastSampleHeading,
            ),
          )
    nextProgress.lastSampleHeading = heading

    return runtime.ui.targetHeadingSelectionEpoch >
      onboarding.progress.stepStartTargetHeadingSelectionEpoch &&
      nextProgress.accumulatedHeadingChangeRadians >= requiredTurnRadians &&
      runtime.simulation.targetHeading === null
      ? advanceToNextStep(
          runtime,
          { ...onboarding, progress: nextProgress },
          nowMs,
          timeWarpMultiplier,
        )
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

  if (onboarding.activeStepId === 'intro-keep-timewarp') {
    if (timeWarpMultiplier < requiredHighWarpMultiplier) {
      return goToStep(
        runtime,
        {
          ...onboarding,
          progress: {
            ...nextProgress,
            accumulatedTimeWarpMs: 0,
            stepStartTimeWarpMultiplier: 0,
          },
        },
        'intro-timewarp',
        nowMs,
        timeWarpMultiplier,
      )
    }

    nextProgress.accumulatedTimeWarpMs =
      (onboarding.progress.accumulatedTimeWarpMs ?? 0) + deltaMs

    return nextProgress.accumulatedTimeWarpMs >= requiredTimeWarpKeepMs
      ? advanceToNextStep(
          runtime,
          { ...onboarding, progress: nextProgress },
          nowMs,
          timeWarpMultiplier,
        )
      : { ...onboarding, progress: nextProgress }
  }

  if (onboarding.activeStepId === 'intro-timewarp-thrust') {
    const highWarpBurnActive =
      timeWarpMultiplier >= requiredHighWarpMultiplier && hasMainThrust(runtime)
    nextProgress.hasStartedMainBurn =
      onboarding.progress.hasStartedMainBurn === true || highWarpBurnActive
    nextProgress.accumulatedMainThrustMs = highWarpBurnActive
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

  if (onboarding.activeStepId === 'intro-trajectory') {
    nextProgress.accumulatedTrajectoryClearMs = options.trajectoryExitReady
      ? (onboarding.progress.accumulatedTrajectoryClearMs ?? 0) + deltaMs
      : 0

    return nextProgress.accumulatedTrajectoryClearMs >=
      requiredTrajectoryClearMs
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

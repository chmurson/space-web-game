export type RcsActualTurnFeedback = {
  currentHeading: number
  opacity: number
  phase: 'active' | 'settling'
  settleCurrentHeading: number
  settleElapsedSeconds: number
  settleStartHeading: number
  startHeading: number
}

export type UpdateRcsActualTurnFeedbackOptions = {
  currentHeading: number
  dt: number
  feedback: RcsActualTurnFeedback | null | undefined
  previousHeading: number
  rcsTurnActive: boolean
}

const minFeedbackAngleRadians = 0.001
const settleDurationSeconds = 0.42

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const createActiveFeedback = (
  startHeading: number,
  currentHeading: number,
): RcsActualTurnFeedback => ({
  currentHeading: normalizeAngle(currentHeading),
  opacity: 1,
  phase: 'active',
  settleCurrentHeading: normalizeAngle(currentHeading),
  settleElapsedSeconds: 0,
  settleStartHeading: normalizeAngle(startHeading),
  startHeading: normalizeAngle(startHeading),
})

export const updateRcsActualTurnFeedback = ({
  currentHeading,
  dt,
  feedback,
  previousHeading,
  rcsTurnActive,
}: UpdateRcsActualTurnFeedbackOptions): RcsActualTurnFeedback | null => {
  const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0
  const actualDelta = normalizeAngleDelta(currentHeading - previousHeading)

  if (rcsTurnActive) {
    if (feedback?.phase === 'active') {
      return createActiveFeedback(feedback.startHeading, currentHeading)
    }

    if (Math.abs(actualDelta) < minFeedbackAngleRadians) {
      return null
    }

    return createActiveFeedback(previousHeading, currentHeading)
  }

  if (!feedback) {
    return null
  }

  const settleStartHeading =
    feedback.phase === 'settling'
      ? feedback.settleStartHeading
      : feedback.startHeading
  const settleCurrentHeading =
    feedback.phase === 'settling'
      ? feedback.settleCurrentHeading
      : feedback.currentHeading
  const totalDelta = normalizeAngleDelta(
    settleCurrentHeading - settleStartHeading,
  )

  if (Math.abs(totalDelta) < minFeedbackAngleRadians) {
    return null
  }

  const settleElapsedSeconds =
    (feedback.phase === 'settling' ? feedback.settleElapsedSeconds : 0) + safeDt
  const progress = Math.min(1, settleElapsedSeconds / settleDurationSeconds)

  if (progress >= 1) {
    return null
  }

  return {
    currentHeading: normalizeAngle(settleCurrentHeading),
    opacity: 1 - progress,
    phase: 'settling',
    settleCurrentHeading: normalizeAngle(settleCurrentHeading),
    settleElapsedSeconds,
    settleStartHeading: normalizeAngle(settleStartHeading),
    startHeading: normalizeAngle(settleStartHeading + totalDelta * progress),
  }
}

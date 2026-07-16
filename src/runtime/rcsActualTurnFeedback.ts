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
const fullRotationRadians = Math.PI * 2

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const getVisibleStartHeading = (
  startHeading: number,
  currentHeading: number,
) => {
  const delta = currentHeading - startHeading
  if (Math.abs(delta) <= fullRotationRadians) {
    return startHeading
  }

  return currentHeading - Math.sign(delta) * fullRotationRadians
}

const createActiveFeedback = (
  startHeading: number,
  currentHeading: number,
): RcsActualTurnFeedback => {
  const visibleStartHeading = getVisibleStartHeading(
    startHeading,
    currentHeading,
  )

  return {
    currentHeading,
    opacity: 1,
    phase: 'active',
    settleCurrentHeading: currentHeading,
    settleElapsedSeconds: 0,
    settleStartHeading: visibleStartHeading,
    startHeading: visibleStartHeading,
  }
}

export const updateRcsActualTurnFeedback = ({
  currentHeading,
  dt,
  feedback,
  previousHeading,
  rcsTurnActive,
}: UpdateRcsActualTurnFeedbackOptions): RcsActualTurnFeedback | null => {
  const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0
  const actualDelta = normalizeAngle(currentHeading - previousHeading)

  if (rcsTurnActive) {
    if (feedback?.phase === 'active') {
      return createActiveFeedback(
        feedback.startHeading,
        feedback.currentHeading + actualDelta,
      )
    }

    if (Math.abs(actualDelta) < minFeedbackAngleRadians) {
      return null
    }

    return createActiveFeedback(previousHeading, previousHeading + actualDelta)
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
  const totalDelta = settleCurrentHeading - settleStartHeading

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
    currentHeading: settleCurrentHeading,
    opacity: 1,
    phase: 'settling',
    settleCurrentHeading,
    settleElapsedSeconds,
    settleStartHeading,
    startHeading: settleStartHeading + totalDelta * progress,
  }
}

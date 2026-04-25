import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../../runtime/timeWarpFeedbackPolicy'

export type TouchOverlayPoint = {
  x: number
  y: number
}

export type TimeWarpFeedbackSnapshot = {
  action: TimeWarpAction | null
  anchor: TouchOverlayPoint | null
  canCommit: boolean
  mode: 'hidden' | 'preview' | 'confirmation'
  opacity: number
  reason: TimeWarpFeedbackReason | null
  value: number | null
}

export type TimeWarpFeedbackModel = {
  cancelPreview(): TimeWarpFeedbackSnapshot
  commitPreview(): {
    action: TimeWarpAction | null
    snapshot: TimeWarpFeedbackSnapshot
  }
  getSnapshot(): TimeWarpFeedbackSnapshot
  updatePreview(params: {
    action: TimeWarpAction
    anchor: TouchOverlayPoint
    isCommitEligible: boolean
    opacity: number
    reason: TimeWarpFeedbackReason | null
    value: number
  }): TimeWarpFeedbackSnapshot
}

const createSnapshot = (
  snapshot: TimeWarpFeedbackSnapshot,
): TimeWarpFeedbackSnapshot => ({
  action: snapshot.action,
  anchor: snapshot.anchor ? { ...snapshot.anchor } : null,
  canCommit: snapshot.canCommit,
  mode: snapshot.mode,
  opacity: snapshot.opacity,
  reason: snapshot.reason,
  value: snapshot.value,
})

const hideSnapshot = (snapshot: TimeWarpFeedbackSnapshot) => {
  snapshot.action = null
  snapshot.anchor = null
  snapshot.canCommit = false
  snapshot.mode = 'hidden'
  snapshot.opacity = 0
  snapshot.reason = null
  snapshot.value = null
  return createSnapshot(snapshot)
}

export const createTimeWarpFeedbackModel = (): TimeWarpFeedbackModel => {
  const snapshot: TimeWarpFeedbackSnapshot = {
    action: null,
    anchor: null,
    canCommit: false,
    mode: 'hidden',
    opacity: 0,
    reason: null,
    value: null,
  }

  return {
    cancelPreview() {
      return hideSnapshot(snapshot)
    },
    commitPreview() {
      const action = snapshot.canCommit ? snapshot.action : null

      if (
        action &&
        snapshot.anchor &&
        snapshot.value !== null &&
        snapshot.mode === 'preview'
      ) {
        snapshot.action = action
        snapshot.canCommit = false
        snapshot.mode = 'confirmation'
        snapshot.opacity = 1
        snapshot.reason = null
        return {
          action,
          snapshot: createSnapshot(snapshot),
        }
      }

      return {
        action: null,
        snapshot: hideSnapshot(snapshot),
      }
    },
    getSnapshot() {
      return createSnapshot(snapshot)
    },
    updatePreview({
      action,
      anchor,
      isCommitEligible,
      opacity,
      reason,
      value,
    }) {
      if (opacity <= 0) {
        return hideSnapshot(snapshot)
      }

      snapshot.action = action
      snapshot.anchor = { ...anchor }
      snapshot.canCommit = isCommitEligible
      snapshot.mode = 'preview'
      snapshot.opacity = opacity
      snapshot.reason = isCommitEligible ? null : reason
      snapshot.value = value
      return createSnapshot(snapshot)
    },
  }
}

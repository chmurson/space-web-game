import type { TimeWarpFeedbackReason } from '../../runtime/timeWarpFeedbackPolicy'
import type { TimeWarpPreview } from './timeWarpControlTypes'

export type TimeWarpControlStatus = {
  reason: TimeWarpFeedbackReason | null
  text: string
  tone: 'available' | 'capped'
}

const reasonLabels: Record<TimeWarpFeedbackReason, string> = {
  'control-limit': 'Active-control cap reached',
  'global-max': 'Maximum rate reached',
  'global-min': 'Minimum rate reached',
  'prediction-coverage': 'Prediction coverage cap reached',
  'scenario-limit': 'Scenario cap reached',
  'thrust-active': 'Main thrust blocks faster rates',
  turning: 'Turning blocks faster rates',
}

const getBlockedPreview = (previews: ReadonlyArray<TimeWarpPreview>) =>
  previews.find((preview) => !preview.canCommit && preview.reason)

export const getTimeWarpControlStatus = (options: {
  decreasePreview: TimeWarpPreview
  increasePreview: TimeWarpPreview
}): TimeWarpControlStatus => {
  const blocked = getBlockedPreview([
    options.increasePreview,
    options.decreasePreview,
  ])
  const reason = blocked?.reason ?? null

  if (!reason) {
    return {
      reason: null,
      text: '',
      tone: 'available',
    }
  }

  return {
    reason,
    text: reasonLabels[reason],
    tone: 'capped',
  }
}

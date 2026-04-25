import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../../runtime/timeWarpFeedbackPolicy'
import type {
  TimeWarpFeedbackSnapshot,
  TouchOverlayPoint,
} from './timeWarpFeedbackModel'
import { formatTimeWarpLabel } from '../../formatters'

export type TimeWarpFeedbackTone = 'available' | 'blocked'

export type TimeWarpFeedbackVariant = 'increase' | 'decrease'

export type TimeWarpFeedbackRenderState = {
  anchor: TouchOverlayPoint
  label: string
  mode: 'preview' | 'confirmation'
  opacity: number
  tone: TimeWarpFeedbackTone
  value: number
  variant: TimeWarpFeedbackVariant
}

const getVariant = (action: TimeWarpAction): TimeWarpFeedbackVariant =>
  action === 'increaseTimeWarp' ? 'increase' : 'decrease'

const getTone = (
  reason: TimeWarpFeedbackReason | null,
): TimeWarpFeedbackTone => (reason ? 'blocked' : 'available')

const getStatusLabel = (
  action: TimeWarpAction,
  reason: TimeWarpFeedbackReason | null,
) => {
  if (reason === 'thrust-active') {
    return ' thrust'
  }

  if (reason === 'global-max') {
    return ' max'
  }

  if (reason === 'global-min') {
    return ' min'
  }

  if (reason === 'turning') {
    return ' turn'
  }

  if (reason === 'control-limit') {
    return ' control'
  }

  if (reason === 'scenario-limit') {
    return action === 'increaseTimeWarp' ? ' max' : ' min'
  }

  return ''
}

export const formatTimeWarpFeedbackLabel = (options: {
  action: TimeWarpAction
  reason: TimeWarpFeedbackReason | null
  value: number
}): string => {
  const prefix = options.action === 'increaseTimeWarp' ? '>>' : '<<'
  return `${prefix} ${formatTimeWarpLabel(options.value)}${getStatusLabel(options.action, options.reason)}`
}

export const presentTimeWarpFeedback = (
  snapshot: TimeWarpFeedbackSnapshot,
): TimeWarpFeedbackRenderState | null => {
  if (
    snapshot.mode === 'hidden' ||
    snapshot.action === null ||
    snapshot.anchor === null ||
    snapshot.value === null
  ) {
    return null
  }

  return {
    anchor: snapshot.anchor,
    label: formatTimeWarpFeedbackLabel({
      action: snapshot.action,
      reason: snapshot.reason,
      value: snapshot.value,
    }),
    mode: snapshot.mode,
    opacity: snapshot.opacity,
    tone: getTone(snapshot.reason),
    value: snapshot.value,
    variant: getVariant(snapshot.action),
  }
}

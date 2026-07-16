import type { TimeWarpAction } from '../../../runtime/timeWarpFeedbackPolicy'
import { formatTimeWarpLabel } from '../../formatters'
import { createStepSelectorControl } from '../stepSelectorControl/createStepSelectorControl'
import type { StepSelectorDirection } from '../stepSelectorControl/stepSelectorControlTypes'
import type {
  TimeWarpControl,
  TimeWarpControlId,
  TimeWarpControlOptions,
} from '../timeWarpControlTypes'

const getAction = (direction: StepSelectorDirection): TimeWarpAction =>
  direction === 'increase' ? 'increaseTimeWarp' : 'decreaseTimeWarp'

export const createSelectorTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl =>
  createStepSelectorControl({
    ariaLabel: options.ariaLabel ?? 'Time warp control',
    axis: options.axis,
    className: ['touch-step-selector-time-warp', options.className ?? '']
      .filter(Boolean)
      .join(' '),
    commitStep: (direction) => {
      options.commitTimeWarp(getAction(direction))
    },
    container: options.container,
    controlId: options.controlId ?? ('time-warp' satisfies TimeWarpControlId),
    formatValue: formatTimeWarpLabel,
    getCurrentValue: options.getCurrentTimeWarp,
    getStepPreviews: (direction, count) =>
      options.getTimeWarpPreviews(getAction(direction), count),
    onSessionChange: options.onSessionChange,
    panel: options.panel,
  })

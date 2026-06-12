import type { TimeWarpAction } from '../../../runtime/timeWarpFeedbackPolicy'
import { formatTimeWarpLabel } from '../../formatters'
import { createStepSelectorControl } from '../stepSelectorControl/createStepSelectorControl'
import type { StepSelectorDirection } from '../stepSelectorControl/stepSelectorControlTypes'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
} from '../timeWarpControlTypes'

const getAction = (direction: StepSelectorDirection): TimeWarpAction =>
  direction === 'increase' ? 'increaseTimeWarp' : 'decreaseTimeWarp'

export const createSelectorTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl =>
  createStepSelectorControl({
    ariaLabel: 'Time warp control',
    className: 'touch-step-selector-time-warp',
    commitStep: (direction) => {
      options.commitTimeWarp(getAction(direction))
    },
    container: options.container,
    controlId: 'time-warp',
    formatValue: formatTimeWarpLabel,
    getCurrentValue: options.getCurrentTimeWarp,
    getStepPreviews: (direction, count) =>
      options.getTimeWarpPreviews(getAction(direction), count),
    onSessionChange: options.onSessionChange,
    panel: options.panel,
  })

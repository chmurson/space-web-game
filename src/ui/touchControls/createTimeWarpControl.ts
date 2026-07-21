import { createSelectorTimeWarpControl } from './selectorTimeWarpControl/createSelectorTimeWarpControl'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
} from './timeWarpControlTypes'

export const createConfiguredTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl =>
  createSelectorTimeWarpControl({
    ...options,
    ariaLabel: 'Time Warp',
    axis: 'horizontal',
    enableHorizontalMomentum: true,
    controlId: 'time-warp',
  })

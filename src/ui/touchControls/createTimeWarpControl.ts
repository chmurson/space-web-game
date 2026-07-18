import { createSelectorTimeWarpControl } from './selectorTimeWarpControl/createSelectorTimeWarpControl'
import { createSwipeTimeWarpControl } from './swipeTimeWarpControl/createSwipeTimeWarpControl'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
} from './timeWarpControlTypes'

type TimeWarpControlVariant = 'default' | 'selector'

const timeWarpControlVariant = 'selector' as TimeWarpControlVariant

export const createConfiguredTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  switch (timeWarpControlVariant) {
    case 'default':
      return createSwipeTimeWarpControl(options)
    case 'selector':
      return createSelectorTimeWarpControl(options)
  }
}

export const createPrototypeTimeWarpControl2 = (
  options: TimeWarpControlOptions,
): TimeWarpControl =>
  createSelectorTimeWarpControl({
    ...options,
    ariaLabel: 'Time Warp control 2',
    axis: 'horizontal',
    className: 'touch-step-selector-time-warp-prototype-2',
    enableHorizontalMomentum: true,
    // ponytail: Temporary issue #226 comparison UI; remove with the prototype.
    controlId: 'time-warp-2',
  })

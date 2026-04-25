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

import { createSelectorTimeWarpControl } from './selectorTimeWarpControl/createSelectorTimeWarpControl'
import { createSwipeTimeWarpControl } from './swipeTimeWarpControl/createSwipeTimeWarpControl'
import { createTimeWarpTapeControl } from './timeWarpTapeControl/createTimeWarpTapeControl'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
} from './timeWarpControlTypes'

type TimeWarpControlVariant = 'default' | 'selector' | 'tape'

const timeWarpControlVariant = 'tape' as TimeWarpControlVariant

export const createConfiguredTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  switch (timeWarpControlVariant) {
    case 'default':
      return createSwipeTimeWarpControl(options)
    case 'selector':
      return createSelectorTimeWarpControl(options)
    case 'tape':
      return createTimeWarpTapeControl(options)
  }
}

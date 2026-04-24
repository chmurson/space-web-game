import { createPlaceholderTimeWarpControl } from './placeholderTimeWarpControl'
import { createSelectorTimeWarpControl } from './selectorTimeWarpControl'
import {
  createTimeWarpControl as createDefaultTimeWarpControl,
  type TimeWarpControl,
  type TimeWarpControlOptions,
} from './timeWarpControl'

type TimeWarpControlVariant = 'default' | 'placeholder' | 'selector'

const timeWarpControlVariant = 'selector' as TimeWarpControlVariant

export const createConfiguredTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  switch (timeWarpControlVariant) {
    case 'default':
      return createDefaultTimeWarpControl(options)
    case 'placeholder':
      return createPlaceholderTimeWarpControl(options)
    case 'selector':
      return createSelectorTimeWarpControl(options)
  }
}

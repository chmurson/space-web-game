import { createPlaceholderTimeWarpControl } from './placeholderTimeWarpControl'
import {
  createTimeWarpControl as createDefaultTimeWarpControl,
  type TimeWarpControl,
  type TimeWarpControlOptions,
} from './timeWarpControl'

type TimeWarpControlVariant = 'default' | 'placeholder'

const timeWarpControlVariant = 'default' as TimeWarpControlVariant

export const createConfiguredTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  switch (timeWarpControlVariant) {
    case 'default':
      return createDefaultTimeWarpControl(options)
    case 'placeholder':
      return createPlaceholderTimeWarpControl(options)
  }
}

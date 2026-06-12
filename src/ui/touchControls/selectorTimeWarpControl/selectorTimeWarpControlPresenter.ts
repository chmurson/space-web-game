import { formatTimeWarpLabel } from '../../formatters'
import {
  presentStepSelectorControl,
  type StepSelectorControlRenderState,
  type StepSelectorRenderStep,
  type StepSelectorRenderTone,
} from '../stepSelectorControl/stepSelectorControlPresenter'
import type { SelectorTimeWarpSnapshot } from './selectorTimeWarpControlModel'

export type SelectorTimeWarpRenderTone = StepSelectorRenderTone
export type SelectorTimeWarpRenderStep = StepSelectorRenderStep
export type SelectorTimeWarpControlRenderState = StepSelectorControlRenderState

export const presentSelectorTimeWarpControl = (
  snapshot: SelectorTimeWarpSnapshot,
): SelectorTimeWarpControlRenderState =>
  presentStepSelectorControl(snapshot, {
    formatValue: formatTimeWarpLabel,
  })

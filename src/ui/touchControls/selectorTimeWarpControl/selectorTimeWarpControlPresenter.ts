import { formatTimeWarpLabel } from '../../formatters'
import type { TimeWarpPreview } from '../timeWarpControlTypes'
import type { SelectorTimeWarpSnapshot } from './selectorTimeWarpControlModel'

export type SelectorTimeWarpRenderTone = 'available' | 'blocked'

export type SelectorTimeWarpRenderStep = {
  hidden: boolean
  label: string
  tone: SelectorTimeWarpRenderTone
}

export type SelectorTimeWarpControlRenderState = {
  animationDirection: 'up' | 'down' | null
  currentLabel: string
  decreaseFarStep: SelectorTimeWarpRenderStep
  decreaseNearStep: SelectorTimeWarpRenderStep
  increaseFarStep: SelectorTimeWarpRenderStep
  increaseNearStep: SelectorTimeWarpRenderStep
}

const hiddenStep: SelectorTimeWarpRenderStep = {
  hidden: true,
  label: '',
  tone: 'available',
}

const presentStep = (
  step: TimeWarpPreview | null | undefined,
): SelectorTimeWarpRenderStep => {
  if (!step) {
    return hiddenStep
  }

  return {
    hidden: false,
    label: formatTimeWarpLabel(step.value),
    tone: step.canCommit ? 'available' : 'blocked',
  }
}

export const presentSelectorTimeWarpControl = (
  snapshot: SelectorTimeWarpSnapshot,
): SelectorTimeWarpControlRenderState => ({
  animationDirection: snapshot.animationDirection,
  currentLabel: formatTimeWarpLabel(snapshot.currentValue),
  decreaseFarStep: presentStep(snapshot.decreaseSteps[1]),
  decreaseNearStep: presentStep(snapshot.decreaseSteps[0]),
  increaseFarStep: presentStep(snapshot.increaseSteps[1]),
  increaseNearStep: presentStep(snapshot.increaseSteps[0]),
})

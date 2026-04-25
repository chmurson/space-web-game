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
  decreaseExtraStep: SelectorTimeWarpRenderStep
  decreaseFarStep: SelectorTimeWarpRenderStep
  decreaseNearStep: SelectorTimeWarpRenderStep
  dragDirection: 'increase' | 'decrease' | null
  dragProgress: number
  releaseWillCommit: boolean
  targetDirection: 'increase' | 'decrease' | null
  increaseExtraStep: SelectorTimeWarpRenderStep
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
): SelectorTimeWarpControlRenderState => {
  const activeGesture = snapshot.gesture
  const runtimeSnapshot = snapshot.runtimeSnapshot
  const dragDirection = activeGesture?.visualDirection ?? null
  const dragProgress = activeGesture?.progress ?? 0

  return {
    animationDirection: snapshot.animationDirection,
    currentLabel: formatTimeWarpLabel(runtimeSnapshot.currentValue),
    decreaseExtraStep: presentStep(runtimeSnapshot.decreaseSteps[2]),
    decreaseFarStep: presentStep(runtimeSnapshot.decreaseSteps[1]),
    decreaseNearStep: presentStep(runtimeSnapshot.decreaseSteps[0]),
    dragDirection,
    dragProgress,
    increaseExtraStep: presentStep(runtimeSnapshot.increaseSteps[2]),
    increaseFarStep: presentStep(runtimeSnapshot.increaseSteps[1]),
    increaseNearStep: presentStep(runtimeSnapshot.increaseSteps[0]),
    releaseWillCommit: activeGesture?.releaseWillCommit ?? false,
    targetDirection: activeGesture?.direction ?? null,
  }
}

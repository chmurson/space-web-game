import type { StepSelectorSnapshot } from './stepSelectorControlModel'
import type { StepSelectorPreview } from './stepSelectorControlTypes'

export type StepSelectorRenderTone = 'available' | 'blocked'

export type StepSelectorRenderStep = {
  hidden: boolean
  label: string
  tone: StepSelectorRenderTone
}

export type StepSelectorControlRenderState = {
  animationDirection: 'up' | 'down' | null
  currentLabel: string
  decreaseExtraStep: StepSelectorRenderStep
  decreaseFarStep: StepSelectorRenderStep
  decreaseNearStep: StepSelectorRenderStep
  dragDirection: 'increase' | 'decrease' | null
  dragProgress: number
  releaseWillCommit: boolean
  targetDirection: 'increase' | 'decrease' | null
  increaseExtraStep: StepSelectorRenderStep
  increaseFarStep: StepSelectorRenderStep
  increaseNearStep: StepSelectorRenderStep
}

const hiddenStep: StepSelectorRenderStep = {
  hidden: true,
  label: '',
  tone: 'available',
}

const presentStep = (
  step: StepSelectorPreview | null | undefined,
  formatValue: (value: number) => string,
): StepSelectorRenderStep => {
  if (!step) {
    return hiddenStep
  }

  return {
    hidden: false,
    label: formatValue(step.value),
    tone: step.canCommit ? 'available' : 'blocked',
  }
}

export const presentStepSelectorControl = (
  snapshot: StepSelectorSnapshot,
  options: { formatValue(value: number): string },
): StepSelectorControlRenderState => {
  const activeGesture = snapshot.gesture
  const runtimeSnapshot = snapshot.runtimeSnapshot
  const dragDirection = activeGesture?.visualDirection ?? null
  const dragProgress = activeGesture?.progress ?? 0

  return {
    animationDirection: snapshot.animationDirection,
    currentLabel: options.formatValue(runtimeSnapshot.currentValue),
    decreaseExtraStep: presentStep(
      runtimeSnapshot.decreaseSteps[2],
      options.formatValue,
    ),
    decreaseFarStep: presentStep(
      runtimeSnapshot.decreaseSteps[1],
      options.formatValue,
    ),
    decreaseNearStep: presentStep(
      runtimeSnapshot.decreaseSteps[0],
      options.formatValue,
    ),
    dragDirection,
    dragProgress,
    increaseExtraStep: presentStep(
      runtimeSnapshot.increaseSteps[2],
      options.formatValue,
    ),
    increaseFarStep: presentStep(
      runtimeSnapshot.increaseSteps[1],
      options.formatValue,
    ),
    increaseNearStep: presentStep(
      runtimeSnapshot.increaseSteps[0],
      options.formatValue,
    ),
    releaseWillCommit: activeGesture?.releaseWillCommit ?? false,
    targetDirection: activeGesture?.direction ?? null,
  }
}

import type { StepSelectorSnapshot } from './stepSelectorControlModel'
import type {
  StepSelectorAxis,
  StepSelectorDirection,
  StepSelectorPreview,
} from './stepSelectorControlTypes'

export type StepSelectorRenderTone = 'available' | 'blocked'

export type StepSelectorRenderStep = {
  hidden: boolean
  label: string
  tone: StepSelectorRenderTone
}

export type StepSelectorHorizontalRenderStep = {
  className: string
  key: string
  label: string
  offset: number
  tone: StepSelectorRenderTone | 'current'
}

export type StepSelectorControlRenderState = {
  animationDirection: 'up' | 'down' | null
  currentLabel: string
  downExtraStep: StepSelectorRenderStep
  downFarStep: StepSelectorRenderStep
  downNearStep: StepSelectorRenderStep
  dragDirection: 'increase' | 'decrease' | null
  dragProgress: number
  horizontalSteps: StepSelectorHorizontalRenderStep[]
  releaseWillCommit: boolean
  targetDirection: 'increase' | 'decrease' | null
  upExtraStep: StepSelectorRenderStep
  upFarStep: StepSelectorRenderStep
  upNearStep: StepSelectorRenderStep
  visualStepOffset: number
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

const getHorizontalStepClassName = (
  direction: StepSelectorDirection,
  index: number,
) => {
  const prefix =
    direction === 'increase'
      ? 'touch-step-selector-value-down'
      : 'touch-step-selector-value-up'
  if (index === 0) {
    return `${prefix}-near`
  }
  if (index === 1) {
    return `${prefix}-far touch-step-selector-value-secondary`
  }
  return 'touch-step-selector-value-secondary'
}

const presentHorizontalSteps = (
  snapshot: StepSelectorSnapshot['runtimeSnapshot'],
  formatValue: (value: number) => string,
): StepSelectorHorizontalRenderStep[] => [
  ...snapshot.decreaseSteps
    .map((step, index) => ({ step, index }))
    .reverse()
    .map(({ step, index }) => ({
      className: getHorizontalStepClassName('decrease', index),
      key: `decrease-${index + 1}-${step.value}`,
      label: formatValue(step.value),
      offset: index + 1,
      tone: step.canCommit ? ('available' as const) : ('blocked' as const),
    })),
  {
    className: '',
    key: `current-${snapshot.currentValue}`,
    label: formatValue(snapshot.currentValue),
    offset: 0,
    tone: 'current' as const,
  },
  ...snapshot.increaseSteps.map((step, index) => ({
    className: getHorizontalStepClassName('increase', index),
    key: `increase-${index + 1}-${step.value}`,
    label: formatValue(step.value),
    offset: -index - 1,
    tone: step.canCommit ? ('available' as const) : ('blocked' as const),
  })),
]

export const presentStepSelectorControl = (
  snapshot: StepSelectorSnapshot,
  options: {
    axis?: StepSelectorAxis
    formatValue(value: number): string
  },
): StepSelectorControlRenderState => {
  const activeGesture = snapshot.gesture
  const runtimeSnapshot = snapshot.runtimeSnapshot
  const dragDirection = activeGesture?.visualDirection ?? null
  const dragProgress = activeGesture?.progress ?? 0

  return {
    animationDirection: snapshot.animationDirection,
    currentLabel: options.formatValue(runtimeSnapshot.currentValue),
    downExtraStep: presentStep(
      runtimeSnapshot.increaseSteps[2],
      options.formatValue,
    ),
    downFarStep: presentStep(
      runtimeSnapshot.increaseSteps[1],
      options.formatValue,
    ),
    downNearStep: presentStep(
      runtimeSnapshot.increaseSteps[0],
      options.formatValue,
    ),
    dragDirection,
    dragProgress,
    horizontalSteps:
      options.axis === 'horizontal'
        ? presentHorizontalSteps(runtimeSnapshot, options.formatValue)
        : [],
    releaseWillCommit: activeGesture?.releaseWillCommit ?? false,
    targetDirection: activeGesture?.direction ?? null,
    upExtraStep: presentStep(
      runtimeSnapshot.decreaseSteps[2],
      options.formatValue,
    ),
    upFarStep: presentStep(
      runtimeSnapshot.decreaseSteps[1],
      options.formatValue,
    ),
    upNearStep: presentStep(
      runtimeSnapshot.decreaseSteps[0],
      options.formatValue,
    ),
    visualStepOffset: activeGesture?.visualStepOffset ?? 0,
  }
}

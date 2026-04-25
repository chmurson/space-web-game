import type { TimeWarpPreview } from '../timeWarpControlTypes'

export type SelectorTimeWarpSnapshot = {
  animationDirection: 'up' | 'down' | null
  currentValue: number
  decreaseSteps: TimeWarpPreview[]
  increaseSteps: TimeWarpPreview[]
}

export type SelectorTimeWarpControlModel = {
  clearStepAnimation(): SelectorTimeWarpSnapshot
  getSnapshot(): SelectorTimeWarpSnapshot
  setValues(params: {
    currentValue: number
    decreaseSteps: TimeWarpPreview[]
    increaseSteps: TimeWarpPreview[]
  }): SelectorTimeWarpSnapshot
  startStepAnimation(direction: 'up' | 'down'): SelectorTimeWarpSnapshot
}

const cloneStep = (step: TimeWarpPreview): TimeWarpPreview => ({
  canCommit: step.canCommit,
  reason: step.reason,
  value: step.value,
})

const createSnapshot = (
  snapshot: SelectorTimeWarpSnapshot,
): SelectorTimeWarpSnapshot => ({
  animationDirection: snapshot.animationDirection,
  currentValue: snapshot.currentValue,
  decreaseSteps: snapshot.decreaseSteps.map(cloneStep),
  increaseSteps: snapshot.increaseSteps.map(cloneStep),
})

export const createSelectorTimeWarpControlModel =
  (): SelectorTimeWarpControlModel => {
    const snapshot: SelectorTimeWarpSnapshot = {
      animationDirection: null,
      currentValue: 1,
      decreaseSteps: [],
      increaseSteps: [],
    }

    return {
      clearStepAnimation() {
        snapshot.animationDirection = null
        return createSnapshot(snapshot)
      },
      getSnapshot() {
        return createSnapshot(snapshot)
      },
      setValues({ currentValue, decreaseSteps, increaseSteps }) {
        snapshot.currentValue = currentValue
        snapshot.decreaseSteps = decreaseSteps.map(cloneStep)
        snapshot.increaseSteps = increaseSteps.map(cloneStep)
        return createSnapshot(snapshot)
      },
      startStepAnimation(direction) {
        snapshot.animationDirection = direction
        return createSnapshot(snapshot)
      },
    }
  }

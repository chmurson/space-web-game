import type {
  StepSelectorDirection,
  StepSelectorPreview,
} from './stepSelectorControlTypes'

export type StepSelectorRuntimeSnapshot = {
  currentValue: number
  decreaseSteps: StepSelectorPreview[]
  increaseSteps: StepSelectorPreview[]
}

export type StepSelectorGestureState = {
  direction: StepSelectorDirection | null
  progress: number
  releaseWillCommit: boolean
  startCurrentValue: number
  target: StepSelectorPreview | null
  visualDirection: StepSelectorDirection | null
  visualStepOffset: number
}

export type StepSelectorSnapshot = {
  animationDirection: 'up' | 'down' | null
  deferredRuntimeSnapshot: StepSelectorRuntimeSnapshot | null
  gesture: StepSelectorGestureState | null
  runtimeSnapshot: StepSelectorRuntimeSnapshot
}

export type StepSelectorControlModel = {
  clearStepAnimation(): StepSelectorSnapshot
  endGesture(): StepSelectorSnapshot
  getSnapshot(): StepSelectorSnapshot
  setRuntimeSnapshot(
    runtimeSnapshot: StepSelectorRuntimeSnapshot,
  ): StepSelectorSnapshot
  startGesture(): StepSelectorSnapshot
  startStepAnimation(direction: 'up' | 'down'): StepSelectorSnapshot
  updateGesture(params: {
    direction: StepSelectorDirection | null
    progress: number
    releaseWillCommit: boolean
    target: StepSelectorPreview | null
    visualDirection: StepSelectorDirection | null
    visualStepOffset?: number
  }): StepSelectorSnapshot
}

const cloneStep = (step: StepSelectorPreview): StepSelectorPreview => ({
  canCommit: step.canCommit,
  value: step.value,
})

const cloneRuntimeSnapshot = (
  snapshot: StepSelectorRuntimeSnapshot,
): StepSelectorRuntimeSnapshot => ({
  currentValue: snapshot.currentValue,
  decreaseSteps: snapshot.decreaseSteps.map(cloneStep),
  increaseSteps: snapshot.increaseSteps.map(cloneStep),
})

const createSnapshot = (
  snapshot: StepSelectorSnapshot,
): StepSelectorSnapshot => ({
  animationDirection: snapshot.animationDirection,
  deferredRuntimeSnapshot: snapshot.deferredRuntimeSnapshot
    ? cloneRuntimeSnapshot(snapshot.deferredRuntimeSnapshot)
    : null,
  gesture: snapshot.gesture
    ? {
        direction: snapshot.gesture.direction,
        progress: snapshot.gesture.progress,
        releaseWillCommit: snapshot.gesture.releaseWillCommit,
        startCurrentValue: snapshot.gesture.startCurrentValue,
        target: snapshot.gesture.target
          ? cloneStep(snapshot.gesture.target)
          : null,
        visualDirection: snapshot.gesture.visualDirection,
        visualStepOffset: snapshot.gesture.visualStepOffset,
      }
    : null,
  runtimeSnapshot: cloneRuntimeSnapshot(snapshot.runtimeSnapshot),
})

export const createStepSelectorControlModel = (): StepSelectorControlModel => {
  const snapshot: StepSelectorSnapshot = {
    animationDirection: null,
    deferredRuntimeSnapshot: null,
    gesture: null,
    runtimeSnapshot: {
      currentValue: 1,
      decreaseSteps: [],
      increaseSteps: [],
    },
  }

  return {
    clearStepAnimation() {
      snapshot.animationDirection = null
      return createSnapshot(snapshot)
    },
    endGesture() {
      snapshot.gesture = null
      if (snapshot.deferredRuntimeSnapshot) {
        snapshot.runtimeSnapshot = cloneRuntimeSnapshot(
          snapshot.deferredRuntimeSnapshot,
        )
        snapshot.deferredRuntimeSnapshot = null
      }
      return createSnapshot(snapshot)
    },
    getSnapshot() {
      return createSnapshot(snapshot)
    },
    setRuntimeSnapshot(runtimeSnapshot) {
      const nextRuntimeSnapshot = cloneRuntimeSnapshot(runtimeSnapshot)
      if (snapshot.gesture) {
        snapshot.deferredRuntimeSnapshot = nextRuntimeSnapshot
        return createSnapshot(snapshot)
      }

      snapshot.runtimeSnapshot = nextRuntimeSnapshot
      snapshot.deferredRuntimeSnapshot = null
      return createSnapshot(snapshot)
    },
    startGesture() {
      snapshot.gesture = {
        direction: null,
        progress: 0,
        releaseWillCommit: false,
        startCurrentValue: snapshot.runtimeSnapshot.currentValue,
        target: null,
        visualDirection: null,
        visualStepOffset: 0,
      }
      snapshot.animationDirection = null
      snapshot.deferredRuntimeSnapshot = null
      return createSnapshot(snapshot)
    },
    startStepAnimation(direction) {
      snapshot.animationDirection = direction
      return createSnapshot(snapshot)
    },
    updateGesture({
      direction,
      progress,
      releaseWillCommit,
      target,
      visualDirection,
      visualStepOffset = 0,
    }) {
      if (!snapshot.gesture) {
        return createSnapshot(snapshot)
      }

      snapshot.gesture.direction = direction
      snapshot.gesture.progress = progress
      snapshot.gesture.releaseWillCommit = releaseWillCommit
      snapshot.gesture.target = target ? cloneStep(target) : null
      snapshot.gesture.visualDirection = visualDirection
      snapshot.gesture.visualStepOffset = visualStepOffset
      return createSnapshot(snapshot)
    },
  }
}

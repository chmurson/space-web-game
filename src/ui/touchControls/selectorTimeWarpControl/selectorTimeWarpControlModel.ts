import type { TimeWarpPreview } from '../timeWarpControlTypes'

export type SelectorTimeWarpRuntimeSnapshot = {
  currentValue: number
  decreaseSteps: TimeWarpPreview[]
  increaseSteps: TimeWarpPreview[]
}

export type SelectorTimeWarpGestureDirection = 'increase' | 'decrease'

export type SelectorTimeWarpGestureState = {
  direction: SelectorTimeWarpGestureDirection | null
  progress: number
  releaseWillCommit: boolean
  startCurrentValue: number
  target: TimeWarpPreview | null
  visualDirection: SelectorTimeWarpGestureDirection | null
}

export type SelectorTimeWarpSnapshot = {
  animationDirection: 'up' | 'down' | null
  deferredRuntimeSnapshot: SelectorTimeWarpRuntimeSnapshot | null
  gesture: SelectorTimeWarpGestureState | null
  runtimeSnapshot: SelectorTimeWarpRuntimeSnapshot
}

export type SelectorTimeWarpControlModel = {
  clearStepAnimation(): SelectorTimeWarpSnapshot
  endGesture(): SelectorTimeWarpSnapshot
  getSnapshot(): SelectorTimeWarpSnapshot
  setRuntimeSnapshot(
    runtimeSnapshot: SelectorTimeWarpRuntimeSnapshot,
  ): SelectorTimeWarpSnapshot
  startGesture(): SelectorTimeWarpSnapshot
  startStepAnimation(direction: 'up' | 'down'): SelectorTimeWarpSnapshot
  updateGesture(params: {
    direction: SelectorTimeWarpGestureDirection | null
    progress: number
    releaseWillCommit: boolean
    target: TimeWarpPreview | null
    visualDirection: SelectorTimeWarpGestureDirection | null
  }): SelectorTimeWarpSnapshot
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
      }
    : null,
  runtimeSnapshot: cloneRuntimeSnapshot(snapshot.runtimeSnapshot),
})

const cloneRuntimeSnapshot = (
  snapshot: SelectorTimeWarpRuntimeSnapshot,
): SelectorTimeWarpRuntimeSnapshot => ({
  currentValue: snapshot.currentValue,
  decreaseSteps: snapshot.decreaseSteps.map(cloneStep),
  increaseSteps: snapshot.increaseSteps.map(cloneStep),
})

export const createSelectorTimeWarpControlModel =
  (): SelectorTimeWarpControlModel => {
    const snapshot: SelectorTimeWarpSnapshot = {
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
      }) {
        if (!snapshot.gesture) {
          return createSnapshot(snapshot)
        }

        snapshot.gesture.direction = direction
        snapshot.gesture.progress = progress
        snapshot.gesture.releaseWillCommit = releaseWillCommit
        snapshot.gesture.target = target ? cloneStep(target) : null
        snapshot.gesture.visualDirection = visualDirection
        return createSnapshot(snapshot)
      },
    }
  }

import { describe, expect, it } from 'vitest'
import { createSelectorTimeWarpControlModel } from '@/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlModel'

describe('selectorTimeWarpControlModel', () => {
  it('defers runtime sync while a gesture is active', () => {
    const model = createSelectorTimeWarpControlModel()
    model.setRuntimeSnapshot({
      currentValue: 60,
      decreaseSteps: [{ canCommit: true, reason: null, value: 1 }],
      increaseSteps: [{ canCommit: true, reason: null, value: 300 }],
    })
    model.startGesture()

    const duringGesture = model.setRuntimeSnapshot({
      currentValue: 300,
      decreaseSteps: [{ canCommit: true, reason: null, value: 60 }],
      increaseSteps: [{ canCommit: true, reason: null, value: 1800 }],
    })

    expect(duringGesture.runtimeSnapshot.currentValue).toBe(60)
    expect(duringGesture.deferredRuntimeSnapshot?.currentValue).toBe(300)

    const afterGesture = model.endGesture()
    expect(afterGesture.runtimeSnapshot.currentValue).toBe(300)
    expect(afterGesture.deferredRuntimeSnapshot).toBeNull()
  })

  it('tracks release commit eligibility separately from runtime state', () => {
    const model = createSelectorTimeWarpControlModel()
    model.setRuntimeSnapshot({
      currentValue: 60,
      decreaseSteps: [],
      increaseSteps: [{ canCommit: true, reason: null, value: 300 }],
    })
    model.startGesture()

    const snapshot = model.updateGesture({
      direction: 'increase',
      progress: 1,
      releaseWillCommit: true,
      target: { canCommit: true, reason: null, value: 300 },
      visualDirection: 'increase',
    })

    expect(snapshot.runtimeSnapshot.currentValue).toBe(60)
    expect(snapshot.gesture).toMatchObject({
      direction: 'increase',
      progress: 1,
      releaseWillCommit: true,
      startCurrentValue: 60,
      target: { value: 300 },
      visualDirection: 'increase',
    })
  })
})

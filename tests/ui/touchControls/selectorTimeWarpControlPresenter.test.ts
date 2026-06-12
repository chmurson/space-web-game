import { describe, expect, it } from 'vitest'
import { presentSelectorTimeWarpControl } from '@/ui/touchControls/selectorTimeWarpControl/selectorTimeWarpControlPresenter'

describe('selectorTimeWarpControlPresenter', () => {
  it('formats current and adjacent warp values as durations', () => {
    expect(
      presentSelectorTimeWarpControl({
        animationDirection: null,
        deferredRuntimeSnapshot: null,
        gesture: null,
        runtimeSnapshot: {
          currentValue: 300,
          decreaseSteps: [
            { canCommit: true, value: 60 },
            { canCommit: true, value: 30 },
          ],
          increaseSteps: [
            { canCommit: true, value: 1800 },
            { canCommit: false, value: 3600 },
          ],
        },
      }),
    ).toMatchObject({
      currentLabel: 'x5m',
      decreaseFarStep: {
        hidden: false,
        label: 'x30s',
        tone: 'available',
      },
      decreaseNearStep: {
        hidden: false,
        label: 'x1m',
        tone: 'available',
      },
      increaseFarStep: {
        hidden: false,
        label: 'x1h',
        tone: 'blocked',
      },
      increaseNearStep: {
        hidden: false,
        label: 'x30m',
        tone: 'available',
      },
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  getHorizontalMomentumStepCount,
  getStepSelectorGestureCommittedStepCount,
  getStepSelectorGestureDelta,
  getStepSelectorGestureDirection,
  getStepSelectorGesturePreviewDeltaY,
  getStepSelectorReleaseWillCommit,
} from '@/ui/touchControls/stepSelectorControl/createStepSelectorControl'

describe('createStepSelectorControl', () => {
  it('maps upward swipes to increases and downward swipes to decreases', () => {
    expect(getStepSelectorGestureDirection(-1)).toBe('increase')
    expect(getStepSelectorGestureDirection(1)).toBe('decrease')
    expect(getStepSelectorGestureDirection(0)).toBeNull()
  })

  it('counts symmetric midpoint thresholds across multiple steps', () => {
    for (const sign of [-1, 1]) {
      expect(getStepSelectorGestureCommittedStepCount(sign * 22)).toBe(0)
      expect(getStepSelectorGestureCommittedStepCount(sign * 23)).toBe(1)
      expect(getStepSelectorGestureCommittedStepCount(sign * 68)).toBe(1)
      expect(getStepSelectorGestureCommittedStepCount(sign * 69)).toBe(2)
      expect(getStepSelectorGestureCommittedStepCount(sign * 114)).toBe(2)
      expect(getStepSelectorGestureCommittedStepCount(sign * 115)).toBe(3)
    }
  })

  it('calculates vertical preview from the supplied gesture anchor', () => {
    expect(getStepSelectorGesturePreviewDeltaY(92, 100)).toBe(-8)
    expect(getStepSelectorGesturePreviewDeltaY(100, 92)).toBe(8)
    expect(getStepSelectorGesturePreviewDeltaY(100, 100)).toBe(0)
  })

  it('maps horizontal left swipes to the same increase direction as upward swipes', () => {
    expect(
      getStepSelectorGestureDelta(
        'horizontal',
        { clientX: 54, clientY: 0 },
        { x: 100, y: 0 },
      ),
    ).toBe(-46)
    expect(
      getStepSelectorGestureDirection(
        getStepSelectorGestureDelta(
          'horizontal',
          { clientX: 146, clientY: 0 },
          { x: 100, y: 0 },
        ),
      ),
    ).toBe('decrease')
  })

  it('settles release to the nearest value after the midpoint', () => {
    expect(getStepSelectorReleaseWillCommit(-23)).toBe(false)
    expect(getStepSelectorReleaseWillCommit(23)).toBe(false)
    expect(getStepSelectorReleaseWillCommit(-24)).toBe(true)
    expect(getStepSelectorReleaseWillCommit(24)).toBe(true)
  })

  it('only flings for recent, fast horizontal movement', () => {
    expect(
      getHorizontalMomentumStepCount({
        recentTravelPx: 12,
        releaseVelocityPxPerSecond: 450,
        stationaryDurationMs: 79,
      }),
    ).toBe(1)
    expect(
      getHorizontalMomentumStepCount({
        recentTravelPx: 12,
        releaseVelocityPxPerSecond: 900,
        stationaryDurationMs: 79,
      }),
    ).toBe(2)

    for (const params of [
      {
        recentTravelPx: 9,
        releaseVelocityPxPerSecond: 900,
        stationaryDurationMs: 0,
      },
      {
        recentTravelPx: 12,
        releaseVelocityPxPerSecond: 449,
        stationaryDurationMs: 0,
      },
      {
        recentTravelPx: 12,
        releaseVelocityPxPerSecond: 900,
        stationaryDurationMs: 80,
      },
    ]) {
      expect(getHorizontalMomentumStepCount(params)).toBe(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  getStepSelectorGestureCommittedStepCount,
  getStepSelectorGestureDirection,
  getStepSelectorGesturePreviewDeltaY,
} from '@/ui/touchControls/stepSelectorControl/createStepSelectorControl'

describe('createStepSelectorControl', () => {
  it('maps upward swipes to increases and downward swipes to decreases', () => {
    expect(getStepSelectorGestureDirection(-1)).toBe('increase')
    expect(getStepSelectorGestureDirection(1)).toBe('decrease')
    expect(getStepSelectorGestureDirection(0)).toBeNull()
  })

  it('counts every full commit-distance crossed by one gesture', () => {
    expect(getStepSelectorGestureCommittedStepCount(-45)).toBe(0)
    expect(getStepSelectorGestureCommittedStepCount(-46)).toBe(1)
    expect(getStepSelectorGestureCommittedStepCount(-92)).toBe(2)
    expect(getStepSelectorGestureCommittedStepCount(138)).toBe(3)
  })

  it('keeps drag preview relative to the next uncommitted threshold', () => {
    expect(getStepSelectorGesturePreviewDeltaY(92, 100)).toBe(-8)
    expect(getStepSelectorGesturePreviewDeltaY(100, 92)).toBe(8)
    expect(getStepSelectorGesturePreviewDeltaY(100, 100)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { getStepSelectorGestureDirection } from '@/ui/touchControls/stepSelectorControl/createStepSelectorControl'

describe('createStepSelectorControl', () => {
  it('maps upward swipes to increases and downward swipes to decreases', () => {
    expect(getStepSelectorGestureDirection(-1)).toBe('increase')
    expect(getStepSelectorGestureDirection(1)).toBe('decrease')
    expect(getStepSelectorGestureDirection(0)).toBeNull()
  })
})

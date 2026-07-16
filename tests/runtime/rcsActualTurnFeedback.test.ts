import { describe, expect, it } from 'vitest'

import {
  type RcsActualTurnFeedback,
  updateRcsActualTurnFeedback,
} from '@/runtime/rcsActualTurnFeedback'

describe('updateRcsActualTurnFeedback', () => {
  it('starts at the previous heading and grows toward actual current heading', () => {
    const feedback = updateRcsActualTurnFeedback({
      currentHeading: 0.2,
      dt: 1 / 60,
      feedback: null,
      previousHeading: 0,
      rcsTurnActive: true,
    })

    expect(feedback?.currentHeading).toBeCloseTo(0.2)
    expect(feedback?.opacity).toBe(1)
    expect(feedback?.phase).toBe('active')
    expect(feedback?.startHeading).toBe(0)

    const nextFeedback = updateRcsActualTurnFeedback({
      currentHeading: 0.35,
      dt: 1 / 60,
      feedback,
      previousHeading: 0.2,
      rcsTurnActive: true,
    })

    expect(nextFeedback?.currentHeading).toBeCloseTo(0.35)
    expect(nextFeedback?.opacity).toBe(1)
    expect(nextFeedback?.phase).toBe('active')
    expect(nextFeedback?.startHeading).toBe(0)
  })

  it('keeps accumulating in the actual direction after crossing 180 degrees', () => {
    const activeFeedback: RcsActualTurnFeedback = {
      currentHeading: 3,
      opacity: 1,
      phase: 'active',
      settleCurrentHeading: 3,
      settleElapsedSeconds: 0,
      settleStartHeading: 0,
      startHeading: 0,
    }

    const feedback = updateRcsActualTurnFeedback({
      currentHeading: -2.8,
      dt: 1 / 60,
      feedback: activeFeedback,
      previousHeading: 3,
      rcsTurnActive: true,
    })

    expect(feedback?.currentHeading).toBeCloseTo(3.483185)
    expect(feedback?.currentHeading).toBeGreaterThan(Math.PI)
    expect(feedback?.startHeading).toBe(0)
  })

  it('advances the fading start at actual turn speed after one revolution', () => {
    const activeFeedback: RcsActualTurnFeedback = {
      currentHeading: Math.PI * 2 - 0.1,
      opacity: 1,
      phase: 'active',
      settleCurrentHeading: Math.PI * 2 - 0.1,
      settleElapsedSeconds: 0,
      settleStartHeading: 0,
      startHeading: 0,
    }

    const feedback = updateRcsActualTurnFeedback({
      currentHeading: 0.1,
      dt: 0.5,
      feedback: activeFeedback,
      previousHeading: -0.1,
      rcsTurnActive: true,
    })

    expect(feedback?.currentHeading).toBeCloseTo(Math.PI * 2 + 0.1)
    expect(feedback?.startHeading).toBeCloseTo(0.1)
    expect(
      (feedback?.currentHeading ?? 0) - (feedback?.startHeading ?? 0),
    ).toBeCloseTo(Math.PI * 2)
  })

  it('trims an unwrapped arc from its oldest heading after rotation stops', () => {
    const activeFeedback: RcsActualTurnFeedback = {
      currentHeading: 4.2,
      opacity: 1,
      phase: 'active',
      settleCurrentHeading: 4.2,
      settleElapsedSeconds: 0,
      settleStartHeading: 0.2,
      startHeading: 0.2,
    }

    const settling = updateRcsActualTurnFeedback({
      currentHeading: -2.083185,
      dt: 0.21,
      feedback: activeFeedback,
      previousHeading: -2.083185,
      rcsTurnActive: false,
    })

    expect(settling).toMatchObject({
      currentHeading: 4.2,
      opacity: 1,
      phase: 'settling',
    })
    expect(settling?.startHeading).toBeCloseTo(2.2)

    const cleared = updateRcsActualTurnFeedback({
      currentHeading: -2.083185,
      dt: 0.21,
      feedback: settling,
      previousHeading: -2.083185,
      rcsTurnActive: false,
    })

    expect(cleared).toBeNull()
  })

  it('does not show feedback before actual rotation happens', () => {
    const feedback = updateRcsActualTurnFeedback({
      currentHeading: 1,
      dt: 1 / 60,
      feedback: null,
      previousHeading: 1,
      rcsTurnActive: true,
    })

    expect(feedback).toBeNull()
  })
})

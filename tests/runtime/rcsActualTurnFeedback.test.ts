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

  it('trims from the original heading without fading after rotation stops', () => {
    const activeFeedback: RcsActualTurnFeedback = {
      currentHeading: 0.42,
      opacity: 1,
      phase: 'active',
      settleCurrentHeading: 0.42,
      settleElapsedSeconds: 0,
      settleStartHeading: 0,
      startHeading: 0,
    }

    const settling = updateRcsActualTurnFeedback({
      currentHeading: 0.42,
      dt: 0.21,
      feedback: activeFeedback,
      previousHeading: 0.42,
      rcsTurnActive: false,
    })

    expect(settling).toMatchObject({
      currentHeading: 0.42,
      opacity: 1,
      phase: 'settling',
    })
    expect(settling?.startHeading).toBeCloseTo(0.21)

    const cleared = updateRcsActualTurnFeedback({
      currentHeading: 0.42,
      dt: 0.21,
      feedback: settling,
      previousHeading: 0.42,
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

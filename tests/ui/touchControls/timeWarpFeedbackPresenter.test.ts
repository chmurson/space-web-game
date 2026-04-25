import { describe, expect, it } from 'vitest'
import {
  formatTimeWarpFeedbackLabel,
  presentTimeWarpFeedback,
} from '@/ui/touchControls/swipeTimeWarpControl/timeWarpFeedbackPresenter'

describe('timeWarpFeedbackPresenter', () => {
  it('formats labels in the UI layer', () => {
    expect(
      formatTimeWarpFeedbackLabel({
        action: 'increaseTimeWarp',
        reason: 'scenario-limit',
        value: 60,
      }),
    ).toBe('>> x1m max')
  })

  it('maps snapshots into explicit render instructions', () => {
    expect(
      presentTimeWarpFeedback({
        action: 'decreaseTimeWarp',
        anchor: { x: 80, y: 40 },
        canCommit: false,
        mode: 'preview',
        opacity: 0.75,
        reason: 'turning',
        value: 30,
      }),
    ).toEqual({
      anchor: { x: 80, y: 40 },
      label: '<< x30s turn',
      mode: 'preview',
      opacity: 0.75,
      tone: 'blocked',
      value: 30,
      variant: 'decrease',
    })
  })

  it('returns null for hidden snapshots', () => {
    expect(
      presentTimeWarpFeedback({
        action: null,
        anchor: null,
        canCommit: false,
        mode: 'hidden',
        opacity: 0,
        reason: null,
        value: null,
      }),
    ).toBeNull()
  })
})

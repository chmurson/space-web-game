import { describe, expect, it } from 'vitest'
import {
  formatTimeWarpFeedbackLabel,
  presentTimeWarpFeedback,
} from '@/ui/touchControls/timeWarpFeedbackPresenter'

describe('timeWarpFeedbackPresenter', () => {
  it('formats labels in the UI layer', () => {
    expect(
      formatTimeWarpFeedbackLabel({
        action: 'increaseTimeWarp',
        reason: 'scenario-limit',
        value: 100,
      }),
    ).toBe('>> x100 max')
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
        value: 50,
      }),
    ).toEqual({
      anchor: { x: 80, y: 40 },
      label: '<< x50 turn',
      mode: 'preview',
      opacity: 0.75,
      tone: 'blocked',
      value: 50,
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

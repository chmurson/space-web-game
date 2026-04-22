import { describe, expect, it } from 'vitest'
import { createTimeWarpFeedbackModel } from '@/ui/touchControls/timeWarpFeedbackModel'

describe('timeWarpFeedbackModel', () => {
  it('keeps blocked previews visible without commit eligibility', () => {
    const model = createTimeWarpFeedbackModel()

    const snapshot = model.updatePreview({
      action: 'increaseTimeWarp',
      anchor: { x: 120, y: 80 },
      canCommit: false,
      opacity: 1,
      reason: 'thrust-active',
      value: 100,
    })

    expect(snapshot).toEqual({
      action: 'increaseTimeWarp',
      anchor: { x: 120, y: 80 },
      canCommit: false,
      mode: 'preview',
      opacity: 1,
      reason: 'thrust-active',
      value: 100,
    })
  })

  it('replays a successful commit from the last preview anchor', () => {
    const model = createTimeWarpFeedbackModel()

    model.updatePreview({
      action: 'decreaseTimeWarp',
      anchor: { x: 40, y: 24 },
      canCommit: true,
      opacity: 1,
      reason: null,
      value: 10,
    })

    const result = model.commitPreview()

    expect(result.action).toBe('decreaseTimeWarp')
    expect(result.snapshot).toEqual({
      action: 'decreaseTimeWarp',
      anchor: { x: 40, y: 24 },
      canCommit: false,
      mode: 'confirmation',
      opacity: 1,
      reason: null,
      value: 10,
    })
  })

  it('clears preview state on cancel', () => {
    const model = createTimeWarpFeedbackModel()

    model.updatePreview({
      action: 'increaseTimeWarp',
      anchor: { x: 8, y: 16 },
      canCommit: true,
      opacity: 0.7,
      reason: null,
      value: 50,
    })

    expect(model.cancelPreview()).toEqual({
      action: null,
      anchor: null,
      canCommit: false,
      mode: 'hidden',
      opacity: 0,
      reason: null,
      value: null,
    })
  })

  it('hides immediately when released from a blocked preview', () => {
    const model = createTimeWarpFeedbackModel()

    model.updatePreview({
      action: 'increaseTimeWarp',
      anchor: { x: 10, y: 20 },
      canCommit: false,
      opacity: 1,
      reason: 'scenario-limit',
      value: 100,
    })

    const result = model.commitPreview()

    expect(result.action).toBeNull()
    expect(result.snapshot.mode).toBe('hidden')
    expect(result.snapshot.anchor).toBeNull()
  })
})

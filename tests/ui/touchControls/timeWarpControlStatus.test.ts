import { describe, expect, it } from 'vitest'
import type { TimeWarpFeedbackReason } from '../../../src/runtime/timeWarpFeedbackPolicy'
import { getTimeWarpControlStatus } from '../../../src/ui/touchControls/timeWarpControlStatus'

const availablePreview = {
  canCommit: true,
  reason: null,
  value: 10,
} as const

const blockedPreview = (reason: TimeWarpFeedbackReason) => ({
  canCommit: false,
  reason,
  value: 10,
})

describe('getTimeWarpControlStatus', () => {
  it('describes the retained horizontal gesture when both directions are available', () => {
    expect(
      getTimeWarpControlStatus({
        decreasePreview: availablePreview,
        increasePreview: availablePreview,
      }),
    ).toEqual({
      reason: null,
      text: 'Drag left for faster · right for slower',
      tone: 'available',
    })
  })

  it.each([
    ['control-limit', 'Active-control cap reached'],
    ['global-max', 'Maximum rate reached'],
    ['global-min', 'Minimum rate reached'],
    ['scenario-limit', 'Scenario cap reached'],
    ['thrust-active', 'Main thrust blocks faster rates'],
    ['turning', 'Turning blocks faster rates'],
  ] satisfies [
    TimeWarpFeedbackReason,
    string,
  ][])('maps %s to concise visible feedback', (reason, text) => {
    expect(
      getTimeWarpControlStatus({
        decreasePreview: availablePreview,
        increasePreview: blockedPreview(reason),
      }),
    ).toEqual({ reason, text, tone: 'capped' })
  })
})

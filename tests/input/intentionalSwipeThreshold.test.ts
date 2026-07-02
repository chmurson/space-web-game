import { describe, expect, it } from 'vitest'

import { getIntentionalSwipeThresholdPoint } from '@/input/intentionalSwipeThreshold'

describe('getIntentionalSwipeThresholdPoint', () => {
  it('returns null before either axis crosses its threshold', () => {
    expect(
      getIntentionalSwipeThresholdPoint({
        currentX: 125,
        currentY: 220,
        startX: 100,
        startY: 200,
        thresholdX: 50,
        thresholdY: 40,
      }),
    ).toBeNull()
  })

  it('returns the point where the horizontal threshold was crossed', () => {
    expect(
      getIntentionalSwipeThresholdPoint({
        currentX: 180,
        currentY: 224,
        startX: 100,
        startY: 200,
        thresholdX: 40,
        thresholdY: 80,
      }),
    ).toEqual({ x: 140, y: 212 })
  })

  it('returns the point where the vertical threshold was crossed', () => {
    expect(
      getIntentionalSwipeThresholdPoint({
        currentX: 115,
        currentY: 160,
        startX: 100,
        startY: 200,
        thresholdX: 60,
        thresholdY: 20,
      }),
    ).toEqual({ x: 107.5, y: 180 })
  })
})

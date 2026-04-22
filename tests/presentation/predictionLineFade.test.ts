import { describe, expect, it } from 'vitest'

import {
  getCoastPredictionFadeBlend,
  getCoastPredictionFadeColors,
  getCoastPredictionFadeStartRatio,
  getLineDistanceProgress,
} from '@/presentation/predictionLineFade'

describe('predictionLineFade', () => {
  it('keeps the fade start halfway down the line for short coast predictions', () => {
    expect(getCoastPredictionFadeStartRatio(12 * 60 * 60)).toBeCloseTo(0.5, 3)
    expect(getCoastPredictionFadeStartRatio(24 * 60 * 60)).toBeCloseTo(0.5, 3)
  })

  it('moves the fade start earlier as the horizon gets longer', () => {
    const oneDay = getCoastPredictionFadeStartRatio(24 * 60 * 60)
    const fourDays = getCoastPredictionFadeStartRatio(4 * 24 * 60 * 60)
    const twelveDays = getCoastPredictionFadeStartRatio(12 * 24 * 60 * 60)

    expect(fourDays).toBeLessThan(oneDay)
    expect(fourDays).toBeCloseTo(0.25, 3)
    expect(twelveDays).toBeLessThan(fourDays)
    expect(twelveDays).toBeCloseTo(0.125, 3)
  })

  it('distributes line progress by traveled distance instead of raw point count', () => {
    expect(getLineDistanceProgress([0, 0, 0, 1, 0, 0, 5, 0, 0])).toEqual([
      0, 0.2, 1,
    ])
  })

  it('keeps all progress values at zero for a zero-length line', () => {
    expect(getLineDistanceProgress([2, 1, 0, 2, 1, 0, 2, 1, 0])).toEqual([
      0, 0, 0,
    ])
  })

  it('only darkens the tail section after the fade start point', () => {
    const horizonSeconds = 24 * 60 * 60
    const colors = getCoastPredictionFadeColors(
      [0, 0, 0, 9, 0, 0, 10, 0, 0],
      horizonSeconds,
    )

    expect(getCoastPredictionFadeBlend(0.5, horizonSeconds)).toBe(0)
    expect(getCoastPredictionFadeBlend(1, horizonSeconds)).toBe(1)
    expect(colors.slice(0, 3)).toEqual([1, 1, 1])
    expect(colors[3]).toBeCloseTo(0.30112, 5)
    expect(colors[4]).toBeCloseTo(0.30112, 5)
    expect(colors[5]).toBeCloseTo(0.30112, 5)
    expect(colors[6]).toBeCloseTo(0.22, 10)
    expect(colors[7]).toBeCloseTo(0.22, 10)
    expect(colors[8]).toBeCloseTo(0.22, 10)
  })
})

import { describe, expect, it } from 'vitest'

import { getViewportMinSampleDistanceMeters } from '@/presentation/viewportSampling'

const stops = [
  { viewportSize: 10, minSampleDistanceMeters: 100 },
  { viewportSize: 20, minSampleDistanceMeters: 200 },
  { viewportSize: 40, minSampleDistanceMeters: 600 },
] as const

describe('viewportSampling', () => {
  it('sorts stops by viewport size before sampling', () => {
    expect(
      getViewportMinSampleDistanceMeters(30, [stops[2], stops[0], stops[1]]),
    ).toBe(400)
  })

  it('clamps sampling below the closest viewport stop', () => {
    expect(getViewportMinSampleDistanceMeters(5, stops)).toBe(100)
  })

  it('clamps sampling above the farthest viewport stop', () => {
    expect(getViewportMinSampleDistanceMeters(80, stops)).toBe(600)
  })

  it('interpolates sampling between viewport stops', () => {
    expect(getViewportMinSampleDistanceMeters(15, stops)).toBe(150)
  })

  it('rejects duplicate viewport stops', () => {
    expect(() =>
      getViewportMinSampleDistanceMeters(50, [
        { viewportSize: 50, minSampleDistanceMeters: 1_000_000 },
        { viewportSize: 50, minSampleDistanceMeters: 500_000 },
      ]),
    ).toThrow('unique viewport sizes')
  })
})

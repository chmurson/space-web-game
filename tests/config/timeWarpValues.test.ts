import { describe, expect, it } from 'vitest'

import { gameConfig } from '@/config/gameConfig'

const createExpectedTimeWarpValues = () => [
  ...Array.from({ length: 59 }, (_, index) => index + 1),
  ...Array.from({ length: 59 }, (_, index) => (index + 1) * 60),
  ...Array.from({ length: 5 }, (_, index) => (index + 1) * 3600),
]

describe('time warp values', () => {
  it('uses second, minute, and hour precision up to the configured max', () => {
    const timeWarps = gameConfig.controls.timeWarps

    expect(timeWarps).toEqual(createExpectedTimeWarpValues())
    expect(timeWarps.at(0)).toBe(1)
    expect(timeWarps.at(58)).toBe(59)
    expect(timeWarps.at(59)).toBe(60)
    expect(timeWarps.at(117)).toBe(3540)
    expect(timeWarps.at(118)).toBe(3600)
    expect(timeWarps.at(-1)).toBe(18000)
  })
})

import { describe, expect, it } from 'vitest'
import { gameConfig } from '@/config/gameConfig'

const requestedTimeWarps = [
  1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 900, 1800, 3600, 7200, 14400, 28800,
  54000,
]

describe('gameConfig', () => {
  it('uses the smoother requested Time Warp ladder', () => {
    expect(gameConfig.controls.timeWarps).toEqual(requestedTimeWarps)
  })
})

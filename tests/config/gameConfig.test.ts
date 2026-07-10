import { describe, expect, it } from 'vitest'

import { gameConfig } from '@/config/gameConfig'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

describe('gameConfig', () => {
  it('uses the smoother requested Time Warp ladder', () => {
    expect(gameConfig.controls.timeWarps).toEqual(requestedTimeWarps)
  })
})

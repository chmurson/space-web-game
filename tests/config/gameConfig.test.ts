import { describe, expect, it } from 'vitest'

import { gameConfig } from '@/config/gameConfig'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

describe('gameConfig', () => {
  it('uses the smoother requested Time Warp ladder', () => {
    expect(gameConfig.controls.timeWarps).toEqual(requestedTimeWarps)
  })

  it('starts trajectory prediction at the default 48-hour limit', () => {
    expect(gameConfig.trajectory.horizon.defaultHours).toBe(48)
    expect(gameConfig.trajectory.horizon.defaultMaxHours).toBe(48)
  })
})

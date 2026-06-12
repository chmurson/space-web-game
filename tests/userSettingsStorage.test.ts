import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  readUserSettings,
  updateUserSettings,
  writeUserSettings,
} from '@/userSettingsStorage'

const storageKey = 'space-web-game.userSettings.v1'

const createWindowWithStorage = () => {
  const values = new Map<string, string>()
  return {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    },
  }
}

describe('userSettingsStorage', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithStorage(),
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('defaults touch controls to their configured sides', () => {
    expect(readUserSettings()).toEqual({
      debugModeEnabled: false,
      touchBurnControlSide: 'right',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('persists the selected touch control sides', () => {
    writeUserSettings({
      debugModeEnabled: true,
      touchBurnControlSide: 'left',
      touchTrajectoryControlSide: 'right',
      touchWarpControlSide: 'right',
    })

    expect(readUserSettings()).toEqual({
      debugModeEnabled: true,
      touchBurnControlSide: 'left',
      touchTrajectoryControlSide: 'right',
      touchWarpControlSide: 'right',
    })
  })

  it('keeps existing settings when updating one touch control side', () => {
    writeUserSettings({
      debugModeEnabled: true,
      touchBurnControlSide: 'right',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'right',
    })

    expect(updateUserSettings({ touchBurnControlSide: 'left' })).toEqual({
      debugModeEnabled: true,
      touchBurnControlSide: 'left',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('falls back for older settings without touch sides', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ debugModeEnabled: true }),
    )

    expect(readUserSettings()).toEqual({
      debugModeEnabled: true,
      touchBurnControlSide: 'right',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('migrates the previous shared touch side to both controls', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        debugModeEnabled: true,
        touchControlSide: 'left',
      }),
    )

    expect(readUserSettings()).toEqual({
      debugModeEnabled: true,
      touchBurnControlSide: 'left',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'left',
    })
  })
})

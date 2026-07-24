import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  readUserSettings,
  resolveOrbitPointDisplaySettings,
  updateUserSettings,
  writeUserSettings,
} from '@/userSettingsStorage'

const storageKey = 'space-web-game.userSettings.v1'

const defaultOrbitPointDisplay = {
  markersVisible: true,
}

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
      desktopEdgePanEnabled: false,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: false,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('persists the selected touch control sides and trajectory hidden state', () => {
    writeUserSettings({
      desktopEdgePanEnabled: true,
      desktopEdgePanSpeed: 'fast',
      debugModeEnabled: true,
      orbitPointDisplay: {
        markersVisible: false,
      },
      mobileManeuverStartByDrag: false,
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(readUserSettings()).toEqual({
      desktopEdgePanEnabled: true,
      desktopEdgePanSpeed: 'fast',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: {
        markersVisible: false,
      },
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('keeps existing settings when updating one touch control side', () => {
    writeUserSettings({
      desktopEdgePanEnabled: true,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(updateUserSettings({ touchBurnControlSide: 'left' })).toEqual({
      desktopEdgePanEnabled: true,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('falls back for older settings without touch sides', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ debugModeEnabled: true }),
    )

    expect(readUserSettings()).toEqual({
      desktopEdgePanEnabled: false,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('migrates the previous shared touch side to all touch controls', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        debugModeEnabled: true,
        touchControlSide: 'left',
      }),
    )

    expect(readUserSettings()).toEqual({
      desktopEdgePanEnabled: false,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'left',
    })
  })

  it('migrates legacy orbit label fields to marker visibility only', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        debugModeEnabled: true,
        orbitPointDisplay: {
          centerDistanceVisible: true,
          labelsVisible: false,
          markersVisible: false,
          pointNameVisible: false,
        },
      }),
    )

    expect(readUserSettings()).toEqual({
      desktopEdgePanEnabled: false,
      desktopEdgePanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: { markersVisible: false },
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('persists edge pan speed and falls back for invalid values', () => {
    writeUserSettings({
      desktopEdgePanEnabled: true,
      desktopEdgePanSpeed: 'slow',
      debugModeEnabled: false,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(readUserSettings().desktopEdgePanSpeed).toBe('slow')
    expect(readUserSettings().desktopEdgePanEnabled).toBe(true)

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        desktopEdgePanEnabled: 'yes',
        desktopEdgePanSpeed: 'warp',
      }),
    )

    expect(readUserSettings().desktopEdgePanSpeed).toBe('normal')
    expect(readUserSettings().desktopEdgePanEnabled).toBe(false)
  })

  it('resolves scenario orbit point display overrides over user settings', () => {
    expect(
      resolveOrbitPointDisplaySettings(defaultOrbitPointDisplay, {
        markersVisible: false,
      }),
    ).toEqual({
      markersVisible: false,
    })

    expect(resolveOrbitPointDisplaySettings(defaultOrbitPointDisplay)).toEqual(
      defaultOrbitPointDisplay,
    )
  })
})

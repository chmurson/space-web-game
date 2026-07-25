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
      desktopCameraPanMode: 'wheel',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'normal',
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
      desktopCameraPanMode: 'edge',
      desktopEdgePanSpeed: 'fast',
      desktopWheelPanSpeed: 'slow',
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
      desktopCameraPanMode: 'edge',
      desktopEdgePanSpeed: 'fast',
      desktopWheelPanSpeed: 'slow',
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
      desktopCameraPanMode: 'drag',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'fast',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(updateUserSettings({ touchBurnControlSide: 'left' })).toEqual({
      desktopCameraPanMode: 'drag',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'fast',
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
      desktopCameraPanMode: 'wheel',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'normal',
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
      desktopCameraPanMode: 'wheel',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'normal',
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
      desktopCameraPanMode: 'wheel',
      desktopEdgePanSpeed: 'normal',
      desktopWheelPanSpeed: 'normal',
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: { markersVisible: false },
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it.each([
    'wheel',
    'drag',
    'edge',
  ] as const)('persists the %s desktop camera pan mode', (desktopCameraPanMode) => {
    expect(
      updateUserSettings({ desktopCameraPanMode }).desktopCameraPanMode,
    ).toBe(desktopCameraPanMode)
    expect(readUserSettings().desktopCameraPanMode).toBe(desktopCameraPanMode)
  })

  it('defaults missing and legacy desktop camera pan settings to wheel without migrating the boolean', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ desktopEdgePanEnabled: true }),
    )

    const settings = readUserSettings()
    expect(settings.desktopCameraPanMode).toBe('wheel')
    expect(settings).not.toHaveProperty('desktopEdgePanEnabled')
  })

  it('falls back to wheel for an invalid desktop camera pan mode', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ desktopCameraPanMode: 'orbit' }),
    )

    expect(readUserSettings().desktopCameraPanMode).toBe('wheel')
  })

  it('persists edge and wheel pan speeds independently and rejects invalid values', () => {
    writeUserSettings({
      desktopCameraPanMode: 'edge',
      desktopEdgePanSpeed: 'slow',
      desktopWheelPanSpeed: 'fast',
      debugModeEnabled: false,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(readUserSettings().desktopEdgePanSpeed).toBe('slow')
    expect(readUserSettings().desktopWheelPanSpeed).toBe('fast')

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        desktopEdgePanSpeed: 'warp',
        desktopWheelPanSpeed: 'warp',
      }),
    )

    expect(readUserSettings().desktopEdgePanSpeed).toBe('normal')
    expect(readUserSettings().desktopWheelPanSpeed).toBe('normal')
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

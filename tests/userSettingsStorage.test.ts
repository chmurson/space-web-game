import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  readUserSettings,
  resolveOrbitPointDisplaySettings,
  updateUserSettings,
  writeUserSettings,
} from '@/userSettingsStorage'

const storageKey = 'space-web-game.userSettings.v1'

const defaultOrbitPointDisplay = {
  altitudeVisible: true,
  centerDistanceVisible: false,
  labelsVisible: true,
  markersVisible: true,
  pointNameVisible: true,
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
      debugModeEnabled: true,
      orbitPointDisplay: {
        altitudeVisible: false,
        centerDistanceVisible: true,
        labelsVisible: false,
        markersVisible: false,
        pointNameVisible: false,
      },
      mobileManeuverStartByDrag: false,
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(readUserSettings()).toEqual({
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: {
        altitudeVisible: false,
        centerDistanceVisible: true,
        labelsVisible: false,
        markersVisible: false,
        pointNameVisible: false,
      },
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('keeps existing settings when updating one touch control side', () => {
    writeUserSettings({
      debugModeEnabled: true,
      mobileManeuverStartByDrag: false,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })

    expect(updateUserSettings({ touchBurnControlSide: 'left' })).toEqual({
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
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: defaultOrbitPointDisplay,
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'left',
    })
  })

  it('fills missing orbit point display fields from defaults', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        debugModeEnabled: true,
        orbitPointDisplay: {
          centerDistanceVisible: true,
          labelsVisible: false,
        },
      }),
    )

    expect(readUserSettings()).toEqual({
      debugModeEnabled: true,
      mobileManeuverStartByDrag: true,
      orbitPointDisplay: {
        ...defaultOrbitPointDisplay,
        centerDistanceVisible: true,
        labelsVisible: false,
      },
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('resolves scenario orbit point display overrides over user settings', () => {
    expect(
      resolveOrbitPointDisplaySettings(defaultOrbitPointDisplay, {
        centerDistanceVisible: true,
        markersVisible: false,
      }),
    ).toEqual({
      ...defaultOrbitPointDisplay,
      centerDistanceVisible: true,
      markersVisible: false,
    })

    expect(resolveOrbitPointDisplaySettings(defaultOrbitPointDisplay)).toEqual(
      defaultOrbitPointDisplay,
    )
  })
})

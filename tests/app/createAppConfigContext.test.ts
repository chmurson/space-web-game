import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createAppConfigContext } from '@/app/createAppConfigContext'

const storageKey = 'space-web-game.userSettings.v1'

const createWindowWithSearch = (
  search: string,
  storedSettings?: unknown,
  hostname = 'game.example.test',
) => {
  const values = new Map<string, string>()
  if (storedSettings !== undefined) {
    values.set(storageKey, JSON.stringify(storedSettings))
  }

  return {
    location: { hostname, search },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    },
  }
}

describe('createAppConfigContext', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(''),
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('uses configured default touch control settings without stored settings', () => {
    expect(createAppConfigContext().featureFlags.noHorizonLimit).toBe(false)
    expect(
      createAppConfigContext().featureFlags.sphereOfInfluenceVariant,
    ).toBeNull()
    expect(
      createAppConfigContext().featureFlags.trajectoryPredictionImplementation,
    ).toBe('euler')
    expect(
      createAppConfigContext().trajectory.defaultCoastPredictionHorizonHours,
    ).toBe(48)
    expect(
      createAppConfigContext().trajectory.maxCoastPredictionHorizonHours,
    ).toBe(48)
    expect(createAppConfigContext().camera.maxViewport).toBe(4_000)
    expect(
      createAppConfigContext().globalScenarioDirectiveLimits.maxViewportSize,
    ).toBe(4_000)
    expect(createAppConfigContext().userSettings).toMatchObject({
      desktopCameraPanMode: 'wheel',
      desktopWheelPanSpeed: 'normal',
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('selects Kepler trajectory prediction only for authorized developer URLs', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?trajectoryPrediction=kepler'),
    })

    expect(
      createAppConfigContext().featureFlags.trajectoryPredictionImplementation,
    ).toBe('euler')

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?devtools=1&trajectoryPrediction=kepler'),
    })

    expect(
      createAppConfigContext().featureFlags.trajectoryPredictionImplementation,
    ).toBe('kepler')

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(
        '?trajectoryPrediction=kepler',
        undefined,
        'localhost',
      ),
    })

    expect(
      createAppConfigContext().featureFlags.trajectoryPredictionImplementation,
    ).toBe('kepler')

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?devtools=1&trajectoryPrediction=unknown'),
    })
    expect(
      createAppConfigContext().featureFlags.trajectoryPredictionImplementation,
    ).toBe('euler')
  })

  it('uses persisted touch control sides by default', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('', {
        debugModeEnabled: false,
        desktopCameraPanMode: 'edge',
        desktopWheelPanSpeed: 'fast',
        mobileManeuverStartByDrag: false,
        orbitPointDisplay: { markersVisible: false },
        touchBurnControlSide: 'left',
        touchTargetControlSide: 'right',
        touchTrajectoryControlSide: 'left',
        touchWarpControlSide: 'right',
      }),
    })

    expect(createAppConfigContext().userSettings).toMatchObject({
      desktopCameraPanMode: 'edge',
      desktopWheelPanSpeed: 'fast',
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('ignores retired Burn placement while overriding active control sides', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(
        '?scenario=earth-moon&touchBurnSide=left&touchTargetSide=right&touchTrajectorySide=hidden&touchWarpSide=right',
        {
          debugModeEnabled: false,
          mobileManeuverStartByDrag: true,
          orbitPointDisplay: { markersVisible: false },
          touchBurnControlSide: 'right',
          touchTargetControlSide: 'left',
          touchTrajectoryControlSide: 'left',
          touchWarpControlSide: 'left',
        },
      ),
    })

    const config = createAppConfigContext()

    expect(config.initialAppMode).toBe('game')
    expect(config.requestedScenarioId).toBe('earth-moon')
    expect(config.userSettings).toMatchObject({
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('ignores invalid touch control side URL params', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(
        '?touchBurnSide=center&touchTargetSide=middle&touchTrajectorySide=top&touchWarpSide=bottom',
        {
          debugModeEnabled: false,
          mobileManeuverStartByDrag: false,
          orbitPointDisplay: { markersVisible: false },
          touchBurnControlSide: 'left',
          touchTargetControlSide: 'right',
          touchTrajectoryControlSide: 'right',
          touchWarpControlSide: 'right',
        },
      ),
    })

    expect(createAppConfigContext().userSettings).toMatchObject({
      touchBurnControlSide: 'left',
      touchTargetControlSide: 'right',
      touchTrajectoryControlSide: 'right',
      touchWarpControlSide: 'right',
    })
  })

  it('allows direct Reach the Moon startup', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?scenario=reach-moon'),
    })

    const config = createAppConfigContext()

    expect(config.initialAppMode).toBe('game')
    expect(config.requestedScenarioId).toBe('reach-moon')
  })

  it('allows extended trajectory horizons only behind the exact URL feature flag', () => {
    for (const search of [
      '?nohiroznlimit=0',
      '?nohiroznlimit=true',
      '?nohiroznlimit',
      '?nohorizonlimit=1',
    ]) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: createWindowWithSearch(search),
      })

      const nearMissConfig = createAppConfigContext()

      expect(nearMissConfig.featureFlags.noHorizonLimit).toBe(false)
      expect(nearMissConfig.trajectory.maxCoastPredictionHorizonHours).toBe(48)
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?nohiroznlimit=1'),
    })

    const flaggedConfig = createAppConfigContext()

    expect(flaggedConfig.featureFlags.noHorizonLimit).toBe(true)
    expect(flaggedConfig.trajectory.maxCoastPredictionHorizonHours).toBe(
      128 * 24,
    )
    expect(
      flaggedConfig.globalScenarioDirectiveLimits
        .maxCoastPredictionHorizonHours,
    ).toBe(128 * 24)
  })

  it('selects sphere-of-influence visuals only for the four exact flag values', () => {
    const variants = [
      ['1', 'gradient-max-zoom-width-25pct'],
      ['2', 'gradient-max-zoom-width-15pct'],
      ['3', 'gradient-max-zoom-width-10pct'],
      ['4', 'gradient-max-zoom-width-5pct'],
    ] as const

    for (const [flagValue, variant] of variants) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: createWindowWithSearch(`?soi=${flagValue}`),
      })

      expect(
        createAppConfigContext().featureFlags.sphereOfInfluenceVariant,
      ).toBe(variant)
    }

    for (const search of ['?soi=', '?soi=0', '?soi=5', '?soi=true', '?SOI=1']) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: createWindowWithSearch(search),
      })

      expect(
        createAppConfigContext().featureFlags.sphereOfInfluenceVariant,
      ).toBeNull()
    }
  })
})

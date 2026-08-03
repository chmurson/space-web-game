import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createAppConfigContext } from '@/app/createAppConfigContext'
import { defaultPhysicsEngine, physicsEngines } from '@/simulation/physics'

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
    expect(createAppConfigContext().trajectory.predictionImplementation).toBe(
      'euler',
    )
    expect(createAppConfigContext().physicsEngine).toBe(defaultPhysicsEngine)
    expect(
      createAppConfigContext().trajectory.defaultCoastPredictionHorizonHours,
    ).toBe(48)
    expect(
      createAppConfigContext().trajectory.maxCoastPredictionHorizonHours,
    ).toBe(48)
    expect(createAppConfigContext().userSettings).toMatchObject({
      desktopCameraPanMode: 'wheel',
      desktopWheelPanSpeed: 'normal',
      touchBurnControlSide: 'right',
      touchTargetControlSide: 'left',
      touchTrajectoryControlSide: 'hidden',
      touchWarpControlSide: 'right',
    })
  })

  it('ignores the retired trajectoryPrediction URL parameter', () => {
    for (const [search, hostname] of [
      ['?trajectoryPrediction=kepler', 'game.example.test'],
      ['?devtools=1&trajectoryPrediction=kepler', 'game.example.test'],
      ['?trajectoryPrediction=kepler', 'localhost'],
    ] as const) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: createWindowWithSearch(search, undefined, hostname),
      })

      const config = createAppConfigContext()

      expect(config.physicsEngine).toBe(defaultPhysicsEngine)
      expect(config.trajectory.predictionImplementation).toBe('euler')
    }
  })

  it('selects Kepler trajectory prediction from the unified engine URL', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('?engine=kepler'),
    })

    const config = createAppConfigContext()

    expect(config.requestedEngine).toBe('kepler')
    expect(config.physicsEngine).toBe(physicsEngines.kepler)
    expect(config.trajectory.predictionImplementation).toBe('kepler')
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
})

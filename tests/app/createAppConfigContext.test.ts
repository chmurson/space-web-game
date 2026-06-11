import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createAppConfigContext } from '@/app/createAppConfigContext'

const storageKey = 'space-web-game.userSettings.v1'

const createWindowWithSearch = (search: string, storedSettings?: unknown) => {
  const values = new Map<string, string>()
  if (storedSettings !== undefined) {
    values.set(storageKey, JSON.stringify(storedSettings))
  }

  return {
    location: { search },
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

  it('uses persisted touch control sides by default', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch('', {
        debugModeEnabled: false,
        touchBurnControlSide: 'left',
        touchWarpControlSide: 'right',
      }),
    })

    expect(createAppConfigContext().userSettings).toMatchObject({
      touchBurnControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('allows URL params to override touch control sides for layout harnessing', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(
        '?scenario=earth-moon&touchBurnSide=left&touchWarpSide=right',
        {
          debugModeEnabled: false,
          touchBurnControlSide: 'right',
          touchWarpControlSide: 'left',
        },
      ),
    })

    const config = createAppConfigContext()

    expect(config.initialAppMode).toBe('game')
    expect(config.userSettings).toMatchObject({
      touchBurnControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })

  it('ignores invalid touch control side URL params', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithSearch(
        '?touchBurnSide=center&touchWarpSide=bottom',
        {
          debugModeEnabled: false,
          touchBurnControlSide: 'left',
          touchWarpControlSide: 'right',
        },
      ),
    })

    expect(createAppConfigContext().userSettings).toMatchObject({
      touchBurnControlSide: 'left',
      touchWarpControlSide: 'right',
    })
  })
})

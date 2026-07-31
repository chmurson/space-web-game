import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isDeveloperFeatureFlagsMenuEnabled,
  writeDeveloperFeatureFlagsToUrl,
} from '@/app/developerFeatureFlags'

const originalWindow = globalThis.window

const createWindow = (href: string) => {
  const parsedUrl = new URL(href)
  const assign = vi.fn()

  return {
    location: {
      assign,
      href,
      hostname: parsedUrl.hostname,
      search: parsedUrl.search,
    },
  }
}

describe('developer feature flags', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindow('https://game.example.test/'),
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('enables the menu on loopback hosts', () => {
    for (const url of [
      'http://localhost/',
      'http://127.0.0.1/',
      'http://[::1]/',
    ]) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: createWindow(url),
      })

      expect(isDeveloperFeatureFlagsMenuEnabled()).toBe(true)
    }
  })

  it('enables the menu only for devtools=1 outside local development', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindow('https://game.example.test/?devtools=1'),
    })
    expect(isDeveloperFeatureFlagsMenuEnabled()).toBe(true)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindow('https://game.example.test/?devtools=0'),
    })
    expect(isDeveloperFeatureFlagsMenuEnabled()).toBe(false)
  })

  it('preserves other query parameters when applying flags', () => {
    const testWindow = createWindow(
      'https://localhost:5173/?scenario=earth-moon&devtools=1',
    )
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: testWindow,
    })

    writeDeveloperFeatureFlagsToUrl({
      noHorizonLimit: true,
      trajectoryPredictionImplementation: 'kepler',
    })

    expect(testWindow.location.assign).toHaveBeenCalledWith(
      'https://localhost:5173/?scenario=earth-moon&devtools=1&nohiroznlimit=1&trajectoryPrediction=kepler',
    )
  })
})

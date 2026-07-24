import { describe, expect, it, vi } from 'vitest'

import { bindDevicePixelRatioChanges } from '@/app/bindDevicePixelRatioChanges'

class FakeMediaQueryList extends EventTarget {
  constructor(readonly media: string) {
    super()
  }

  notifyChange() {
    this.dispatchEvent(new Event('change'))
  }
}

const createWindowTarget = (devicePixelRatio: number) => {
  const mediaQueries: FakeMediaQueryList[] = []
  const windowTarget = {
    devicePixelRatio,
    matchMedia: vi.fn((query: string) => {
      const mediaQuery = new FakeMediaQueryList(query)
      mediaQueries.push(mediaQuery)
      return mediaQuery as unknown as MediaQueryList
    }),
  }

  return { mediaQueries, windowTarget }
}

describe('bindDevicePixelRatioChanges', () => {
  it('synchronizes and rebinds after each DPR-only change', () => {
    const { mediaQueries, windowTarget } = createWindowTarget(1)
    const onChange = vi.fn()
    const dispose = bindDevicePixelRatioChanges({
      onChange,
      windowTarget,
    })

    expect(windowTarget.matchMedia).toHaveBeenCalledWith('(resolution: 1dppx)')

    windowTarget.devicePixelRatio = 1.5
    mediaQueries[0]?.notifyChange()

    expect(onChange).toHaveBeenCalledOnce()
    expect(windowTarget.matchMedia).toHaveBeenNthCalledWith(
      2,
      '(resolution: 1.5dppx)',
    )
    expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(
      windowTarget.matchMedia.mock.invocationCallOrder[1] ?? 0,
    )

    mediaQueries[0]?.notifyChange()
    expect(onChange).toHaveBeenCalledOnce()

    windowTarget.devicePixelRatio = 2
    mediaQueries[1]?.notifyChange()

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(windowTarget.matchMedia).toHaveBeenNthCalledWith(
      3,
      '(resolution: 2dppx)',
    )

    dispose()
  })

  it('removes the active media-query listener on disposal', () => {
    const { mediaQueries, windowTarget } = createWindowTarget(2)
    const onChange = vi.fn()
    const dispose = bindDevicePixelRatioChanges({
      onChange,
      windowTarget,
    })

    dispose()
    mediaQueries[0]?.notifyChange()

    expect(onChange).not.toHaveBeenCalled()
    expect(windowTarget.matchMedia).toHaveBeenCalledOnce()
  })
})

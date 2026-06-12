import { describe, expect, it } from 'vitest'

import { getFpsMeterStatus, getFpsMeterText } from '@/ui/hudText'

describe('getFpsMeterText', () => {
  it('formats fps, frame time, cycle timings, and 60hz headroom', () => {
    expect(
      getFpsMeterText({
        smoothedCpuMs: 5.25,
        smoothedFps: 59.94,
        smoothedGpuMs: 8.4,
      }),
    ).toBe('FPS 59.9\nframe 16.7ms\ncpu 5.3ms\ngpu 8.4ms\n60Hz +8.3ms')
  })

  it('marks gpu timing unavailable when the browser cannot provide it yet', () => {
    expect(
      getFpsMeterText({
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gpu n/a')
  })
})

describe('getFpsMeterStatus', () => {
  it('warns before the 60hz frame budget is exhausted', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 14,
        smoothedFps: 58,
        smoothedGpuMs: null,
      }),
    ).toBe('warning')
  })

  it('reports danger when work exceeds a 60hz frame budget', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 12,
        smoothedFps: 60,
        smoothedGpuMs: 18,
      }),
    ).toBe('danger')
  })
})

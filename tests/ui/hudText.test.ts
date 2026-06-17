import { describe, expect, it } from 'vitest'

import type { BrowserGcProbeStats } from '@/runtime/browserGcProbe'
import {
  getFpsMeterGraphModel,
  getFpsMeterStatus,
  getFpsMeterText,
} from '@/ui/hudText'

const createBrowserGcStats = (
  overrides: Partial<BrowserGcProbeStats> = {},
): BrowserGcProbeStats => ({
  eventCount: 0,
  heapSamplingSupported: false,
  isEnabled: true,
  lastEventAtMs: null,
  lastEstimatedPauseMs: null,
  lastReclaimedBytes: null,
  lastSource: null,
  longestEstimatedPauseMs: 0,
  nativeObserverSupported: false,
  recentEvents: [],
  totalEstimatedPauseMs: 0,
  totalReclaimedBytes: null,
  ...overrides,
})

describe('getFpsMeterText', () => {
  it('formats fps, frame time, cycle timings, and 60hz headroom', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats(),
        smoothedCpuMs: 5.25,
        smoothedFps: 59.94,
        smoothedGpuMs: 8.4,
      }),
    ).toBe('FPS 59.9\nframe 16.7ms\ncpu 5.3ms\ngpu 8.4ms\n60Hz +8.3ms\ngc? 0')
  })

  it('marks gpu timing unavailable when the browser cannot provide it yet', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats(),
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gpu n/a')
  })

  it('adds a compact probable gc line when the browser gc probe has events', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats({
          eventCount: 3,
          lastEstimatedPauseMs: 18.25,
          longestEstimatedPauseMs: 44.5,
        }),
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gc? 3 l18.3 m44.5')
  })

  it('shows when gc probing is off', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats({ isEnabled: false }),
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gc? off')
  })
})

describe('getFpsMeterGraphModel', () => {
  it('maps the last five seconds of frame samples into a compact path', () => {
    const graph = getFpsMeterGraphModel({
      browserGcStats: createBrowserGcStats(),
      frameSamples: [
        { atMs: 5_000, frameMs: 16 },
        { atMs: 7_500, frameMs: 32 },
        { atMs: 10_000, frameMs: 80 },
      ],
      nowMs: 10_000,
    })

    expect(graph).toMatchObject({
      height: 28,
      path: 'M 0.0 22.4 L 56.0 16.8 L 112.0 0.0',
      width: 112,
    })
    expect(graph.budgetLineY).toBeCloseTo(22.17, 2)
  })

  it('filters old samples and maps recent gc events to vertical markers', () => {
    const graph = getFpsMeterGraphModel({
      browserGcStats: createBrowserGcStats({
        recentEvents: [
          { atMs: 4_900, estimatedPauseMs: 30, source: 'heap-drop' },
          { atMs: 7_500, estimatedPauseMs: 30, source: 'heap-drop' },
        ],
      }),
      frameSamples: [
        { atMs: 4_900, frameMs: 80 },
        { atMs: 10_000, frameMs: 20 },
      ],
      nowMs: 10_000,
    })

    expect(graph.path).toBe('M 112.0 21.0')
    expect(graph.gcMarkerXs).toEqual([56])
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

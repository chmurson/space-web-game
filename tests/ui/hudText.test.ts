import { describe, expect, it } from 'vitest'

import type { BrowserGcProbeStats } from '@/runtime/browserGcProbe'
import {
  getDebugPanelLines,
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

const createDebugPanelInput = (
  overrides: Partial<Parameters<typeof getDebugPanelLines>[0]> = {},
): Parameters<typeof getDebugPanelLines>[0] => ({
  assistMode: 'off',
  bodyInfluences: [],
  coastPredictionHorizonSeconds: 3600,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: '',
  fpsIndicatorEnabled: false,
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  predictionStepSeconds: 60,
  scenarioCompleted: false,
  scenarioId: 'reach-moon',
  scenarioState: { phase: 'reach-moon' },
  targetMetrics: {
    circularSpeed: 1000,
    distance: 10_000,
    insideRange: true,
    relativeSpeed: 500,
    roughAssistRange: 20_000,
    specificEnergy: -1,
    surfaceDistance: 4_000,
  },
  targetName: 'Moon',
  trailDetail: {
    captureSampleDistanceMeters: 250_000,
    label: 'close',
    level: 6,
    levelCount: 7,
    renderFrame: 'target-relative',
    renderedSliceCount: 12,
    renderSampleDistanceMeters: 500_000,
  },
  viewportSize: 25,
  zoom: 4,
  ...overrides,
})

describe('getDebugPanelLines', () => {
  it('shows debug toggles without the removed performance switch', () => {
    expect(getDebugPanelLines(createDebugPanelInput())[0]).toBe(
      'debug: [1] no-gravity off | [2] fps off',
    )
  })

  it('shows scenario phase in the readable debug text', () => {
    expect(getDebugPanelLines(createDebugPanelInput())).toContain(
      'scenario: reach-moon | phase reach-moon',
    )
  })

  it('shows viewport and trail detail in the readable debug text', () => {
    const lines = getDebugPanelLines(createDebugPanelInput())

    expect(lines).toContain('viewport: 25.00 | zoom: 4.0x')
    expect(lines).toContain(
      'trail detail: L6/7 close | slices 12 | render 500 km | capture 250 km | trail frame: target-relative Moon',
    )
  })

  it('shows inertial trail frame separately from the active assist target', () => {
    const input = createDebugPanelInput()

    expect(
      getDebugPanelLines({
        ...input,
        trailDetail: {
          ...input.trailDetail,
          renderFrame: 'inertial',
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'trail detail: L6/7 close | slices 12 | render 500 km | capture 250 km | trail frame: inertial',
        'assist target: Moon',
      ]),
    )
  })

  it('shows Reach the Moon orbit progress with the one-Earth-orbit final target', () => {
    expect(
      getDebugPanelLines(
        createDebugPanelInput({
          scenarioCompleted: true,
          scenarioState: {
            phase: 'orbit-earth',
            orbitProgressRadians: Math.PI,
            orbitTurnsCompleted: 0,
          },
        }),
      ),
    ).toContain(
      'scenario: reach-moon | phase orbit-earth | orbits 0/1 | 50% | complete',
    )
  })

  it('shows tutorial Earth orbit progress with three required turns', () => {
    expect(
      getDebugPanelLines(
        createDebugPanelInput({
          scenarioId: 'tutorial',
          scenarioState: {
            phase: 'orbit-earth',
            orbitProgressRadians: Math.PI * 3,
            orbitTurnsCompleted: 1,
          },
        }),
      ),
    ).toContain('scenario: tutorial | phase orbit-earth | orbits 1/3 | 50%')
  })
})

describe('getFpsMeterText', () => {
  it('formats fps, frame time, combined cycle timings, and 60hz headroom', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats({ heapSamplingSupported: true }),
        graphMaxCpuMs: 42.25,
        smoothedCpuMs: 5.25,
        smoothedFps: 59.94,
        smoothedGpuMs: 8.4,
      }),
    ).toBe(
      'FPS 59.9\nframe 16.7ms\ncpu max 42.3ms\ncpu 5.3ms | gpu 8.4ms\n60Hz +8.3ms\ngc? 0',
    )
  })

  it('marks gpu timing unavailable when the browser cannot provide it yet', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats(),
        graphMaxCpuMs: null,
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
          heapSamplingSupported: true,
          lastEstimatedPauseMs: 18.25,
          longestEstimatedPauseMs: 44.5,
        }),
        graphMaxCpuMs: 80,
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gc? 3 l18.3 m44.5')
  })

  it('marks gc unavailable when the browser exposes no gc or heap signal', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats(),
        graphMaxCpuMs: null,
        smoothedCpuMs: 7.1,
        smoothedFps: 60,
        smoothedGpuMs: null,
      }),
    ).toContain('gc n/a')
  })

  it('shows when gc probing is off', () => {
    expect(
      getFpsMeterText({
        browserGcStats: createBrowserGcStats({ isEnabled: false }),
        graphMaxCpuMs: null,
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
        { atMs: 5_000, cpuMs: 16 },
        { atMs: 7_500, cpuMs: 32 },
        { atMs: 10_000, cpuMs: 80 },
      ],
      nowMs: 10_000,
    })

    expect(graph).toMatchObject({
      height: 28,
      maxCpuMs: 80,
      path: 'M 0.0 28.0 L 56.0 21.0 L 112.0 0.0',
      width: 112,
    })
    expect(graph.budgetLineY).toBeCloseTo(27.71, 2)
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
        { atMs: 4_900, cpuMs: 80 },
        { atMs: 10_000, cpuMs: 20 },
      ],
      nowMs: 10_000,
    })

    expect(graph.path).toBe('M 112.0 28.0')
    expect(graph.gcMarkerXs).toEqual([56])
  })

  it('keeps the visible low cpu cost at the bottom while scaling bumps upward', () => {
    const graph = getFpsMeterGraphModel({
      browserGcStats: createBrowserGcStats(),
      frameSamples: [
        { atMs: 5_000, cpuMs: 2.5 },
        { atMs: 7_500, cpuMs: 2.6 },
        { atMs: 10_000, cpuMs: 2.7 },
      ],
      nowMs: 10_000,
    })

    expect(graph.path).toBe('M 0.0 28.0 L 56.0 14.0 L 112.0 0.0')
  })
})

describe('getFpsMeterStatus', () => {
  it('keeps stable capped 30 FPS with low measured work in the safe range', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 5.3,
        smoothedFps: 30,
        smoothedGpuMs: null,
      }),
    ).toBe('good')
  })

  it('warns before the 60hz frame budget is exhausted', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 14,
        smoothedFps: 58,
        smoothedGpuMs: null,
      }),
    ).toBe('warning')
  })

  it('warns before the effective 30 FPS frame budget is exhausted', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 27,
        smoothedFps: 30,
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

  it('reports danger when work exceeds the effective 30 FPS frame budget', () => {
    expect(
      getFpsMeterStatus({
        smoothedCpuMs: 34,
        smoothedFps: 30,
        smoothedGpuMs: null,
      }),
    ).toBe('danger')
  })
})

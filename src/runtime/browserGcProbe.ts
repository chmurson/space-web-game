export type BrowserGcProbeEventSource = 'native' | 'heap-drop' | 'frame-gap'

export type BrowserGcProbeEvent = {
  atMs: number
  estimatedPauseMs: number
  source: BrowserGcProbeEventSource
}

export type BrowserGcProbeStats = {
  eventCount: number
  heapSamplingSupported: boolean
  isEnabled: boolean
  lastEventAtMs: number | null
  lastEstimatedPauseMs: number | null
  lastReclaimedBytes: number | null
  lastSource: BrowserGcProbeEventSource | null
  longestEstimatedPauseMs: number
  nativeObserverSupported: boolean
  recentEvents: BrowserGcProbeEvent[]
  totalEstimatedPauseMs: number
  totalReclaimedBytes: number | null
}

type NativeGcEntry = {
  duration: number
  startTime: number
}

type BrowserGcProbeOptions = {
  expectedFrameMs?: number
  getUsedHeapBytes?: () => number | null
  isVisible?: () => boolean
  maxSampledFrameIntervalMs?: number
  minHeapDropBytes?: number
  minHeapDropRatio?: number
  minLongFrameMs?: number
  observeNativeGc?: (
    onEntry: (entry: NativeGcEntry) => void,
  ) => (() => void) | null
}

type RecordFrameInput = {
  frameIntervalMs: number
  nowMs: number
}

const bytesPerMegabyte = 1024 * 1024
const recentEventLimit = 64

const getDefaultUsedHeapBytes = () => {
  if (typeof performance === 'undefined') {
    return null
  }

  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize?: number
      }
    }
  ).memory

  return Number.isFinite(memory?.usedJSHeapSize)
    ? (memory?.usedJSHeapSize ?? null)
    : null
}

const observeNativeGcEntries = (onEntry: (entry: NativeGcEntry) => void) => {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes.includes('gc')
  ) {
    return null
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      onEntry({
        duration: entry.duration,
        startTime: entry.startTime,
      })
    }
  })
  observer.observe({ entryTypes: ['gc'] })

  return () => observer.disconnect()
}

const isPageVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden'

export const createBrowserGcProbe = (options: BrowserGcProbeOptions = {}) => {
  const expectedFrameMs = options.expectedFrameMs ?? 1000 / 60
  const getUsedHeapBytes = options.getUsedHeapBytes ?? getDefaultUsedHeapBytes
  const isVisible = options.isVisible ?? isPageVisible
  const maxSampledFrameIntervalMs = options.maxSampledFrameIntervalMs ?? 500
  const minHeapDropBytes = options.minHeapDropBytes ?? bytesPerMegabyte
  const minHeapDropRatio = options.minHeapDropRatio ?? 0.05
  const minLongFrameMs = options.minLongFrameMs ?? 50
  const observeNativeGc = options.observeNativeGc ?? observeNativeGcEntries
  let disconnectNativeObserver: (() => void) | null = null
  let lastHeapUsedBytes: number | null = null
  let hasFrameBaseline = false

  const stats: BrowserGcProbeStats = {
    eventCount: 0,
    heapSamplingSupported: false,
    isEnabled: false,
    lastEventAtMs: null,
    lastEstimatedPauseMs: null,
    lastReclaimedBytes: null,
    lastSource: null,
    longestEstimatedPauseMs: 0,
    nativeObserverSupported: false,
    recentEvents: [],
    totalEstimatedPauseMs: 0,
    totalReclaimedBytes: null,
  }

  const recordEvent = (
    source: BrowserGcProbeEventSource,
    nowMs: number,
    estimatedPauseMs: number,
    reclaimedBytes: number | null,
  ) => {
    stats.eventCount += 1
    stats.lastEventAtMs = nowMs
    stats.lastEstimatedPauseMs = estimatedPauseMs
    stats.lastReclaimedBytes = reclaimedBytes
    stats.lastSource = source
    stats.recentEvents.push({
      atMs: nowMs,
      estimatedPauseMs,
      source,
    })
    if (stats.recentEvents.length > recentEventLimit) {
      stats.recentEvents.shift()
    }
    stats.longestEstimatedPauseMs = Math.max(
      stats.longestEstimatedPauseMs,
      estimatedPauseMs,
    )
    stats.totalEstimatedPauseMs += estimatedPauseMs

    if (reclaimedBytes !== null) {
      stats.totalReclaimedBytes =
        (stats.totalReclaimedBytes ?? 0) + reclaimedBytes
    }
  }

  const sampleHeapBaseline = () => {
    lastHeapUsedBytes = getUsedHeapBytes()

    if (lastHeapUsedBytes !== null) {
      stats.heapSamplingSupported = true
      stats.totalReclaimedBytes ??= 0
    }
  }

  const start = () => {
    if (stats.isEnabled) {
      return
    }

    stats.isEnabled = true
    hasFrameBaseline = false
    sampleHeapBaseline()
    disconnectNativeObserver = observeNativeGc((entry) => {
      recordEvent('native', entry.startTime, Math.max(0, entry.duration), null)
    })
    stats.nativeObserverSupported = disconnectNativeObserver !== null
  }

  const stop = () => {
    if (!stats.isEnabled) {
      return
    }

    disconnectNativeObserver?.()
    disconnectNativeObserver = null
    stats.isEnabled = false
    stats.nativeObserverSupported = false
    lastHeapUsedBytes = null
    hasFrameBaseline = false
  }

  return {
    disconnect: () => {
      stop()
    },
    getStats: () => ({
      ...stats,
      recentEvents: stats.recentEvents.map((event) => ({ ...event })),
    }),
    recordFrame: ({ frameIntervalMs, nowMs }: RecordFrameInput) => {
      if (!stats.isEnabled) {
        return
      }

      const heapUsedBytes = getUsedHeapBytes()
      const previousHeapUsedBytes = lastHeapUsedBytes

      if (heapUsedBytes !== null) {
        stats.heapSamplingSupported = true
        lastHeapUsedBytes = heapUsedBytes
        stats.totalReclaimedBytes ??= 0
      }

      if (!hasFrameBaseline) {
        hasFrameBaseline = true
        return
      }

      if (
        stats.nativeObserverSupported ||
        !isVisible() ||
        frameIntervalMs < minLongFrameMs ||
        frameIntervalMs > maxSampledFrameIntervalMs
      ) {
        return
      }

      const estimatedPauseMs = Math.max(0, frameIntervalMs - expectedFrameMs)

      if (heapUsedBytes !== null && previousHeapUsedBytes !== null) {
        const reclaimedBytes = previousHeapUsedBytes - heapUsedBytes
        const heapDropRatio =
          reclaimedBytes / Math.max(previousHeapUsedBytes, 1)

        if (
          reclaimedBytes >= minHeapDropBytes &&
          heapDropRatio >= minHeapDropRatio
        ) {
          recordEvent('heap-drop', nowMs, estimatedPauseMs, reclaimedBytes)
        }
        return
      }

      recordEvent('frame-gap', nowMs, estimatedPauseMs, null)
    },
    setEnabled: (enabled: boolean) => {
      if (enabled) {
        start()
      } else {
        stop()
      }
    },
  }
}

export type BrowserGcProbe = ReturnType<typeof createBrowserGcProbe>

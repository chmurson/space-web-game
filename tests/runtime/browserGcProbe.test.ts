import { describe, expect, it } from 'vitest'

import { createBrowserGcProbe } from '@/runtime/browserGcProbe'

describe('createBrowserGcProbe', () => {
  it('ignores the first long frame while establishing a baseline', () => {
    let heap = 10 * 1024 * 1024
    const probe = createBrowserGcProbe({
      getUsedHeapBytes: () => heap,
      isVisible: () => true,
      observeNativeGc: () => null,
    })

    heap = 8 * 1024 * 1024
    probe.setEnabled(true)
    probe.recordFrame({ frameIntervalMs: 90, nowMs: 100 })

    expect(probe.getStats().eventCount).toBe(0)
  })

  it('counts a visible long frame with a significant heap drop as probable gc', () => {
    let heap = 20 * 1024 * 1024
    const probe = createBrowserGcProbe({
      expectedFrameMs: 16,
      getUsedHeapBytes: () => heap,
      isVisible: () => true,
      minHeapDropBytes: 1024 * 1024,
      minHeapDropRatio: 0.05,
      minLongFrameMs: 50,
      observeNativeGc: () => null,
    })

    probe.setEnabled(true)
    probe.recordFrame({ frameIntervalMs: 16, nowMs: 16 })
    heap = 16 * 1024 * 1024
    probe.recordFrame({ frameIntervalMs: 80, nowMs: 96 })

    expect(probe.getStats()).toMatchObject({
      eventCount: 1,
      lastEstimatedPauseMs: 64,
      lastReclaimedBytes: 4 * 1024 * 1024,
      lastSource: 'heap-drop',
      longestEstimatedPauseMs: 64,
      recentEvents: [{ atMs: 96, estimatedPauseMs: 64, source: 'heap-drop' }],
      totalEstimatedPauseMs: 64,
      totalReclaimedBytes: 4 * 1024 * 1024,
    })
  })

  it('returns copied recent events for graph rendering', () => {
    let heap = 20 * 1024 * 1024
    const probe = createBrowserGcProbe({
      expectedFrameMs: 16,
      getUsedHeapBytes: () => heap,
      isVisible: () => true,
      minHeapDropBytes: 1024 * 1024,
      minHeapDropRatio: 0.05,
      minLongFrameMs: 50,
      observeNativeGc: () => null,
    })

    probe.setEnabled(true)
    probe.recordFrame({ frameIntervalMs: 16, nowMs: 16 })
    heap = 16 * 1024 * 1024
    probe.recordFrame({ frameIntervalMs: 80, nowMs: 96 })

    const stats = probe.getStats()
    stats.recentEvents.length = 0

    expect(probe.getStats().recentEvents).toEqual([
      { atMs: 96, estimatedPauseMs: 64, source: 'heap-drop' },
    ])
  })

  it('falls back to frame-gap counting when heap sampling is unavailable', () => {
    const probe = createBrowserGcProbe({
      expectedFrameMs: 16,
      getUsedHeapBytes: () => null,
      isVisible: () => true,
      minLongFrameMs: 50,
      observeNativeGc: () => null,
    })

    probe.setEnabled(true)
    probe.recordFrame({ frameIntervalMs: 16, nowMs: 16 })
    probe.recordFrame({ frameIntervalMs: 72, nowMs: 88 })

    expect(probe.getStats()).toMatchObject({
      eventCount: 1,
      heapSamplingSupported: false,
      lastEstimatedPauseMs: 56,
      lastSource: 'frame-gap',
      totalReclaimedBytes: null,
    })
  })

  it('does not count hidden tab frames or debugger-sized gaps', () => {
    let visible = false
    let heap = 20 * 1024 * 1024
    const probe = createBrowserGcProbe({
      expectedFrameMs: 16,
      getUsedHeapBytes: () => heap,
      isVisible: () => visible,
      maxSampledFrameIntervalMs: 500,
      minHeapDropBytes: 1024 * 1024,
      minHeapDropRatio: 0.05,
      minLongFrameMs: 50,
      observeNativeGc: () => null,
    })

    probe.setEnabled(true)
    probe.recordFrame({ frameIntervalMs: 16, nowMs: 16 })
    heap = 16 * 1024 * 1024
    probe.recordFrame({ frameIntervalMs: 80, nowMs: 96 })

    visible = true
    heap = 10 * 1024 * 1024
    probe.recordFrame({ frameIntervalMs: 1_000, nowMs: 1_096 })

    expect(probe.getStats().eventCount).toBe(0)
  })

  it('uses native gc entries when the runtime exposes them', () => {
    let disconnected = false
    let emit: (entry: { duration: number; startTime: number }) => void = (
      _entry,
    ) => {
      throw new Error('native observer was not registered')
    }
    const probe = createBrowserGcProbe({
      getUsedHeapBytes: () => null,
      observeNativeGc: (onEntry) => {
        emit = onEntry
        return () => {
          disconnected = true
        }
      },
    })

    probe.setEnabled(true)
    emit?.({ duration: 12.5, startTime: 42 })

    expect(probe.getStats()).toMatchObject({
      eventCount: 1,
      lastEstimatedPauseMs: 12.5,
      lastEventAtMs: 42,
      lastSource: 'native',
      nativeObserverSupported: true,
    })

    probe.disconnect()
    expect(disconnected).toBe(true)
  })

  it('does not sample or observe gc while disabled', () => {
    let observed = false
    let heapReads = 0
    const probe = createBrowserGcProbe({
      getUsedHeapBytes: () => {
        heapReads += 1
        return null
      },
      observeNativeGc: () => {
        observed = true
        return () => undefined
      },
    })

    probe.recordFrame({ frameIntervalMs: 80, nowMs: 80 })

    expect(probe.getStats()).toMatchObject({
      eventCount: 0,
      isEnabled: false,
      nativeObserverSupported: false,
    })
    expect(heapReads).toBe(0)
    expect(observed).toBe(false)
  })

  it('disconnects native observation when disabled', () => {
    let disconnected = false
    const probe = createBrowserGcProbe({
      getUsedHeapBytes: () => null,
      observeNativeGc: () => () => {
        disconnected = true
      },
    })

    probe.setEnabled(true)
    expect(probe.getStats().nativeObserverSupported).toBe(true)

    probe.setEnabled(false)

    expect(disconnected).toBe(true)
    expect(probe.getStats()).toMatchObject({
      isEnabled: false,
      nativeObserverSupported: false,
    })
  })
})

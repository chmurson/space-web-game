import { describe, expect, it } from 'vitest'

import {
  createNavigationTimeWarpController,
  navigationTimeWarpRestoreDelayMs,
} from '@/runtime/navigationTimeWarpController'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

const maxControlWarp = 100
const maxControlTimeWarpIndex = requestedTimeWarps.indexOf(60)

const createController = () =>
  createNavigationTimeWarpController({
    maxControlWarp,
    timeWarps: requestedTimeWarps,
  })

const resolveFrame = (
  controller: ReturnType<typeof createController>,
  options: {
    navigationActive: boolean
    nowMs: number
    timeWarpIndex: number
  },
) =>
  controller.resolveFrame({
    maxTimeWarp: null,
    nowMs: options.nowMs,
    simulationNavigationActive: options.navigationActive,
    timeWarpIndex: options.timeWarpIndex,
  })

describe('createNavigationTimeWarpController', () => {
  it('caps active navigation and restores the original selection after 500 ms idle', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)

    const cappedTimeWarpIndex = resolveFrame(controller, {
      navigationActive: true,
      nowMs: 0,
      timeWarpIndex: originalTimeWarpIndex,
    })

    expect(cappedTimeWarpIndex).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 100,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 100 + navigationTimeWarpRestoreDelayMs - 1,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 100 + navigationTimeWarpRestoreDelayMs,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(originalTimeWarpIndex)
  })

  it('keeps the original selection through overlapping and repeated navigation', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(3600)

    const cappedTimeWarpIndex = resolveFrame(controller, {
      navigationActive: true,
      nowMs: 0,
      timeWarpIndex: originalTimeWarpIndex,
    })
    resolveFrame(controller, {
      navigationActive: false,
      nowMs: 100,
      timeWarpIndex: cappedTimeWarpIndex,
    })

    expect(
      resolveFrame(controller, {
        navigationActive: true,
        nowMs: 400,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 600,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 1099,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 1100,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(originalTimeWarpIndex)
  })

  it('waits for both heading-plan and simulation navigation to stop', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const cappedTimeWarpIndex = controller.beginHeadingPlan({
      maxTimeWarp: null,
      timeWarpIndex: originalTimeWarpIndex,
    })

    expect(cappedTimeWarpIndex).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: true,
        nowMs: 100,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)

    controller.endHeadingPlan(200)
    expect(
      resolveFrame(controller, {
        navigationActive: true,
        nowMs: 300,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 400,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 900,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(originalTimeWarpIndex)
  })

  it('uses a new above-cap user selection instead of restoring a stale value', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const replacementTimeWarpIndex = requestedTimeWarps.indexOf(120)
    const cappedTimeWarpIndex = resolveFrame(controller, {
      navigationActive: true,
      nowMs: 0,
      timeWarpIndex: originalTimeWarpIndex,
    })

    expect(
      controller.selectTimeWarpIndex({
        maxTimeWarp: null,
        timeWarpIndex: replacementTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    resolveFrame(controller, {
      navigationActive: false,
      nowMs: 100,
      timeWarpIndex: cappedTimeWarpIndex,
    })

    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 600,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(replacementTimeWarpIndex)
  })

  it('keeps a new below-cap user selection without restoring the old value', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const replacementTimeWarpIndex = requestedTimeWarps.indexOf(30)

    resolveFrame(controller, {
      navigationActive: true,
      nowMs: 0,
      timeWarpIndex: originalTimeWarpIndex,
    })

    expect(
      controller.selectTimeWarpIndex({
        maxTimeWarp: null,
        timeWarpIndex: replacementTimeWarpIndex,
      }),
    ).toBe(replacementTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 1000,
        timeWarpIndex: replacementTimeWarpIndex,
      }),
    ).toBe(replacementTimeWarpIndex)
  })

  it('constrains a pending restore target when the scenario maximum changes', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const scenarioMaximumTimeWarpIndex = requestedTimeWarps.indexOf(120)
    const cappedTimeWarpIndex = resolveFrame(controller, {
      navigationActive: true,
      nowMs: 0,
      timeWarpIndex: originalTimeWarpIndex,
    })

    expect(
      controller.resolveFrame({
        maxTimeWarp: 120,
        nowMs: 100,
        simulationNavigationActive: false,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: 120,
        nowMs: 600,
        simulationNavigationActive: false,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(scenarioMaximumTimeWarpIndex)
  })
})

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
    timeWarps: requestedTimeWarps,
  })

const resolveFrame = (
  controller: ReturnType<typeof createController>,
  options: {
    navigationActive: boolean
    nowMs: number
    timeWarpIndex: number
    usablePredictionCoverageSeconds?: number
  },
) =>
  controller.resolveFrame({
    maxTimeWarp: null,
    nowMs: options.nowMs,
    simulationControlMaxWarp: options.navigationActive ? maxControlWarp : null,
    timeWarpIndex: options.timeWarpIndex,
    usablePredictionCoverageSeconds: options.usablePredictionCoverageSeconds,
  })

describe('createNavigationTimeWarpController', () => {
  it('caps active navigation and restores the original selection after 320 ms idle', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)

    expect(navigationTimeWarpRestoreDelayMs).toBe(320)

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

  it('tracks a changing control cap without losing the original selection', () => {
    const controller = createController()
    const originalTimeWarpIndex = requestedTimeWarps.indexOf(1800)
    const rcsTimeWarpIndex = requestedTimeWarps.indexOf(15)
    const thrustTimeWarpIndex = requestedTimeWarps.indexOf(60)

    expect(
      controller.resolveFrame({
        maxTimeWarp: null,
        nowMs: 0,
        simulationControlMaxWarp: 15,
        timeWarpIndex: originalTimeWarpIndex,
      }),
    ).toBe(rcsTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: null,
        nowMs: 100,
        simulationControlMaxWarp: 100,
        timeWarpIndex: rcsTimeWarpIndex,
      }),
    ).toBe(thrustTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: null,
        nowMs: 200,
        simulationControlMaxWarp: 15,
        timeWarpIndex: thrustTimeWarpIndex,
      }),
    ).toBe(rcsTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: null,
        nowMs: 300,
        simulationControlMaxWarp: null,
        timeWarpIndex: rcsTimeWarpIndex,
      }),
    ).toBe(rcsTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: null,
        nowMs: 300 + navigationTimeWarpRestoreDelayMs,
        simulationControlMaxWarp: null,
        timeWarpIndex: rcsTimeWarpIndex,
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
        nowMs: 919,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 920,
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
        nowMs: 420,
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
        simulationControlMaxWarp: null,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(maxControlTimeWarpIndex)
    expect(
      controller.resolveFrame({
        maxTimeWarp: 120,
        nowMs: 420,
        simulationControlMaxWarp: null,
        timeWarpIndex: cappedTimeWarpIndex,
      }),
    ).toBe(scenarioMaximumTimeWarpIndex)
  })

  it('restores the requested warp immediately when compatible coverage returns', () => {
    const controller = createController()
    const requestedIndex = requestedTimeWarps.indexOf(54_000)
    const limitedIndex = requestedTimeWarps.indexOf(14_400)

    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 0,
        timeWarpIndex: requestedIndex,
        usablePredictionCoverageSeconds: 48 * 60 * 60,
      }),
    ).toBe(limitedIndex)
    expect(controller.getDiagnostics()).toMatchObject({
      constraintReason: 'prediction-coverage',
      effectiveTimeWarp: 14_400,
      predictionCoverageLimit: {
        maxTimeWarp: 14_400,
        remainingCoverageSeconds: 48 * 60 * 60,
      },
      requestedTimeWarp: 54_000,
    })

    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 16,
        timeWarpIndex: limitedIndex,
        usablePredictionCoverageSeconds: 192 * 60 * 60,
      }),
    ).toBe(requestedIndex)
  })

  it('uses a selection made while coverage-capped as the new request', () => {
    const controller = createController()
    const originalIndex = requestedTimeWarps.indexOf(54_000)
    const coverageLimitedIndex = requestedTimeWarps.indexOf(480)
    const replacementIndex = requestedTimeWarps.indexOf(900)

    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 0,
        timeWarpIndex: originalIndex,
        usablePredictionCoverageSeconds: 2 * 60 * 60,
      }),
    ).toBe(coverageLimitedIndex)
    expect(
      controller.selectTimeWarpIndex({
        maxTimeWarp: null,
        timeWarpIndex: replacementIndex,
      }),
    ).toBe(coverageLimitedIndex)

    expect(
      resolveFrame(controller, {
        navigationActive: false,
        nowMs: 16,
        timeWarpIndex: coverageLimitedIndex,
        usablePredictionCoverageSeconds: 192 * 60 * 60,
      }),
    ).toBe(replacementIndex)
  })
})

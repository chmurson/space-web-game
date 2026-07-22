import { describe, expect, it } from 'vitest'

import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createNavigationTimeWarpController } from '@/runtime/navigationTimeWarpController'
import {
  resolveSimulationTimeWarp,
  stepSimulationFrame,
} from '@/runtime/simulationStep'
import type { TargetHeadingTurn } from '@/simulation/types'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const getAutopilotTurn = (currentHeading: number, desiredHeading: number) => {
  const error = normalizeAngle(desiredHeading - currentHeading)

  if (Math.abs(error) < 0.015) {
    return 0
  }

  return Math.min(1, Math.max(-1, error / 0.9))
}

const createRuntimeState = (): AppRuntimeState['simulation']['state'] => ({
  elapsed: 0,
  bodies: [
    {
      id: 'earth',
      name: 'Earth',
      mass: 5.9722e24,
      radius: 6_371_000,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      color: '#2f80ed',
    },
  ],
  controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
  spacecraft: {
    position: { x: 7_371_000, y: 0 },
    velocity: { x: 0, y: 7_500 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 10_000,
    fuelMass: 8_000,
    fuelCapacity: 32_000,
  },
})

const simulateTargetHeadingTurn = (targetHeadingRadians: number) => {
  const recordedTurns: number[] = []
  let state = createRuntimeState()
  let targetHeading: number | null = targetHeadingRadians
  let targetHeadingTurn: TargetHeadingTurn | null = null

  for (let frame = 0; frame < 300 && targetHeading !== null; frame += 1) {
    const result = stepSimulationFrame({
      assistMode: 'off',
      autopilotRotationRate: 0.9,
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: (desiredHeading) =>
        getAutopilotTurn(state.spacecraft.heading, desiredHeading),
      getCaptureMetrics: () => ({
        circularSpeed: 0,
        distance: 0,
        insideRange: false,
        relativeSpeed: 0,
        roughAssistRange: 0,
        specificEnergy: 0,
        surfaceDistance: 0,
      }),
      getCircularizePlan: () => ({
        burnHeading: 0,
        deltaV: 0,
        desiredVelocityHeading: 0,
        distance: 0,
        radialSpeed: 0,
        tangentialSpeed: 0,
      }),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({
          main: 0,
          reverse: 0,
          strafe: 0,
          turn: 0,
        }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: () => {},
      },
      maxControlWarp: 100,
      physicsEngine: {
        name: 'test',
        step: (nextState, dt) => {
          recordedTurns.push(nextState.controls.turn)

          return {
            ...nextState,
            elapsed: nextState.elapsed + dt,
            spacecraft: {
              ...nextState.spacecraft,
              heading: normalizeAngle(
                nextState.spacecraft.heading +
                  nextState.controls.turn * 0.9 * dt,
              ),
            },
          }
        },
      },
      realDt: 1 / 60,
      shouldCaptureBurn: () => false,
      state,
      targetHeading,
      targetHeadingTurn,
      timeWarpIndex: 0,
      timeWarps: [1, 10, 30, 60, 300, 1800],
    })

    state = result.state
    targetHeading = result.targetHeading
    targetHeadingTurn = result.targetHeadingTurn
  }

  return {
    absoluteTurns: recordedTurns.map(Math.abs),
    state,
    targetHeading,
    targetHeadingTurn,
  }
}

describe('stepSimulationFrame', () => {
  it.each([
    {
      controls: { main: 1, reverse: 0, strafe: 0, turn: 0 },
      expectedMaxWarp: 100,
      expectedReason: 'active-controls' as const,
      expectedWarp: 60,
      name: 'keeps thrust at the x1m cap',
    },
    {
      controls: { main: 0, reverse: 0, strafe: 0, turn: 1 },
      expectedMaxWarp: 15,
      expectedReason: 'active-controls' as const,
      expectedWarp: 15,
      name: 'caps manual RCS turning at x15s',
    },
    {
      controls: { main: 1, reverse: 0, strafe: 0, turn: 1 },
      expectedMaxWarp: 15,
      expectedReason: 'active-controls' as const,
      expectedWarp: 15,
      name: 'keeps the stricter RCS cap during simultaneous thrust',
    },
    {
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
      expectedMaxWarp: null,
      expectedReason: null,
      expectedWarp: 1800,
      name: 'leaves normal time warp unchanged while controls are idle',
    },
  ])('$name', ({ controls, expectedMaxWarp, expectedReason, expectedWarp }) => {
    const result = resolveSimulationTimeWarp({
      assistMode: 'off',
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: () => 0,
      getCaptureMetrics: () => ({
        circularSpeed: 0,
        distance: 0,
        insideRange: false,
        relativeSpeed: 0,
        roughAssistRange: 0,
        specificEnergy: 0,
        surfaceDistance: 0,
      }),
      getCircularizePlan: () => ({
        burnHeading: 0,
        deltaV: 0,
        desiredVelocityHeading: 0,
        distance: 0,
        radialSpeed: 0,
        tangentialSpeed: 0,
      }),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => controls,
        hasManualTurn: () => controls.turn !== 0,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: () => {},
      },
      maxControlWarp: 100,
      maxTimeWarp: null,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: null,
      timeWarpIndex: requestedTimeWarps.indexOf(1800),
      timeWarps: requestedTimeWarps,
    })

    expect(result.activeControlMaxWarp).toBe(expectedMaxWarp)
    expect(result.reason).toBe(expectedReason)
    expect(result.timeWarpIndex).toBe(requestedTimeWarps.indexOf(expectedWarp))
  })

  it('restores the selected warp after all simulation controls are idle for 320 ms', () => {
    let mainThrust = 1
    let state = createRuntimeState()
    let timeWarpIndex = requestedTimeWarps.indexOf(1800)
    const navigationTimeWarpController = createNavigationTimeWarpController({
      maxControlWarp: 100,
      timeWarps: requestedTimeWarps,
    })
    const stepAt = (nowMs: number) => {
      const result = stepSimulationFrame({
        assistMode: 'off',
        autopilotRotationRate: 0.9,
        crashedBodyName: null,
        getAssistTarget: () => createRuntimeState().bodies[0],
        getAutopilotTurn: () => 0,
        getCaptureMetrics: () => ({
          circularSpeed: 0,
          distance: 0,
          insideRange: false,
          relativeSpeed: 0,
          roughAssistRange: 0,
          specificEnergy: 0,
          surfaceDistance: 0,
        }),
        getCircularizePlan: () => ({
          burnHeading: 0,
          deltaV: 0,
          desiredVelocityHeading: 0,
          distance: 0,
          radialSpeed: 0,
          tangentialSpeed: 0,
        }),
        keyboardInput: {
          clear: () => {},
          getManualControls: () => ({
            main: mainThrust,
            reverse: 0,
            strafe: 0,
            turn: 0,
          }),
          hasManualTurn: () => false,
          press: () => {},
          release: () => {},
          setVirtualKey: () => {},
          setVirtualTurn: () => {},
        },
        maxControlWarp: 100,
        navigationTimeWarpController,
        nowMs,
        physicsEngine: {
          name: 'test',
          step: (nextState) => nextState,
        },
        realDt: 0,
        shouldCaptureBurn: () => false,
        state,
        targetHeading: null,
        timeWarpIndex,
        timeWarps: requestedTimeWarps,
      })

      state = result.state
      timeWarpIndex = result.timeWarpIndex
      return result
    }

    expect(stepAt(0).timeWarpIndex).toBe(requestedTimeWarps.indexOf(60))

    mainThrust = 0
    expect(stepAt(100).timeWarpIndex).toBe(requestedTimeWarps.indexOf(60))
    expect(stepAt(419).timeWarpIndex).toBe(requestedTimeWarps.indexOf(60))
    expect(stepAt(420).timeWarpIndex).toBe(requestedTimeWarps.indexOf(1800))
  })

  it('drops fuel-consuming controls when finite fuel is depleted', () => {
    const state = createRuntimeState()
    state.spacecraft.fuel = 0
    state.spacecraft.fuelCapacity = 32_000

    const result = resolveSimulationTimeWarp({
      assistMode: 'off',
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: () => 1,
      getCaptureMetrics: () => ({
        circularSpeed: 0,
        distance: 0,
        insideRange: false,
        relativeSpeed: 0,
        roughAssistRange: 0,
        specificEnergy: 0,
        surfaceDistance: 0,
      }),
      getCircularizePlan: () => ({
        burnHeading: 0,
        deltaV: 0,
        desiredVelocityHeading: 0,
        distance: 0,
        radialSpeed: 0,
        tangentialSpeed: 0,
      }),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({ main: 1, reverse: 0, strafe: 0, turn: 1 }),
        hasManualTurn: () => true,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: () => {},
      },
      maxControlWarp: 100,
      maxTimeWarp: null,
      shouldCaptureBurn: () => false,
      state,
      targetHeading: Math.PI / 2,
      timeWarpIndex: 5,
      timeWarps: [1, 10, 30, 60, 300, 1800],
    })

    expect(result.timeWarpIndex).toBe(5)
    expect(result.simulationControls.controls).toEqual({
      main: 0,
      reverse: 0,
      strafe: 0,
      turn: 0,
    })
    expect(result.simulationControls.targetHeading).toBeNull()
    expect(result.simulationControls.targetHeadingTurn).toBeNull()
  })

  it('caps time warp when turning through target-heading guidance', () => {
    const result = stepSimulationFrame({
      assistMode: 'off',
      autopilotRotationRate: 0.9,
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: () => 1,
      getCaptureMetrics: () => ({
        circularSpeed: 0,
        distance: 0,
        insideRange: false,
        relativeSpeed: 0,
        roughAssistRange: 0,
        specificEnergy: 0,
        surfaceDistance: 0,
      }),
      getCircularizePlan: () => ({
        burnHeading: 0,
        deltaV: 0,
        desiredVelocityHeading: 0,
        distance: 0,
        radialSpeed: 0,
        tangentialSpeed: 0,
      }),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({ main: 0, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: () => {},
      },
      maxControlWarp: 100,
      physicsEngine: {
        name: 'test',
        step: (state) => state,
      },
      realDt: 1 / 60,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: Math.PI / 2,
      timeWarpIndex: requestedTimeWarps.indexOf(1800),
      timeWarps: requestedTimeWarps,
    })

    expect(result.timeWarpIndex).toBe(requestedTimeWarps.indexOf(60))
  })

  it('clears the target heading once target-heading rotation completes', () => {
    const result = stepSimulationFrame({
      assistMode: 'off',
      autopilotRotationRate: 0.9,
      crashedBodyName: null,
      getAssistTarget: () => createRuntimeState().bodies[0],
      getAutopilotTurn: () => 0,
      getCaptureMetrics: () => ({
        circularSpeed: 0,
        distance: 0,
        insideRange: false,
        relativeSpeed: 0,
        roughAssistRange: 0,
        specificEnergy: 0,
        surfaceDistance: 0,
      }),
      getCircularizePlan: () => ({
        burnHeading: 0,
        deltaV: 0,
        desiredVelocityHeading: 0,
        distance: 0,
        radialSpeed: 0,
        tangentialSpeed: 0,
      }),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({ main: 0, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
        setVirtualTurn: () => {},
      },
      maxControlWarp: 100,
      physicsEngine: {
        name: 'test',
        step: (state) => state,
      },
      realDt: 1 / 60,
      shouldCaptureBurn: () => false,
      state: createRuntimeState(),
      targetHeading: Math.PI / 2,
      timeWarpIndex: 0,
      timeWarps: [1, 10, 30, 60, 300, 1800],
    })

    expect(result.targetHeading).toBeNull()
    expect(result.targetHeadingTurn).toBeNull()
    expect(result.state.controls.turn).toBe(0)
  })

  it('ramps target-heading turns in and out through runtime state', () => {
    const { absoluteTurns, state, targetHeading, targetHeadingTurn } =
      simulateTargetHeadingTurn(Math.PI / 2)
    const peakTurn = Math.max(...absoluteTurns)
    const peakIndex = absoluteTurns.indexOf(peakTurn)
    const firstTurn = absoluteTurns[0]
    const finalTurn = absoluteTurns.at(-1) ?? 0

    expect(targetHeading).toBeNull()
    expect(targetHeadingTurn).toBeNull()
    expect(state.spacecraft.heading).toBeCloseTo(Math.PI / 2, 4)
    expect(firstTurn).toBeLessThan(0.05)
    expect(peakTurn).toBeGreaterThan(0.45)
    expect(peakTurn).toBeLessThan(0.55)
    expect(finalTurn).toBeLessThan(0.05)
    expect(peakIndex).toBeGreaterThan(0)
    expect(peakIndex).toBeLessThan(absoluteTurns.length * 0.5)
  })

  it('uses the same initial angular acceleration for short and long turns', () => {
    const shortTurn = simulateTargetHeadingTurn(0.35)
    const longTurn = simulateTargetHeadingTurn(Math.PI / 2)
    const shortPeakTurn = Math.max(...shortTurn.absoluteTurns)
    const longPeakTurn = Math.max(...longTurn.absoluteTurns)

    expect(shortTurn.targetHeading).toBeNull()
    expect(shortTurn.targetHeadingTurn).toBeNull()
    expect(shortTurn.state.spacecraft.heading).toBeCloseTo(0.35, 4)
    expect(shortPeakTurn).toBeLessThan(0.45)
    expect(longPeakTurn).toBeGreaterThan(0.45)
    expect(longPeakTurn).toBeLessThan(0.55)

    for (let index = 0; index < 12; index += 1) {
      expect(shortTurn.absoluteTurns[index]).toBeCloseTo(
        longTurn.absoluteTurns[index],
        6,
      )
    }
  })
})

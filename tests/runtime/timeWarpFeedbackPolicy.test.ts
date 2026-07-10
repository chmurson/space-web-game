import { describe, expect, it } from 'vitest'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { getTimeWarpFeedbackPreview } from '@/runtime/timeWarpFeedbackPolicy'

const requestedTimeWarps = [
  1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 900, 1800, 3600, 7200, 14400, 28800,
  54000,
]

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

const createBaseOptions = () => ({
  assistMode: 'off' as const,
  crashedBodyName: null,
  currentTimeWarpIndex: 3,
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
  },
  maxControlWarp: 100,
  maxTimeWarp: null,
  shouldCaptureBurn: () => false,
  state: createRuntimeState(),
  targetHeading: null,
  timeWarps: requestedTimeWarps,
})

describe('timeWarpFeedbackPolicy', () => {
  it('reports turning when target-heading guidance blocks an increase', () => {
    const preview = getTimeWarpFeedbackPreview({
      ...createBaseOptions(),
      action: 'increaseTimeWarp',
      currentTimeWarpIndex: requestedTimeWarps.indexOf(60),
      getAutopilotTurn: () => 1,
      targetHeading: Math.PI / 2,
    })

    expect(preview).toEqual({
      action: 'increaseTimeWarp',
      canCommit: false,
      reason: 'turning',
      value: 60,
    })
  })

  it('reports global-max only at the hard list edge', () => {
    const preview = getTimeWarpFeedbackPreview({
      ...createBaseOptions(),
      action: 'increaseTimeWarp',
      currentTimeWarpIndex: requestedTimeWarps.length - 1,
    })

    expect(preview).toEqual({
      action: 'increaseTimeWarp',
      canCommit: false,
      reason: 'global-max',
      value: 54000,
    })
  })

  it('reports global-min only at the hard list edge', () => {
    const preview = getTimeWarpFeedbackPreview({
      ...createBaseOptions(),
      action: 'decreaseTimeWarp',
      currentTimeWarpIndex: 0,
    })

    expect(preview).toEqual({
      action: 'decreaseTimeWarp',
      canCommit: false,
      reason: 'global-min',
      value: 1,
    })
  })

  it('keeps the constrained target value visible for scenario limits', () => {
    const preview = getTimeWarpFeedbackPreview({
      ...createBaseOptions(),
      action: 'increaseTimeWarp',
      currentTimeWarpIndex: requestedTimeWarps.indexOf(60),
      maxTimeWarp: 60,
    })

    expect(preview).toEqual({
      action: 'increaseTimeWarp',
      canCommit: false,
      reason: 'scenario-limit',
      value: 60,
    })
  })

  it('maps thrust clamps to thrust-active', () => {
    const preview = getTimeWarpFeedbackPreview({
      ...createBaseOptions(),
      action: 'increaseTimeWarp',
      currentTimeWarpIndex: requestedTimeWarps.indexOf(60),
      keyboardInput: {
        clear: () => {},
        getManualControls: () => ({ main: 1, reverse: 0, strafe: 0, turn: 0 }),
        hasManualTurn: () => false,
        press: () => {},
        release: () => {},
        setVirtualKey: () => {},
      },
    })

    expect(preview.reason).toBe('thrust-active')
    expect(preview.value).toBe(60)
  })
})

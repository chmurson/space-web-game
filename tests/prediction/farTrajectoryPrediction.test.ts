import { describe, expect, it } from 'vitest'

import {
  createFarTrajectoryPredictionStateSnapshot,
  createFarTrajectoryPredictor,
  type FarTrajectoryPredictionRequestPayload,
  predictFarTrajectory,
} from '@/prediction/farTrajectoryPrediction'
import { EARTH_MASS, EARTH_RADIUS, G } from '@/simulation/constants'
import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
import { idleControls } from '@/simulation/state'
import type { Body, SimulationState } from '@/simulation/types'
import { length, sub } from '@/simulation/vector'

const target: Body = {
  id: 'target',
  name: 'Target',
  mass: 0,
  radius: 10,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#fff',
}

const createState = (positionX = 1_100): SimulationState => ({
  bodies: [target],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    position: { x: positionX, y: 100 },
    velocity: { x: -10, y: 0 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 1,
    fuelMass: 1,
    fuelCapacity: 1,
  },
})

const createRequest = (
  state: SimulationState,
  options: {
    horizonSeconds?: number
    inputKey?: string
    jobId?: number
    maxIntegrationStepSeconds?: number
    maxLoopRevolutions?: number
    semanticInputKey?: string
    stepSeconds?: number
  } = {},
): FarTrajectoryPredictionRequestPayload => ({
  assistMode: 'off',
  autopilotRotationRate: 0.9,
  inputKey: options.inputKey ?? 'input-1',
  jobId: options.jobId ?? 1,
  predictionConfig: {
    horizonSeconds: options.horizonSeconds ?? 100,
    maxIntegrationStepSeconds:
      options.maxIntegrationStepSeconds ?? options.stepSeconds ?? 10,
    maxLoopRevolutions: options.maxLoopRevolutions ?? 2.5,
    refreshInterval: 0.4,
    stepSeconds: options.stepSeconds ?? 10,
  },
  semanticInputKey: options.semanticInputKey ?? 'semantic-1',
  state: createFarTrajectoryPredictionStateSnapshot(state),
  targetId: target.id,
})

const advanceState = (state: SimulationState, elapsedSeconds: number) =>
  semiImplicitEuler.step(state, elapsedSeconds)

describe('createFarTrajectoryPredictor', () => {
  it('trims elapsed passive-coast points and extends only the missing tip', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()

    const initial = predict(createRequest(initialState))
    const liveState = advanceState(initialState, 20)
    const request = createRequest(liveState, {
      inputKey: 'input-2',
      jobId: 2,
    })
    const reused = predict(request)
    const full = predictFarTrajectory(request)

    expect(initial.reuse).toEqual({
      extendedPointCount: 0,
      extendedSeconds: 0,
      fallbackReason: 'no-cache',
      mode: 'full',
      retainedPointCount: 0,
      retainedSeconds: 0,
      trimmedPointCount: 0,
      trimmedSeconds: 0,
      validation: 'full',
      validationSeconds: 0,
    })
    expect(reused.reuse).toEqual({
      extendedPointCount: 2,
      extendedSeconds: 20,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 8,
      retainedSeconds: 80,
      trimmedPointCount: 2,
      trimmedSeconds: 20,
      validation: 'performed',
      validationSeconds: 20,
    })
    expect(reused.coastPrediction).toMatchObject({
      absoluteEndPoint: full.coastPrediction.absoluteEndPoint,
      absolutePoints: full.coastPrediction.absolutePoints,
      closestApproach: full.coastPrediction.closestApproach,
      eventMarkers: full.coastPrediction.eventMarkers,
      impact: full.coastPrediction.impact,
      relativePoints: full.coastPrediction.relativePoints,
    })
    expect(reused.coastPrediction.integration.stepCount).toBeLessThan(
      full.coastPrediction.integration.stepCount,
    )
    expect(reused.coastPrediction.eventMarkers).toContainEqual(
      expect.objectContaining({ kind: 'periapsis', time: 90 }),
    )
  })

  it('reduces integration work for a high-elapsed long horizon', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState(1_000_000)
    const config = {
      horizonSeconds: 10_000,
      stepSeconds: 100,
    }

    predict(createRequest(initialState, config))
    const liveState = advanceState(initialState, 2_000)
    const request = createRequest(liveState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })
    const reused = predict(request)
    const full = predictFarTrajectory(request)

    expect(reused.reuse).toEqual({
      extendedPointCount: 20,
      extendedSeconds: 2_000,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 80,
      retainedSeconds: 8_000,
      trimmedPointCount: 20,
      trimmedSeconds: 2_000,
      validation: 'performed',
      validationSeconds: 2_000,
    })
    expect(reused.coastPrediction.absolutePoints).toEqual(
      full.coastPrediction.absolutePoints,
    )
    expect(reused.coastPrediction.closestApproach).toEqual(
      full.coastPrediction.closestApproach,
    )
    expect(reused.coastPrediction.integration.stepCount).toBe(40)
    expect(full.coastPrediction.integration.stepCount).toBe(100)
  })

  it('skips validation on the reuse between scheduled validations', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState(1_000_000)
    const config = {
      horizonSeconds: 10_000,
      stepSeconds: 100,
    }

    predict(createRequest(initialState, config))
    const firstLiveState = advanceState(initialState, 2_000)
    const firstReuse = predict(
      createRequest(firstLiveState, {
        ...config,
        inputKey: 'input-2',
        jobId: 2,
      }),
    )
    const secondLiveState = advanceState(firstLiveState, 2_000)
    const secondRequest = createRequest(secondLiveState, {
      ...config,
      inputKey: 'input-3',
      jobId: 3,
    })
    const secondReuse = predict(secondRequest)
    const full = predictFarTrajectory(secondRequest)

    expect(firstReuse.reuse.validation).toBe('performed')
    expect(firstReuse.reuse.validationSeconds).toBe(2_000)
    expect(secondReuse.reuse.validation).toBe('skipped')
    expect(secondReuse.reuse.validationSeconds).toBe(0)
    expect(secondReuse.coastPrediction.absolutePoints).toEqual(
      full.coastPrediction.absolutePoints,
    )
    expect(secondReuse.coastPrediction.integration.stepCount).toBeLessThan(
      firstReuse.coastPrediction.integration.stepCount,
    )
  })

  it('validates across a skipped reuse from the last trusted state', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    predict(createRequest(initialState))

    const firstLiveState = advanceState(initialState, 20)
    predict(createRequest(firstLiveState, { inputKey: 'input-2', jobId: 2 }))

    const secondLiveState = advanceState(firstLiveState, 20)
    const divergedState = {
      ...secondLiveState,
      spacecraft: {
        ...secondLiveState.spacecraft,
        position: {
          ...secondLiveState.spacecraft.position,
          y: secondLiveState.spacecraft.position.y + 50_000,
        },
      },
    }
    const skipped = predict(
      createRequest(divergedState, { inputKey: 'input-3', jobId: 3 }),
    )
    const thirdLiveState = advanceState(divergedState, 20)
    predict(createRequest(thirdLiveState, { inputKey: 'input-4', jobId: 4 }))
    const fourthLiveState = advanceState(thirdLiveState, 20)
    predict(createRequest(fourthLiveState, { inputKey: 'input-5', jobId: 5 }))
    const fifthLiveState = advanceState(fourthLiveState, 20)
    const checked = predict(
      createRequest(fifthLiveState, { inputKey: 'input-6', jobId: 6 }),
    )

    expect(skipped.reuse.validation).toBe('skipped')
    expect(checked.reuse).toMatchObject({
      fallbackReason: 'state-diverged',
      mode: 'full',
      validation: 'full',
    })
  })

  it('keeps a close Earth flyby near a full recompute baseline', () => {
    const predict = createFarTrajectoryPredictor()
    const earth = {
      ...target,
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
    }
    const initialState = {
      ...createState(),
      bodies: [earth],
      spacecraft: {
        ...createState().spacecraft,
        position: { x: -35_000_000, y: 8_800_000 },
        velocity: { x: 10_800, y: 0 },
      },
    }
    const config = {
      horizonSeconds: 21_600,
      maxIntegrationStepSeconds: 8,
      stepSeconds: 60,
    }
    predict(createRequest(initialState, config))
    let liveState = initialState
    for (let second = 0; second < 600; second += 1) {
      liveState = semiImplicitEuler.step(liveState, 1)
    }
    const request = createRequest(liveState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })

    const reused = predict(request)
    const full = predictFarTrajectory(request)
    const reusedEnd = reused.coastPrediction.absoluteEndPoint
    const fullEnd = full.coastPrediction.absoluteEndPoint

    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reusedEnd).not.toBeNull()
    expect(fullEnd).not.toBeNull()
    if (!reusedEnd || !fullEnd) {
      throw new Error('Expected both flyby predictions to include end points.')
    }
    expect(length(sub(reusedEnd, fullEnd))).toBeLessThan(100_000)
    expect(
      Math.abs(
        (reused.coastPrediction.closestApproach?.altitude ?? 0) -
          (full.coastPrediction.closestApproach?.altitude ?? 0),
      ),
    ).toBeLessThan(5_000)
    expect(reused.coastPrediction.impact).toEqual(full.coastPrediction.impact)
    expect(reused.coastPrediction.integration.stepCount).toBeLessThan(
      full.coastPrediction.integration.stepCount,
    )
  })

  it('preserves the physical horizon when elapsed time is between samples', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    predict(createRequest(initialState))
    const liveState = advanceState(initialState, 25)
    const request = createRequest(liveState, {
      inputKey: 'input-2',
      jobId: 2,
    })

    const reused = predict(request)

    expect(reused.reuse).toEqual({
      extendedPointCount: 3,
      extendedSeconds: 25,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 8,
      retainedSeconds: 75,
      trimmedPointCount: 2,
      trimmedSeconds: 25,
      validation: 'performed',
      validationSeconds: 25,
    })
    expect(reused.coastPrediction.absoluteEndPoint).toEqual({
      x: -150,
      y: 100,
    })
    expect(reused.coastPrediction.closestApproach).toMatchObject({
      altitude: 90,
      time: 85,
    })
    expect(reused.coastPrediction.eventMarkers).toContainEqual(
      expect.objectContaining({ kind: 'periapsis', time: 85 }),
    )
  })

  it('shifts an impact discovered while extending the tip', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    initialState.spacecraft.position.y = 0
    predict(createRequest(initialState))
    const liveState = advanceState(initialState, 20)
    const request = createRequest(liveState, {
      inputKey: 'input-2',
      jobId: 2,
    })

    const reused = predict(request)
    const full = predictFarTrajectory(request)

    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reused.coastPrediction.impact).toEqual({
      bodyName: target.name,
      time: 90,
    })
    expect(reused.coastPrediction.impact).toEqual(full.coastPrediction.impact)
  })

  it('falls back when too much of the cached horizon has elapsed', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState(1_000_000)
    predict(createRequest(initialState))
    const liveState = advanceState(initialState, 30)

    const result = predict(
      createRequest(liveState, { inputKey: 'input-2', jobId: 2 }),
    )

    expect(result.reuse.fallbackReason).toBe('elapsed-outside-window')
    expect(result.reuse.mode).toBe('full')
  })

  it('falls back when the live coast diverges near a body', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    predict(createRequest(initialState))
    const coastedState = advanceState(initialState, 20)
    const divergedState = {
      ...coastedState,
      spacecraft: {
        ...coastedState.spacecraft,
        position: { ...coastedState.spacecraft.position, y: 50_000 },
      },
    }
    const request = createRequest(divergedState, {
      inputKey: 'input-2',
      jobId: 2,
    })

    const result = predict(request)
    const full = predictFarTrajectory(request)

    expect(result.reuse).toEqual({
      extendedPointCount: 0,
      extendedSeconds: 0,
      fallbackReason: 'state-diverged',
      mode: 'full',
      retainedPointCount: 0,
      retainedSeconds: 0,
      trimmedPointCount: 0,
      trimmedSeconds: 0,
      validation: 'full',
      validationSeconds: 0,
    })
    expect(result.coastPrediction).toEqual(full.coastPrediction)
  })

  it('falls back for semantic changes and active controls', () => {
    const predictSemanticChange = createFarTrajectoryPredictor()
    const initialState = createState()
    predictSemanticChange(createRequest(initialState))
    const liveState = advanceState(initialState, 20)

    const semanticChange = predictSemanticChange(
      createRequest(liveState, {
        inputKey: 'input-2',
        jobId: 2,
        semanticInputKey: 'semantic-2',
      }),
    )
    expect(semanticChange.reuse.fallbackReason).toBe('semantic-change')

    const predictActiveControls = createFarTrajectoryPredictor()
    predictActiveControls(createRequest(initialState))
    const activeState = {
      ...liveState,
      controls: { ...liveState.controls, main: 1 },
    }
    const activeControls = predictActiveControls(
      createRequest(activeState, { inputKey: 'input-2', jobId: 2 }),
    )
    expect(activeControls.reuse.fallbackReason).toBe('not-passive-coast')
  })

  it('reuses bound paths while preserving the loop-trimmed trajectory', () => {
    const predict = createFarTrajectoryPredictor()
    const orbitingTarget = {
      ...target,
      mass: 1_000_000_000_000_000,
    }
    const orbitalRadius = 1_100
    const initialState = {
      ...createState(),
      bodies: [orbitingTarget],
      spacecraft: {
        ...createState().spacecraft,
        position: { x: orbitalRadius, y: 0 },
        velocity: {
          x: 0,
          y: Math.sqrt((G * orbitingTarget.mass) / orbitalRadius),
        },
      },
    }
    const config = {
      horizonSeconds: 5_000,
      maxLoopRevolutions: 1,
      stepSeconds: 10,
    }
    const initial = predict(createRequest(initialState, config))
    let laterState = initialState
    for (let second = 0; second < 20; second += 1) {
      laterState = advanceState(laterState, 1)
    }
    const request = createRequest(laterState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })

    const reused = predict(request)
    const full = predictFarTrajectory(request)
    const reusedEnd = reused.coastPrediction.absoluteEndPoint
    const fullEnd = full.coastPrediction.absoluteEndPoint

    expect(initial.coastPrediction.relativePoints.length).toBeLessThan(
      config.horizonSeconds / config.stepSeconds,
    )
    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reused.reuse.extendedSeconds).toBeGreaterThan(0)
    expect(reused.coastPrediction.relativePoints).toHaveLength(
      full.coastPrediction.relativePoints.length,
    )
    expect(reusedEnd).not.toBeNull()
    expect(fullEnd).not.toBeNull()
    if (!reusedEnd || !fullEnd) {
      throw new Error('Expected bound predictions to include end points.')
    }
    expect(length(sub(reusedEnd, fullEnd))).toBeLessThan(10)
    expect(
      Math.abs(
        (reused.coastPrediction.closestApproach?.altitude ?? 0) -
          (full.coastPrediction.closestApproach?.altitude ?? 0),
      ),
    ).toBeLessThan(10)
    expect(
      reused.coastPrediction.eventMarkers.map((marker) => marker.kind),
    ).toEqual(full.coastPrediction.eventMarkers.map((marker) => marker.kind))
    expect(reused.coastPrediction.integration.stepCount).toBeLessThan(
      full.coastPrediction.integration.stepCount,
    )

    let twiceLaterState = laterState
    for (let second = 0; second < 20; second += 1) {
      twiceLaterState = advanceState(twiceLaterState, 1)
    }
    const secondRequest = createRequest(twiceLaterState, {
      ...config,
      inputKey: 'input-3',
      jobId: 3,
    })
    const reusedAgain = predict(secondRequest)
    const fullAgain = predictFarTrajectory(secondRequest)
    const reusedAgainEnd = reusedAgain.coastPrediction.absoluteEndPoint
    const fullAgainEnd = fullAgain.coastPrediction.absoluteEndPoint

    expect(reusedAgain.reuse.mode).toBe('trim-extend')
    expect(reusedAgain.coastPrediction.relativePoints).toHaveLength(
      fullAgain.coastPrediction.relativePoints.length,
    )
    expect(reusedAgainEnd).not.toBeNull()
    expect(fullAgainEnd).not.toBeNull()
    if (!reusedAgainEnd || !fullAgainEnd) {
      throw new Error(
        'Expected rolled bound predictions to include end points.',
      )
    }
    expect(length(sub(reusedAgainEnd, fullAgainEnd))).toBeLessThan(10)
  })

  it('falls back after sixteen consecutive reuse rolls', () => {
    const predict = createFarTrajectoryPredictor()
    let state = createState(1_000_000)
    const config = { horizonSeconds: 1_000, stepSeconds: 10 }
    predict(createRequest(state, config))
    const validations: string[] = []

    for (let jobId = 2; jobId <= 17; jobId += 1) {
      state = advanceState(state, 20)
      const result = predict(
        createRequest(state, {
          ...config,
          inputKey: `input-${jobId}`,
          jobId,
        }),
      )
      expect(result.reuse.mode).toBe('trim-extend')
      validations.push(result.reuse.validation)
    }

    expect(
      validations.filter((validation) => validation === 'performed'),
    ).toHaveLength(4)
    expect(
      validations.filter((validation) => validation === 'skipped'),
    ).toHaveLength(12)

    state = advanceState(state, 20)
    const forcedFull = predict(
      createRequest(state, { ...config, inputKey: 'input-18', jobId: 18 }),
    )

    expect(forcedFull.reuse).toEqual({
      extendedPointCount: 0,
      extendedSeconds: 0,
      fallbackReason: 'reuse-limit',
      mode: 'full',
      retainedPointCount: 0,
      retainedSeconds: 0,
      trimmedPointCount: 0,
      trimmedSeconds: 0,
      validation: 'full',
      validationSeconds: 0,
    })
  })

  it('rebuilds closest-approach metadata after the cached approach expires', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = {
      ...createState(100),
      spacecraft: {
        ...createState(100).spacecraft,
        velocity: { x: 10, y: 0 },
      },
    }
    const config = {
      horizonSeconds: 1_000,
      maxIntegrationStepSeconds: 10,
      stepSeconds: 100,
    }
    predict(createRequest(initialState, config))
    const liveState = advanceState(initialState, 25)

    const request = createRequest(liveState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })
    const reused = predict(request)
    const full = predictFarTrajectory(request)

    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reused.coastPrediction.closestApproach).toEqual(
      full.coastPrediction.closestApproach,
    )
    expect(reused.coastPrediction.eventMarkers).toEqual(
      full.coastPrediction.eventMarkers,
    )
    expect(reused.coastPrediction.integration.stepCount).toBeLessThan(
      full.coastPrediction.integration.stepCount,
    )
  })

  it('drops elapsed event markers without discarding the reusable path', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    const config = {
      horizonSeconds: 1_000,
      stepSeconds: 10,
    }
    const initial = predict(createRequest(initialState, config))
    const liveState = advanceState(initialState, 120)
    const request = createRequest(liveState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })

    const reused = predict(request)
    const full = predictFarTrajectory(request)

    expect(initial.coastPrediction.eventMarkers).toContainEqual(
      expect.objectContaining({ kind: 'periapsis', time: 110 }),
    )
    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reused.coastPrediction.closestApproach).toEqual(
      full.coastPrediction.closestApproach,
    )
    expect(reused.coastPrediction.eventMarkers).toEqual([])
    expect(reused.coastPrediction.eventMarkers).toEqual(
      full.coastPrediction.eventMarkers,
    )
  })
})

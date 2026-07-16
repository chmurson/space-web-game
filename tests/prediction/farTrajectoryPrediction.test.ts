import { describe, expect, it } from 'vitest'

import {
  createFarTrajectoryPredictionStateSnapshot,
  createFarTrajectoryPredictor,
  type FarTrajectoryPredictionRequestPayload,
  predictFarTrajectory,
} from '@/prediction/farTrajectoryPrediction'
import { EARTH_MASS, EARTH_RADIUS } from '@/simulation/constants'
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
    maxLoopRevolutions: 2.5,
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
      extendedSeconds: 0,
      fallbackReason: 'no-cache',
      mode: 'full',
      retainedPointCount: 0,
    })
    expect(reused.reuse).toEqual({
      extendedSeconds: 20,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 8,
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
      extendedSeconds: 2_000,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 80,
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
      extendedSeconds: 25,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: 8,
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
      extendedSeconds: 0,
      fallbackReason: 'state-diverged',
      mode: 'full',
      retainedPointCount: 0,
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

  it('falls back for bound paths that may have stopped at the loop limit', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = {
      ...createState(),
      bodies: [{ ...target, mass: 1_000_000_000_000_000 }],
    }
    predict(createRequest(initialState))
    const laterState = { ...initialState, elapsed: 20 }

    const result = predict(
      createRequest(laterState, { inputKey: 'input-2', jobId: 2 }),
    )

    expect(result.reuse.fallbackReason).toBe('loop-trim-risk')
    expect(result.reuse.mode).toBe('full')
  })

  it('falls back after four consecutive reuse rolls', () => {
    const predict = createFarTrajectoryPredictor()
    let state = createState(1_000_000)
    const config = { horizonSeconds: 1_000, stepSeconds: 10 }
    predict(createRequest(state, config))

    for (let jobId = 2; jobId <= 5; jobId += 1) {
      state = advanceState(state, 20)
      expect(
        predict(
          createRequest(state, {
            ...config,
            inputKey: `input-${jobId}`,
            jobId,
          }),
        ).reuse.mode,
      ).toBe('trim-extend')
    }

    state = advanceState(state, 20)
    const forcedFull = predict(
      createRequest(state, { ...config, inputKey: 'input-6', jobId: 6 }),
    )

    expect(forcedFull.reuse).toEqual({
      extendedSeconds: 0,
      fallbackReason: 'reuse-limit',
      mode: 'full',
      retainedPointCount: 0,
    })
  })

  it('falls back when elapsed closest-approach metadata is no longer valid', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = {
      ...createState(100),
      spacecraft: {
        ...createState(100).spacecraft,
        velocity: { x: 10, y: 0 },
      },
    }
    predict(createRequest(initialState))
    const liveState = advanceState(initialState, 20)

    const result = predict(
      createRequest(liveState, { inputKey: 'input-2', jobId: 2 }),
    )

    expect(result.reuse.fallbackReason).toBe('expired-metadata')
    expect(result.reuse.mode).toBe('full')
  })
})

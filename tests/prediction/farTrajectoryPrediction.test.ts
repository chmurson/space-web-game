import { describe, expect, it } from 'vitest'

import {
  createFarTrajectoryPredictionStateSnapshot,
  createFarTrajectoryPredictor,
  type FarTrajectoryPredictionRequestPayload,
  predictFarTrajectory,
} from '@/prediction/farTrajectoryPrediction'
import { computeCoastTrajectoryPrediction } from '@/prediction/trajectoryPrediction'
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
    predictionImplementation?: 'euler' | 'kepler'
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
  predictionImplementation: options.predictionImplementation,
  semanticInputKey: options.semanticInputKey ?? 'semantic-1',
  state: createFarTrajectoryPredictionStateSnapshot(state),
  targetId: target.id,
})

const advanceState = (state: SimulationState, elapsedSeconds: number) =>
  semiImplicitEuler.step(state, elapsedSeconds)

describe('createFarTrajectoryPredictor', () => {
  it('uses Kepler only when the target is the sole gravitating body', () => {
    const massiveTarget = {
      ...target,
      mass: 1_000_000_000_000_000,
    }
    const orbitRadius = 1_100
    const orbitalState = {
      ...createState(),
      bodies: [massiveTarget],
      spacecraft: {
        ...createState().spacecraft,
        position: { x: orbitRadius, y: 0 },
        velocity: {
          x: 0,
          y: Math.sqrt((G * massiveTarget.mass) / orbitRadius),
        },
      },
    }
    const keplerResult = predictFarTrajectory(
      createRequest(orbitalState, {
        predictionImplementation: 'kepler',
      }),
    )
    const multiBodyResult = predictFarTrajectory(
      createRequest(
        {
          ...orbitalState,
          bodies: [
            massiveTarget,
            {
              ...target,
              id: 'secondary',
              mass: 1_000_000_000_000,
              position: { x: 1_000_000, y: 0 },
            },
          ],
        },
        { predictionImplementation: 'kepler' },
      ),
    )

    expect(keplerResult.coastPrediction.integration.stepCount).toBe(0)
    expect(keplerResult.reuse.fallbackReason).toBe('kepler-mode')
    expect(
      multiBodyResult.coastPrediction.integration.stepCount,
    ).toBeGreaterThan(0)
    expect(multiBodyResult.reuse.fallbackReason).toBe('no-cache')
  })

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
      divergence: null,
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
    expect(initial.coastWindow).toMatchObject({
      allowLoopTrim: false,
      anchorElapsed: 0,
      terminationReason: 'horizon',
      totalCoverageSeconds: 100,
    })
    expect(initial.coastWindow.sampleTimes).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ])
    expect(reused.reuse).toEqual({
      divergence: null,
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
    expect(reused.coastWindow).toMatchObject({
      anchorElapsed: 20,
      terminationReason: 'horizon',
      totalCoverageSeconds: 100,
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
      divergence: null,
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
    expect(reused.coastPrediction.integration.stepCount).toBe(41)
    expect(full.coastPrediction.integration.stepCount).toBe(100)
  })

  it('validates every consecutive reuse from the previous accepted state', () => {
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
    expect(secondReuse.reuse.validation).toBe('performed')
    expect(secondReuse.reuse.validationSeconds).toBe(2_000)
    expect(secondReuse.coastPrediction.absolutePoints).toEqual(
      full.coastPrediction.absolutePoints,
    )
    expect(secondReuse.coastPrediction.integration.stepCount).toBeLessThan(
      full.coastPrediction.integration.stepCount,
    )
  })

  it('rejects divergence on the next consecutive reuse', () => {
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
    const checked = predict(
      createRequest(divergedState, { inputKey: 'input-3', jobId: 3 }),
    )

    expect(checked.reuse).toMatchObject({
      divergence: {
        reason: 'validation-spacecraft-position',
      },
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
      divergence: null,
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
    expect(reused.coastWindow).toMatchObject({
      anchorElapsed: 20,
      terminationReason: 'impact',
      totalCoverageSeconds: 90,
    })
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

    expect(result.reuse).toMatchObject({
      divergence: {
        detail: null,
        measurements: expect.arrayContaining([
          expect.objectContaining({
            bodyId: null,
            delta: 49_900,
            metric: 'spacecraft-position',
            tolerance: 5_000,
            unit: 'meters',
          }),
          expect.objectContaining({
            bodyId: 'target',
            delta: 0,
            metric: 'body-position',
          }),
        ]),
        reason: 'validation-spacecraft-position',
      },
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

  it('reports absolute body drift separately from spacecraft drift', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    predict(createRequest(initialState))
    const coastedState = advanceState(initialState, 20)
    const divergedState = {
      ...coastedState,
      bodies: [
        {
          ...coastedState.bodies[0],
          position: { x: 50_000, y: 0 },
        },
      ],
    }

    const result = predict(
      createRequest(divergedState, { inputKey: 'input-2', jobId: 2 }),
    )

    expect(result.reuse).toMatchObject({
      divergence: {
        measurements: expect.arrayContaining([
          expect.objectContaining({
            bodyId: 'target',
            delta: 50_000,
            gatesReuse: true,
            metric: 'body-position',
            tolerance: 5_000,
            unit: 'meters',
          }),
          expect.objectContaining({
            bodyId: 'target',
            delta: 50_000,
            gatesReuse: false,
            metric: 'target-position',
          }),
          expect.objectContaining({
            bodyId: 'target',
            delta: 50_000,
            gatesReuse: false,
            metric: 'spacecraft-target-relative-position',
          }),
        ]),
        reason: 'validation-body-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })
  })

  it('does not gate reuse on informational target-relative drift', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState()
    predict(createRequest(initialState))
    const coastedState = advanceState(initialState, 20)
    const shiftedState = {
      ...coastedState,
      bodies: [
        {
          ...coastedState.bodies[0],
          position: { x: 0, y: -4_000 },
        },
      ],
      spacecraft: {
        ...coastedState.spacecraft,
        position: { ...coastedState.spacecraft.position, y: 4_100 },
      },
    }

    const result = predict(
      createRequest(shiftedState, { inputKey: 'input-2', jobId: 2 }),
    )

    expect(result.reuse.mode).toBe('trim-extend')
    expect(result.reuse.divergence).toBeNull()
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
    expect(initial.coastWindow).toMatchObject({
      allowLoopTrim: true,
      terminationReason: 'loop-limit',
    })
    expect(initial.coastWindow.totalCoverageSeconds).toBeLessThan(
      config.horizonSeconds,
    )
    expect(reused.reuse.mode).toBe('trim-extend')
    expect(reused.coastWindow).toMatchObject({
      allowLoopTrim: true,
      anchorElapsed: 20,
      terminationReason: 'loop-limit',
    })
    expect(reused.coastWindow.totalCoverageSeconds).toBeLessThan(
      config.horizonSeconds,
    )
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

  it('validates a close bound orbit at live-simulation precision', () => {
    const predict = createFarTrajectoryPredictor()
    const orbitingTarget = {
      ...target,
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
    }
    const initialState = {
      ...createState(),
      bodies: [orbitingTarget],
      spacecraft: {
        ...createState().spacecraft,
        position: { x: 18_780_247, y: 0 },
        velocity: { x: 0, y: 3_575 },
      },
    }
    const config = {
      horizonSeconds: 14_400,
      maxIntegrationStepSeconds: 8,
      maxLoopRevolutions: 1,
      stepSeconds: 30,
    }
    const initialRequest = createRequest(initialState, config)
    predict(initialRequest)
    let liveState = initialState
    for (let second = 0; second < 1_800; second += 1) {
      liveState = advanceState(liveState, 1)
    }
    const coarseValidation = computeCoastTrajectoryPrediction(
      initialState,
      semiImplicitEuler,
      orbitingTarget,
      {
        ...initialRequest.predictionConfig,
        horizonSeconds: 1_800,
      },
      false,
    )

    const result = predict(
      createRequest(liveState, {
        ...config,
        inputKey: 'input-2',
        jobId: 2,
      }),
    )

    expect(
      length(
        sub(
          coarseValidation.finalState.spacecraft.position,
          liveState.spacecraft.position,
        ),
      ),
    ).toBeGreaterThan(5_000)
    expect(result.reuse).toMatchObject({
      divergence: null,
      mode: 'trim-extend',
      validation: 'performed',
      validationSeconds: 1_800,
    })
  })

  it('uses a speed-relative position tolerance for a medium bound orbit', () => {
    const orbitingTarget = {
      ...target,
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
    }
    const apogeeRadius = 135_000_000
    const perigeeRadius = 10_000_000
    const semiMajorAxis = (apogeeRadius + perigeeRadius) / 2
    const eccentricity =
      (apogeeRadius - perigeeRadius) / (apogeeRadius + perigeeRadius)
    const semiLatusRectum = semiMajorAxis * (1 - eccentricity ** 2)
    const radius = 34_400_000
    const trueAnomaly = -Math.acos(
      (semiLatusRectum / radius - 1) / eccentricity,
    )
    const baseState = createState()
    const radial = {
      x: Math.cos(trueAnomaly),
      y: Math.sin(trueAnomaly),
    }
    const tangent = { x: -radial.y, y: radial.x }
    const velocityScale = Math.sqrt((G * orbitingTarget.mass) / semiLatusRectum)
    const radialSpeed = velocityScale * eccentricity * Math.sin(trueAnomaly)
    const tangentialSpeed =
      velocityScale * (1 + eccentricity * Math.cos(trueAnomaly))
    const initialState = {
      ...baseState,
      bodies: [orbitingTarget],
      spacecraft: {
        ...baseState.spacecraft,
        position: { x: radial.x * radius, y: radial.y * radius },
        velocity: {
          x: radial.x * radialSpeed + tangent.x * tangentialSpeed,
          y: radial.y * radialSpeed + tangent.y * tangentialSpeed,
        },
      },
    }
    const config = {
      horizonSeconds: 172_800,
      maxIntegrationStepSeconds: 8,
      maxLoopRevolutions: 2.5,
      stepSeconds: 180,
    }
    const initialRequest = createRequest(initialState, config)
    const predict = createFarTrajectoryPredictor()
    predict(initialRequest)
    let liveState = initialState
    for (let second = 0; second < 22_500; second += 1) {
      liveState = advanceState(liveState, 1)
    }
    const coarseValidation = computeCoastTrajectoryPrediction(
      initialState,
      semiImplicitEuler,
      orbitingTarget,
      {
        ...initialRequest.predictionConfig,
        horizonSeconds: 22_500,
      },
      false,
    )
    const request = createRequest(liveState, {
      ...config,
      inputKey: 'input-2',
      jobId: 2,
    })
    const coarsePositionDelta = length(
      sub(
        coarseValidation.finalState.spacecraft.position,
        liveState.spacecraft.position,
      ),
    )
    const expectedTolerance = Math.min(
      50_000,
      Math.max(
        5_000,
        length(sub(liveState.spacecraft.velocity, orbitingTarget.velocity)) *
          20,
      ),
    )

    const reused = predict(request)

    expect(coarsePositionDelta).toBeGreaterThan(5_000)
    expect(coarsePositionDelta).toBeLessThan(expectedTolerance)
    expect(reused.reuse).toMatchObject({
      divergence: null,
      mode: 'trim-extend',
      validation: 'performed',
      validationSeconds: 22_500,
    })

    const predictDivergence = createFarTrajectoryPredictor()
    predictDivergence(initialRequest)
    const divergedState = {
      ...liveState,
      spacecraft: {
        ...liveState.spacecraft,
        position: {
          ...liveState.spacecraft.position,
          x: liveState.spacecraft.position.x + 100_000,
        },
      },
    }
    const rejected = predictDivergence(
      createRequest(divergedState, {
        ...config,
        inputKey: 'input-2-diverged',
        jobId: 2,
      }),
    )
    expect(rejected.reuse).toMatchObject({
      divergence: {
        measurements: expect.arrayContaining([
          expect.objectContaining({
            metric: 'spacecraft-position',
            tolerance: expectedTolerance,
          }),
        ]),
        reason: 'validation-spacecraft-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })
  })

  it('scales the bound position tolerance before reaching its cap', () => {
    const orbitingTarget = {
      ...target,
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
    }
    const targetRelativeSpeed = 1_000
    const orbitRadius = (G * orbitingTarget.mass) / targetRelativeSpeed ** 2
    const baseState = createState()
    const initialState = {
      ...baseState,
      bodies: [orbitingTarget],
      spacecraft: {
        ...baseState.spacecraft,
        position: { x: orbitRadius, y: 0 },
        velocity: { x: 0, y: targetRelativeSpeed },
      },
    }
    const config = {
      horizonSeconds: 1_000,
      maxIntegrationStepSeconds: 10,
      stepSeconds: 100,
    }
    const initialRequest = createRequest(initialState, config)
    const predict = createFarTrajectoryPredictor()
    predict(initialRequest)
    const validationState = computeCoastTrajectoryPrediction(
      initialState,
      semiImplicitEuler,
      orbitingTarget,
      {
        ...initialRequest.predictionConfig,
        horizonSeconds: 20,
      },
      false,
    ).finalState
    const liveTarget = validationState.bodies[0]
    if (!liveTarget) {
      throw new Error('Expected orbit target after validation coast')
    }
    const expectedTolerance =
      length(sub(validationState.spacecraft.velocity, liveTarget.velocity)) * 20
    const divergedState = {
      ...validationState,
      spacecraft: {
        ...validationState.spacecraft,
        position: {
          ...validationState.spacecraft.position,
          x: validationState.spacecraft.position.x + expectedTolerance + 1_000,
        },
      },
    }

    const result = predict(
      createRequest(divergedState, {
        ...config,
        inputKey: 'input-2',
        jobId: 2,
      }),
    )

    expect(expectedTolerance).toBeGreaterThan(5_000)
    expect(expectedTolerance).toBeLessThan(50_000)
    expect(result.reuse).toMatchObject({
      divergence: {
        measurements: expect.arrayContaining([
          expect.objectContaining({
            metric: 'spacecraft-position',
            tolerance: expectedTolerance,
          }),
        ]),
        reason: 'validation-spacecraft-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })
  })

  it('uses a distinct phase allowance and cap for a bound seam', () => {
    const createSeamFailure = (
      targetRelativeSpeed: number,
      stepSeconds: number,
    ) => {
      const orbitingTarget = {
        ...target,
        mass: EARTH_MASS,
        radius: EARTH_RADIUS,
      }
      const orbitRadius = (G * orbitingTarget.mass) / targetRelativeSpeed ** 2
      const baseState = createState()
      const initialState = {
        ...baseState,
        bodies: [orbitingTarget],
        spacecraft: {
          ...baseState.spacecraft,
          position: { x: orbitRadius, y: 0 },
          velocity: { x: 0, y: targetRelativeSpeed },
        },
      }
      const config = {
        horizonSeconds: stepSeconds * 3,
        maxIntegrationStepSeconds: 10,
        stepSeconds,
      }
      const initialRequest = createRequest(initialState, config)
      const predict = createFarTrajectoryPredictor()
      predict(initialRequest)
      const validationState = computeCoastTrajectoryPrediction(
        initialState,
        semiImplicitEuler,
        orbitingTarget,
        {
          ...initialRequest.predictionConfig,
          horizonSeconds: 20,
        },
        false,
      ).finalState
      const liveTarget = validationState.bodies[0]
      if (!liveTarget) {
        throw new Error('Expected orbit target after validation coast')
      }
      const liveVelocity = {
        ...validationState.spacecraft.velocity,
        y: validationState.spacecraft.velocity.y + 4.9,
      }
      const liveTargetRelativeSpeed = length(
        sub(liveVelocity, liveTarget.velocity),
      )
      const validationTolerance = Math.min(
        50_000,
        Math.max(5_000, liveTargetRelativeSpeed * 20),
      )
      const seamTolerance = Math.min(
        60_000,
        Math.max(5_000, liveTargetRelativeSpeed * 25),
      )
      const liveState = {
        ...validationState,
        spacecraft: {
          ...validationState.spacecraft,
          position: {
            ...validationState.spacecraft.position,
            y:
              validationState.spacecraft.position.y +
              validationTolerance -
              1_000,
          },
          velocity: liveVelocity,
        },
      }
      const result = predict(
        createRequest(liveState, {
          ...config,
          inputKey: 'input-2',
          jobId: 2,
        }),
      )

      return { result, seamTolerance, validationTolerance }
    }

    const proportional = createSeamFailure(1_000, 2_000)
    expect(proportional.seamTolerance).toBeGreaterThan(
      proportional.validationTolerance,
    )
    expect(proportional.seamTolerance).toBeLessThan(60_000)
    expect(proportional.result.reuse).toMatchObject({
      divergence: {
        measurements: [
          expect.objectContaining({
            metric: 'seam-position',
            tolerance: proportional.seamTolerance,
          }),
        ],
        reason: 'seam-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })

    const capped = createSeamFailure(3_500, 4_000)
    expect(capped.validationTolerance).toBe(50_000)
    expect(capped.seamTolerance).toBe(60_000)
    expect(capped.result.reuse).toMatchObject({
      divergence: {
        measurements: [
          expect.objectContaining({
            metric: 'seam-position',
            tolerance: 60_000,
          }),
        ],
        reason: 'seam-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })
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

    expect(validations).toEqual(Array(16).fill('performed'))

    state = advanceState(state, 20)
    const forcedFull = predict(
      createRequest(state, { ...config, inputKey: 'input-18', jobId: 18 }),
    )

    expect(forcedFull.reuse).toEqual({
      divergence: null,
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

  it('checks the seam even when retained closest-approach metadata is valid', () => {
    const predict = createFarTrajectoryPredictor()
    const initialState = createState(1_000_000)
    const config = {
      horizonSeconds: 10_000,
      maxIntegrationStepSeconds: 1_000,
      stepSeconds: 1_000,
    }
    predict(createRequest(initialState, config))
    const coastedState = advanceState(initialState, 250)
    const divergedState = {
      ...coastedState,
      spacecraft: {
        ...coastedState.spacecraft,
        position: {
          ...coastedState.spacecraft.position,
          y: coastedState.spacecraft.position.y + 4_000,
        },
        velocity: { ...coastedState.spacecraft.velocity, y: 4 },
      },
    }

    const result = predict(
      createRequest(divergedState, {
        ...config,
        inputKey: 'input-2',
        jobId: 2,
      }),
    )

    expect(result.reuse).toMatchObject({
      divergence: {
        measurements: [
          expect.objectContaining({
            delta: expect.any(Number),
            metric: 'seam-position',
            tolerance: 5_000,
            unit: 'meters',
          }),
        ],
        reason: 'seam-position',
      },
      fallbackReason: 'state-diverged',
      mode: 'full',
    })
    expect(result.reuse.divergence?.measurements[0]?.delta).toBeGreaterThan(
      5_000,
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

import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import {
  getCoastTrajectoryPredictionMaxIntegrationStepSeconds,
  getTrajectoryPredictionConfig,
  predictCoastTrajectory,
  type TrajectoryPredictionConfig,
  type TrajectoryPredictionSamplingConfig,
} from '@/prediction/trajectoryPrediction'
import { EARTH_MASS, EARTH_RADIUS } from '@/simulation/constants'
import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
import { createEarthMoonScenario } from '@/simulation/scenarios/earthMoon'
import { idleControls } from '@/simulation/state'
import type {
  Body,
  PhysicsEngine,
  SimulationState,
  Spacecraft,
} from '@/simulation/types'
import { length, sub, type Vec2 } from '@/simulation/vector'

const productionPredictionSampling: TrajectoryPredictionSamplingConfig = {
  maxIntegrationStepSeconds: 8,
  refreshInterval: 0.4,
  targetMaxSteps: 1200,
  stepOptionsSeconds: [
    30, 45, 60, 90, 120, 180, 300, 450, 600, 900, 1200, 1800,
  ],
}

const createEarthBody = (): Body => ({
  id: 'earth',
  name: 'Earth',
  mass: EARTH_MASS,
  radius: EARTH_RADIUS,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#2f80ed',
})

const createSimulationState = (
  bodies: Body[],
  spacecraft: Spacecraft,
): SimulationState => ({
  elapsed: 0,
  controls: idleControls(),
  bodies,
  spacecraft,
})

const createEarthMoonSimulationState = (): SimulationState => {
  const scenario = createEarthMoonScenario()

  return createSimulationState(scenario.bodies, scenario.spacecraft)
}

const createCloseEarthFlybyState = (): SimulationState =>
  createSimulationState([createEarthBody()], {
    position: { x: -35_000_000, y: 8_800_000 },
    velocity: { x: 10_800, y: 0 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 10_000,
    fuelMass: 8_000,
    fuelCapacity: 32_000,
  })

const createPredictionConfig = (
  hours: number,
  maxIntegrationStepSeconds: number,
): TrajectoryPredictionConfig => ({
  ...getTrajectoryPredictionConfig(
    hours * 60 * 60,
    productionPredictionSampling,
    2.5,
  ),
  maxIntegrationStepSeconds,
})

const createSampledPathPredictionConfig = (
  horizonSeconds: number,
): TrajectoryPredictionConfig => ({
  horizonSeconds,
  maxIntegrationStepSeconds: 1,
  maxLoopRevolutions: 2.5,
  refreshInterval: 0.4,
  stepSeconds: 1,
})

const createSampledPathPhysicsEngine = (points: Vec2[]): PhysicsEngine => ({
  name: 'sampled path',
  step: (state, dt) => {
    const elapsed = state.elapsed + dt
    const index = Math.min(Math.round(elapsed), points.length - 1)

    return {
      ...state,
      elapsed,
      spacecraft: {
        ...state.spacecraft,
        position: points[index] ?? points.at(-1) ?? state.spacecraft.position,
      },
    }
  },
})

const createSampledPathState = (
  distances: number[],
  targetRadius = 0,
): SimulationState =>
  createSimulationState(
    [
      {
        ...createEarthBody(),
        mass: 0,
        radius: targetRadius,
      },
    ],
    {
      position: { x: distances[0], y: 0 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      fuel: 1,
      fuelUsed: 0,
      dryMass: 1,
      fuelMass: 1,
      fuelCapacity: 1,
    },
  )

const predictSampledPath = (options: {
  allowLoopTrim: boolean
  distances: number[]
  horizonSeconds: number
  targetRadius?: number
}) => {
  const state = createSampledPathState(options.distances, options.targetRadius)
  const target = getEarthTarget(state)
  const points = options.distances.map((distance) => ({ x: distance, y: 0 }))

  return predictCoastTrajectory(
    state,
    createSampledPathPhysicsEngine(points),
    target,
    createSampledPathPredictionConfig(options.horizonSeconds),
    options.allowLoopTrim,
  )
}

const getEarthTarget = (state: SimulationState): Body => {
  const earth = state.bodies.find((body) => body.id === 'earth')

  if (!earth) {
    throw new Error('Expected test state to include Earth.')
  }

  return earth
}

describe('predictCoastTrajectory', () => {
  it('uses tighter integration for close bound coast predictions', () => {
    const state = createEarthMoonSimulationState()
    const target = getEarthTarget(state)
    const predictionConfig = createPredictionConfig(2, 8)
    const allowLoopTrim =
      getCaptureMetricsForState(state, target).specificEnergy < 0

    expect(
      getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
        state,
        target,
        predictionConfig,
        allowLoopTrim,
      ),
    ).toBe(2)

    const prediction = predictCoastTrajectory(
      state,
      semiImplicitEuler,
      target,
      predictionConfig,
      allowLoopTrim,
    )
    const periapsis = prediction.eventMarkers.find(
      (marker) => marker.kind === 'periapsis',
    )
    const apoapsis = prediction.eventMarkers.find(
      (marker) => marker.kind === 'apoapsis',
    )

    expect(periapsis?.altitude ?? 0).toBeGreaterThan(390_000)
    expect(apoapsis?.altitude ?? Number.POSITIVE_INFINITY).toBeLessThan(
      410_000,
    )
  })

  it('keeps default integration for distant bound coast predictions', () => {
    const state = createEarthMoonSimulationState()
    const target = getEarthTarget(state)
    const predictionConfig = createPredictionConfig(2, 8)
    state.spacecraft.position = {
      x: target.position.x + target.radius * 4,
      y: target.position.y,
    }

    expect(
      getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
        state,
        target,
        predictionConfig,
        true,
      ),
    ).toBe(8)
  })

  it('does not report false Earth impacts for long default Earth-Moon predictions', () => {
    for (const hours of [24, 48, 96]) {
      const state = createEarthMoonSimulationState()
      const target = getEarthTarget(state)
      const prediction = predictCoastTrajectory(
        state,
        semiImplicitEuler,
        target,
        createPredictionConfig(hours, 8),
        getCaptureMetricsForState(state, target).specificEnergy < 0,
      )

      expect(prediction.impact, `${hours}h prediction impact`).toBeNull()
      expect(
        prediction.closestApproach?.altitude ?? Number.NEGATIVE_INFINITY,
        `${hours}h prediction closest altitude`,
      ).toBeGreaterThan(300_000)
    }
  })

  it('keeps close Earth flyby prediction near a finer integration baseline', () => {
    const hours = 96
    const state = createCloseEarthFlybyState()
    const target = getEarthTarget(state)
    const prediction = predictCoastTrajectory(
      state,
      semiImplicitEuler,
      target,
      createPredictionConfig(hours, 8),
      false,
    )
    const baseline = predictCoastTrajectory(
      state,
      semiImplicitEuler,
      target,
      createPredictionConfig(hours, 1),
      false,
    )

    expect(prediction.impact).toBeNull()
    expect(baseline.impact).toBeNull()
    const predictionEnd = prediction.absoluteEndPoint
    const baselineEnd = baseline.absoluteEndPoint
    expect(predictionEnd).not.toBeNull()
    expect(baselineEnd).not.toBeNull()

    if (!predictionEnd || !baselineEnd) {
      throw new Error('Expected both predictions to include final points.')
    }

    const finalPositionError = length(sub(predictionEnd, baselineEnd))
    const closestApproachError = Math.abs(
      (prediction.closestApproach?.altitude ?? 0) -
        (baseline.closestApproach?.altitude ?? 0),
    )

    expect(finalPositionError).toBeLessThan(750_000)
    expect(closestApproachError).toBeLessThan(5_000)
  })

  it('reports Pe only after the sampled horizon includes the closest point', () => {
    const shortPrediction = predictSampledPath({
      allowLoopTrim: true,
      distances: [12, 9, 6, 2, 4],
      horizonSeconds: 3,
    })
    const extendedPrediction = predictSampledPath({
      allowLoopTrim: true,
      distances: [12, 9, 6, 2, 4],
      horizonSeconds: 4,
      targetRadius: 1,
    })

    expect(shortPrediction.eventMarkers).not.toContainEqual(
      expect.objectContaining({ kind: 'periapsis' }),
    )
    expect(extendedPrediction.eventMarkers).toContainEqual({
      altitude: 1,
      distance: 2,
      kind: 'periapsis',
      point: { x: 2, y: 0 },
      time: 3,
    })
  })

  it('reports Ap only for bound non-impacting sampled paths', () => {
    const boundPrediction = predictSampledPath({
      allowLoopTrim: true,
      distances: [4, 8, 12, 9, 6],
      horizonSeconds: 4,
    })
    const unboundPrediction = predictSampledPath({
      allowLoopTrim: false,
      distances: [4, 8, 12, 9, 6],
      horizonSeconds: 4,
    })
    const impactPrediction = predictSampledPath({
      allowLoopTrim: true,
      distances: [4, 8, 12, 9, 0.5],
      horizonSeconds: 4,
      targetRadius: 1,
    })

    expect(boundPrediction.eventMarkers).toContainEqual({
      altitude: 12,
      distance: 12,
      kind: 'apoapsis',
      point: { x: 12, y: 0 },
      time: 2,
    })
    expect(unboundPrediction.eventMarkers).not.toContainEqual(
      expect.objectContaining({ kind: 'apoapsis' }),
    )
    expect(impactPrediction.eventMarkers).not.toContainEqual(
      expect.objectContaining({ kind: 'apoapsis' }),
    )
  })
})

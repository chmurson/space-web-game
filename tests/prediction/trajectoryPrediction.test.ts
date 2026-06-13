import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import {
  getTrajectoryPredictionConfig,
  predictCoastTrajectory,
  type TrajectoryPredictionConfig,
  type TrajectoryPredictionSamplingConfig,
} from '@/prediction/trajectoryPrediction'
import { EARTH_MASS, EARTH_RADIUS } from '@/simulation/constants'
import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
import { createEarthMoonScenario } from '@/simulation/scenarios/earthMoon'
import { idleControls } from '@/simulation/state'
import type { Body, SimulationState, Spacecraft } from '@/simulation/types'
import { length, sub } from '@/simulation/vector'

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

const getEarthTarget = (state: SimulationState): Body => {
  const earth = state.bodies.find((body) => body.id === 'earth')

  if (!earth) {
    throw new Error('Expected test state to include Earth.')
  }

  return earth
}

describe('predictCoastTrajectory', () => {
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
})

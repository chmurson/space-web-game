import { bench, describe } from 'vitest'

import {
  createFarTrajectoryPredictionStateSnapshot,
  createFarTrajectoryPredictor,
  type FarTrajectoryPredictionRequestPayload,
  predictFarTrajectory,
} from '@/prediction/farTrajectoryPrediction'
import { sampleKeplerTwoBodyTrajectory } from '@/prediction/keplerTwoBody'
import {
  computeCoastTrajectoryPrediction,
  getTrajectoryPredictionConfig,
  type TrajectoryPredictionConfig,
  type TrajectoryPredictionSamplingConfig,
} from '@/prediction/trajectoryPrediction'
import { semiImplicitEuler } from '@/simulation/physics/semiImplicitEuler'
import { createEarthMoonScenario } from '@/simulation/scenarios/earthMoon'
import { idleControls } from '@/simulation/state'
import type { Body, SimulationState } from '@/simulation/types'

const productionSampling: TrajectoryPredictionSamplingConfig = {
  maxIntegrationStepSeconds: 8,
  refreshInterval: 0.4,
  targetMaxSteps: 1_200,
  stepOptionsSeconds: [
    30, 45, 60, 90, 120, 180, 300, 450, 600, 900, 1_200, 1_800,
  ],
}

const createEarthMoonState = (): SimulationState => {
  const scenario = createEarthMoonScenario()

  return {
    bodies: scenario.bodies,
    controls: idleControls(),
    elapsed: 0,
    spacecraft: scenario.spacecraft,
  }
}

const createEarthOnlyState = (): SimulationState => {
  const state = createEarthMoonState()
  return {
    ...state,
    bodies: state.bodies.filter((body) => body.id === 'earth'),
  }
}

const createPredictionConfig = (horizonSeconds: number) =>
  getTrajectoryPredictionConfig(horizonSeconds, productionSampling, 2.5)

const createLongPredictionConfig = (
  horizonSeconds: number,
): TrajectoryPredictionConfig => ({
  ...createPredictionConfig(horizonSeconds),
  maxIntegrationStepSeconds: 100,
  stepSeconds: 100,
})

const earthMoonTarget = (state: SimulationState): Body => {
  const earth = state.bodies.find((body) => body.id === 'earth')
  if (!earth) {
    throw new Error('Earth-Moon benchmark state has no Earth target')
  }
  return earth
}

const earthTarget = (state: SimulationState): Body => {
  const earth = state.bodies.find((body) => body.id === 'earth')
  if (!earth) {
    throw new Error('Earth-only benchmark state has no Earth target')
  }
  return earth
}

const benchmarkEarthOnlyNumerical = (horizonSeconds: number) => {
  const state = createEarthOnlyState()
  computeCoastTrajectoryPrediction(
    state,
    semiImplicitEuler,
    earthTarget(state),
    createPredictionConfig(horizonSeconds),
    false,
  )
}

const benchmarkEarthOnlyKepler = (horizonSeconds: number) => {
  const state = createEarthOnlyState()
  const config = createPredictionConfig(horizonSeconds)
  sampleKeplerTwoBodyTrajectory(
    earthTarget(state),
    state.spacecraft,
    horizonSeconds,
    config.stepSeconds,
  )
}

const createFarRequest = (
  state: SimulationState,
  predictionConfig: TrajectoryPredictionConfig,
  inputKey: string,
): FarTrajectoryPredictionRequestPayload => ({
  assistMode: 'off',
  autopilotRotationRate: 0.9,
  inputKey,
  jobId: Number(inputKey.replace('benchmark-', '')) || 1,
  predictionConfig,
  semanticInputKey: 'benchmark-coast',
  state: createFarTrajectoryPredictionStateSnapshot(state),
  targetId: 'earth',
})

describe('trajectory prediction baseline', () => {
  bench('Earth-Moon coast: 2-hour horizon', () => {
    const state = createEarthMoonState()
    computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      earthMoonTarget(state),
      createPredictionConfig(2 * 60 * 60),
      false,
    )
  })

  bench('Earth-only numerical coast: 2-hour horizon', () =>
    benchmarkEarthOnlyNumerical(2 * 60 * 60),
  )
  bench('Earth-only Kepler sampled coast: 2-hour horizon', () =>
    benchmarkEarthOnlyKepler(2 * 60 * 60),
  )
  bench('Earth-only numerical coast: 24-hour horizon', () =>
    benchmarkEarthOnlyNumerical(24 * 60 * 60),
  )
  bench('Earth-only Kepler sampled coast: 24-hour horizon', () =>
    benchmarkEarthOnlyKepler(24 * 60 * 60),
  )
  bench('Earth-only numerical coast: 2-day horizon', () =>
    benchmarkEarthOnlyNumerical(2 * 24 * 60 * 60),
  )
  bench('Earth-only Kepler sampled coast: 2-day horizon', () =>
    benchmarkEarthOnlyKepler(2 * 24 * 60 * 60),
  )
  bench('Earth-only numerical coast: 16-day horizon', () =>
    benchmarkEarthOnlyNumerical(16 * 24 * 60 * 60),
  )
  bench('Earth-only Kepler sampled coast: 16-day horizon', () =>
    benchmarkEarthOnlyKepler(16 * 24 * 60 * 60),
  )

  bench('Earth-Moon coast: 24-hour horizon', () => {
    const state = createEarthMoonState()
    computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      earthMoonTarget(state),
      createPredictionConfig(24 * 60 * 60),
      false,
    )
  })

  bench('Earth-Moon coast: 2-day horizon', () => {
    const state = createEarthMoonState()
    computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      earthMoonTarget(state),
      createPredictionConfig(2 * 24 * 60 * 60),
      false,
    )
  })

  bench('Earth-Moon coast: 16-day horizon', () => {
    const state = createEarthMoonState()
    computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      earthMoonTarget(state),
      createPredictionConfig(16 * 24 * 60 * 60),
      false,
    )
  })

  bench('far prediction: full 10,000-second horizon', () => {
    const state = createEarthMoonState()
    predictFarTrajectory(
      createFarRequest(
        state,
        createLongPredictionConfig(10_000),
        'benchmark-1',
      ),
    )
  })

  let reusePrediction: (() => void) | null = null
  bench(
    'far prediction: reuse after 2,000 simulated seconds',
    () => {
      reusePrediction?.()
    },
    {
      setup: () => {
        const initialState = createEarthMoonState()
        const liveState = semiImplicitEuler.step(initialState, 2_000)
        const config = createLongPredictionConfig(10_000)
        const predictor = createFarTrajectoryPredictor()

        predictor(createFarRequest(initialState, config, 'benchmark-1'))
        const liveRequest = createFarRequest(liveState, config, 'benchmark-2')
        reusePrediction = () => {
          predictor(liveRequest)
        }
      },
    },
  )
})

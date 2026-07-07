import {
  type AssistMode,
  getAssistPredictionControlsForState,
  getCaptureMetricsForState,
} from '../assist/orbitalAssist'
import { semiImplicitEuler } from '../simulation/physics/semiImplicitEuler'
import type {
  Body,
  ControlInput,
  SimulationState,
  Spacecraft,
} from '../simulation/types'
import type {
  TrajectoryPredictionConfig,
  TrajectoryPredictionResult,
} from './trajectoryPrediction'
import {
  predictAssistedTrajectory,
  predictCoastTrajectory,
} from './trajectoryPrediction'

export type FarTrajectoryPredictionBodySnapshot = Omit<Body, 'color'>

export type FarTrajectoryPredictionStateSnapshot = {
  bodies: FarTrajectoryPredictionBodySnapshot[]
  controls: ControlInput
  elapsed: number
  spacecraft: Spacecraft
}

export type FarTrajectoryPredictionRequestPayload = {
  assistMode: AssistMode
  autopilotRotationRate: number
  inputKey: string
  jobId: number
  predictionConfig: TrajectoryPredictionConfig
  semanticInputKey: string
  state: FarTrajectoryPredictionStateSnapshot
  targetId: string
}

export type FarTrajectoryPredictionResultPayload = {
  assistedPoints: Array<{ x: number; y: number }>
  calculationMs: number
  coastPrediction: TrajectoryPredictionResult
  inputKey: string
  jobId: number
  semanticInputKey: string
  targetId: string
}

const nowMs = () => performance.now()

const cloneBodySnapshot = (body: Body): FarTrajectoryPredictionBodySnapshot => {
  const { color: _color, ...snapshot } = body

  return {
    ...snapshot,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }
}

export const createFarTrajectoryPredictionStateSnapshot = (
  state: SimulationState,
): FarTrajectoryPredictionStateSnapshot => ({
  bodies: state.bodies.map(cloneBodySnapshot),
  controls: { ...state.controls },
  elapsed: state.elapsed,
  spacecraft: {
    ...state.spacecraft,
    position: { ...state.spacecraft.position },
    velocity: { ...state.spacecraft.velocity },
  },
})

const toBody = (body: FarTrajectoryPredictionBodySnapshot): Body => ({
  ...body,
  color: '',
  position: { ...body.position },
  velocity: { ...body.velocity },
})

const toSimulationState = (
  snapshot: FarTrajectoryPredictionStateSnapshot,
): SimulationState => ({
  bodies: snapshot.bodies.map(toBody),
  controls: { ...snapshot.controls },
  elapsed: snapshot.elapsed,
  spacecraft: {
    ...snapshot.spacecraft,
    position: { ...snapshot.spacecraft.position },
    velocity: { ...snapshot.spacecraft.velocity },
  },
})

export const predictFarTrajectory = (
  payload: FarTrajectoryPredictionRequestPayload,
): FarTrajectoryPredictionResultPayload => {
  const calculationStartMs = nowMs()
  const state = toSimulationState(payload.state)
  const target = state.bodies.find((body) => body.id === payload.targetId)

  if (!target) {
    throw new Error(`Missing prediction target: ${payload.targetId}`)
  }

  const allowLoopTrim =
    getCaptureMetricsForState(state, target).specificEnergy < 0
  const coastPrediction = predictCoastTrajectory(
    state,
    semiImplicitEuler,
    target,
    payload.predictionConfig,
    allowLoopTrim,
  )
  const assistedPoints =
    payload.assistMode === 'off'
      ? []
      : predictAssistedTrajectory(
          state,
          semiImplicitEuler,
          target.id,
          payload.predictionConfig,
          (simulationState, targetId) =>
            getAssistPredictionControlsForState(
              simulationState,
              targetId,
              payload.assistMode,
              payload.autopilotRotationRate,
            ),
        ).relativePoints

  return {
    assistedPoints,
    calculationMs: nowMs() - calculationStartMs,
    coastPrediction,
    inputKey: payload.inputKey,
    jobId: payload.jobId,
    semanticInputKey: payload.semanticInputKey,
    targetId: target.id,
  }
}

import { cloneSimulationState } from "../simulation/state";
import type { Body, ControlInput, PhysicsEngine, SimulationState } from "../simulation/types";
import { length, sub, type Vec2 } from "../simulation/vector";

export type TrajectoryPredictionConfig = {
  horizonSeconds: number;
  maxLoopRevolutions: number;
  refreshInterval: number;
  stepSeconds: number;
};

export type TrajectoryPredictionSamplingConfig = {
  refreshInterval: number;
  stepOptionsSeconds: number[];
  targetMaxSteps: number;
};

export type PredictedImpact = {
  bodyName: string;
  time: number;
};

export type PredictedClosestApproach = {
  altitude: number;
  bodyName: string;
  time: number;
};

export type TrajectoryPredictionResult = {
  absoluteEndPoint: Vec2 | null;
  absolutePoints: Vec2[];
  closestApproach: PredictedClosestApproach | null;
  impact: PredictedImpact | null;
  relativePoints: Vec2[];
};

export type AssistedTrajectoryPredictionResult = {
  relativePoints: Vec2[];
};

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export const getTrajectoryPredictionStepSeconds = (horizonSeconds: number, sampling: TrajectoryPredictionSamplingConfig) => {
  const targetStepSeconds = horizonSeconds / sampling.targetMaxSteps;
  return sampling.stepOptionsSeconds.find((stepSeconds) => stepSeconds >= targetStepSeconds) ?? sampling.stepOptionsSeconds.at(-1) ?? 1800;
};

export const getTrajectoryPredictionConfig = (
  horizonSeconds: number,
  sampling: TrajectoryPredictionSamplingConfig,
  maxLoopRevolutions: number,
): TrajectoryPredictionConfig => ({
  horizonSeconds,
  maxLoopRevolutions,
  refreshInterval: sampling.refreshInterval,
  stepSeconds: getTrajectoryPredictionStepSeconds(horizonSeconds, sampling),
});

const getTargetRelativePosition = (simulationState: SimulationState, targetId: string, spacecraftPosition: Vec2) => {
  const predictedTarget = simulationState.bodies.find((body) => body.id === targetId);

  if (!predictedTarget) {
    return { ...spacecraftPosition };
  }

  return sub(spacecraftPosition, predictedTarget.position);
};

export const predictCoastTrajectory = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
): TrajectoryPredictionResult => {
  let predictedState = cloneSimulationState(state);
  const absolutePoints: Vec2[] = [{ ...state.spacecraft.position }];
  const relativePoints: Vec2[] = [];
  const maxSteps = predictionConfig.horizonSeconds / predictionConfig.stepSeconds;
  const maxLoopAngularTravel = predictionConfig.maxLoopRevolutions * Math.PI * 2;
  let closestApproach: PredictedClosestApproach | null = null;
  let impact: PredictedImpact | null = null;
  let previousPredictionAngle = Math.atan2(state.spacecraft.position.y - target.position.y, state.spacecraft.position.x - target.position.x);
  let predictionAngularTravel = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    predictedState = physicsEngine.step(predictedState, predictionConfig.stepSeconds);
    const { spacecraft } = predictedState;
    const predictionTime = (step + 1) * predictionConfig.stepSeconds;
    const relativePoint = getTargetRelativePosition(predictedState, target.id, spacecraft.position);
    const predictionAngle = Math.atan2(relativePoint.y, relativePoint.x);
    predictionAngularTravel += Math.abs(normalizeAngle(predictionAngle - previousPredictionAngle));
    previousPredictionAngle = predictionAngle;
    absolutePoints.push({ ...spacecraft.position });
    relativePoints.push(relativePoint);

    const predictedTarget = predictedState.bodies.find((body) => body.id === target.id);
    if (predictedTarget) {
      const altitude = length(sub(spacecraft.position, predictedTarget.position)) - predictedTarget.radius;

      if (!closestApproach || altitude < closestApproach.altitude) {
        closestApproach = {
          altitude,
          bodyName: predictedTarget.name,
          time: predictionTime,
        };
      }
    }

    const hitBody = predictedState.bodies.find((body) => length(sub(spacecraft.position, body.position)) <= body.radius);
    if (hitBody) {
      impact = {
        bodyName: hitBody.name,
        time: predictionTime,
      };
      break;
    }

    if (allowLoopTrim && predictionAngularTravel >= maxLoopAngularTravel) {
      break;
    }
  }

  return {
    absoluteEndPoint: relativePoints.length > 0 ? { ...predictedState.spacecraft.position } : null,
    absolutePoints,
    closestApproach,
    impact,
    relativePoints,
  };
};

export const predictAssistedTrajectory = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  targetId: string,
  predictionConfig: TrajectoryPredictionConfig,
  getControls: (simulationState: SimulationState, targetId: string) => ControlInput,
): AssistedTrajectoryPredictionResult => {
  let assistedState = cloneSimulationState(state);
  const relativePoints: Vec2[] = [];
  const maxSteps = predictionConfig.horizonSeconds / predictionConfig.stepSeconds;

  for (let step = 0; step < maxSteps; step += 1) {
    assistedState = {
      ...assistedState,
      controls: getControls(assistedState, targetId),
    };
    assistedState = physicsEngine.step(assistedState, predictionConfig.stepSeconds);
    relativePoints.push(getTargetRelativePosition(assistedState, targetId, assistedState.spacecraft.position));

    const hitBody = assistedState.bodies.find((body) => length(sub(assistedState.spacecraft.position, body.position)) <= body.radius);
    if (hitBody) {
      break;
    }
  }

  return { relativePoints };
};

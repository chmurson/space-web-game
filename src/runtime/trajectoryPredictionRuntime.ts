import type { AssistMode, CaptureMetrics } from "../assist/orbitalAssist";
import {
  predictAssistedTrajectory,
  predictCoastTrajectory,
  type PredictedClosestApproach,
  type PredictedImpact,
  type TrajectoryPredictionConfig,
} from "../prediction/trajectoryPrediction";
import { updateInertialPredictionVisual } from "../render/sceneUpdates";
import type { GameSceneRefs } from "../scene/createGameScene";
import type { Body, ControlInput, PhysicsEngine, SimulationState } from "../simulation/types";
import type { Vec2 } from "../simulation/vector";

export type TrajectoryPredictionState = {
  predictedImpact: PredictedImpact | null;
  predictedTargetClosestApproach: PredictedClosestApproach | null;
  targetRelativeAssistedPoints: Vec2[];
  targetRelativePredictionEnd: Vec2 | null;
  targetRelativePredictionPoints: Vec2[];
};

export type RefreshTrajectoryPredictionOptions = {
  assistMode: AssistMode;
  coastPredictionHorizonSeconds: number;
  debugModeEnabled: boolean;
  debugNoGravityEnabled: boolean;
  gameScene: GameSceneRefs;
  getAssistPredictionControls(simulationState: SimulationState, targetId: string): ControlInput;
  getAssistTarget(): Body;
  getCaptureMetrics(target: Body): CaptureMetrics;
  physicsEngine: PhysicsEngine;
  predictionConfig: TrajectoryPredictionConfig;
  state: SimulationState;
};

const emptyTrajectoryPredictionState = (): TrajectoryPredictionState => ({
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  targetRelativeAssistedPoints: [],
  targetRelativePredictionEnd: null,
  targetRelativePredictionPoints: [],
});

export const createTrajectoryPredictionRuntime = () => {
  let predictionRefreshElapsed = 0;
  let predictionState = emptyTrajectoryPredictionState();

  const refresh = (options: RefreshTrajectoryPredictionOptions) => {
    const target = options.getAssistTarget();
    const predictionConfig = options.predictionConfig;
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0;
    const coastPrediction = predictCoastTrajectory(options.state, options.physicsEngine, target, predictionConfig, allowLoopTrim);
    const targetRelativePredictionPoints = coastPrediction.relativePoints;

    predictionState = {
      predictedImpact: coastPrediction.impact,
      predictedTargetClosestApproach: coastPrediction.closestApproach,
      targetRelativeAssistedPoints:
        options.assistMode === "off"
          ? []
          : predictAssistedTrajectory(
              options.state,
              options.physicsEngine,
              target.id,
              predictionConfig,
              options.getAssistPredictionControls,
            ).relativePoints,
      targetRelativePredictionEnd: targetRelativePredictionPoints.at(-1) ?? null,
      targetRelativePredictionPoints,
    };

    updateInertialPredictionVisual({
      enabled: options.debugModeEnabled && options.debugNoGravityEnabled,
      gameScene: options.gameScene,
      predictionSeconds: Math.min(options.coastPredictionHorizonSeconds * 0.3, 90 * 60),
      spacecraftPosition: options.state.spacecraft.position,
      spacecraftVelocity: options.state.spacecraft.velocity,
    });
    predictionRefreshElapsed = 0;
  };

  return {
    getState: () => predictionState,
    maybeRefresh: (realDt: number, options: RefreshTrajectoryPredictionOptions) => {
      predictionRefreshElapsed += realDt;
      if (predictionRefreshElapsed >= options.predictionConfig.refreshInterval) {
        refresh(options);
      }
    },
    refresh,
  };
};

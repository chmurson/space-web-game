import { getAssistTargetDecisionForState, type AssistTargetDebugInfo } from "../assist/assistTarget";
import {
  getAssistPredictionControlsForState,
  getAutopilotTurnForHeading,
  getCaptureMetricsForState,
  getCircularizePlanForState,
  shouldCaptureBurnForMetrics,
  type CaptureMetrics,
  type CircularizePlan,
} from "../assist/orbitalAssist";
import { getTrajectoryPredictionConfig, type TrajectoryPredictionConfig, type TrajectoryPredictionSamplingConfig } from "../prediction/trajectoryPrediction";
import type { Body, ControlInput, SimulationState } from "../simulation/types";
import type { Vec2 } from "../simulation/vector";
import type { AppRuntimeState } from "./appRuntimeState";

export type AutoAssistTargetConfig = {
  switchRangeMultiplier: number;
};

export type GameQueries = {
  getAssistTargetDebug(): AssistTargetDebugInfo | null;
  getAssistPredictionControls(simulationState: SimulationState, targetId: string): ControlInput;
  getAssistTarget(): Body;
  getAutopilotTurn(desiredHeading: number): number;
  getCaptureMetrics(target: Body): CaptureMetrics;
  getCircularizePlan(target: Body): CircularizePlan;
  getCoastPredictionHorizonSeconds(): number;
  getPredictionConfig(): TrajectoryPredictionConfig;
  shouldCaptureBurn(target: Body): boolean;
};

export const createGameQueries = (options: {
  autoSelectNearestSurface: boolean;
  autoSelectConfig: AutoAssistTargetConfig;
  autopilotRotationRate: number;
  getPredictedTrajectoryEnd(): Vec2 | null;
  getPredictedTrajectoryPoints(): Vec2[];
  maxPredictionLoopRevolutions: number;
  predictionSampling: TrajectoryPredictionSamplingConfig;
  runtime: AppRuntimeState;
}): GameQueries => {
  let currentAutoTargetId: string | null = null;
  let lastAssistTargetDebug: AssistTargetDebugInfo | null = null;

  const getAssistTarget = () => {
    const forcedTargetId = options.runtime.scenarioDirectives.forcedAssistTargetId;
    if (forcedTargetId) {
      const forcedTarget = options.runtime.state.bodies.find((body) => body.id === forcedTargetId);
      if (forcedTarget) {
        return forcedTarget;
      }
    }

    const decision = getAssistTargetDecisionForState(options.runtime.state, {
      autoSelectNearestSurface: options.autoSelectNearestSurface,
      autoSelectConfig: options.autoSelectConfig,
      currentAutoTargetId,
      predictedTrajectoryPoints: options.getPredictedTrajectoryPoints(),
      predictedTrajectoryEnd: options.getPredictedTrajectoryEnd(),
      selectedIndex: options.runtime.assistTargetIndex,
    });
    const target = decision.target;
    lastAssistTargetDebug = decision.debug;

    if (options.autoSelectNearestSurface) {
      currentAutoTargetId = target.id;
    }

    return target;
  };

  const getCaptureMetrics = (target: Body) => getCaptureMetricsForState(options.runtime.state, target);

  return {
    getAssistTargetDebug: () => lastAssistTargetDebug,
    getAssistPredictionControls: (simulationState, targetId) =>
      getAssistPredictionControlsForState(simulationState, targetId, options.runtime.assistMode, options.autopilotRotationRate),
    getAssistTarget,
    getAutopilotTurn: (desiredHeading) => getAutopilotTurnForHeading(options.runtime.state.spacecraft.heading, desiredHeading, options.autopilotRotationRate),
    getCaptureMetrics,
    getCircularizePlan: (target) => getCircularizePlanForState(options.runtime.state, target),
    getCoastPredictionHorizonSeconds: () => options.runtime.coastPredictionHorizonHours * 60 * 60,
    getPredictionConfig: () =>
      getTrajectoryPredictionConfig(
        options.runtime.coastPredictionHorizonHours * 60 * 60,
        options.predictionSampling,
        options.maxPredictionLoopRevolutions,
      ),
    shouldCaptureBurn: (target) => shouldCaptureBurnForMetrics(getCaptureMetrics(target)),
  };
};

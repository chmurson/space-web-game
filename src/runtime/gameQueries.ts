import { getAssistTargetForState } from "../assist/assistTarget";
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
import type { AppRuntimeState } from "./appRuntimeState";

export type GameQueries = {
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
  autoDiscoverStrongestInfluence: boolean;
  autopilotRotationRate: number;
  maxPredictionLoopRevolutions: number;
  predictionSampling: TrajectoryPredictionSamplingConfig;
  runtime: AppRuntimeState;
}): GameQueries => {
  const getAssistTarget = () =>
    getAssistTargetForState(options.runtime.state, {
      autoDiscoverStrongestInfluence: options.autoDiscoverStrongestInfluence,
      selectedIndex: options.runtime.assistTargetIndex,
    });

  const getCaptureMetrics = (target: Body) => getCaptureMetricsForState(options.runtime.state, target);

  return {
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

import type { Body, SimulationState } from "../simulation/types";
import { add, length, scale, sub, vec, type Vec2 } from "../simulation/vector";

export type AutoAssistTargetConfig = {
  switchRangeMultiplier: number;
};

export type AssistTargetSelection = {
  autoSelectNearestSurface: boolean;
  autoSelectConfig: AutoAssistTargetConfig;
  currentAutoTargetId: string | null;
  predictedTrajectoryPoints: Vec2[];
  predictedTrajectoryEnd: Vec2 | null;
  selectedIndex: number;
};

type AssistTargetMetric = {
  body: Body;
  midpointDistance: number;
};

export type AssistTargetDebugBody = {
  bodyId: string;
  bodyName: string;
  candidateRatioToCurrent: number | null;
  isBestCandidate: boolean;
  isCurrentAutoTarget: boolean;
  meetsSwitchThreshold: boolean | null;
  midpointDistance: number;
};

export type AssistTargetDebugInfo = {
  autoSelectNearestSurface: boolean;
  bodies: AssistTargetDebugBody[];
  currentAutoTargetId: string | null;
  selectedBodyId: string;
  selectionMode: "manual" | "trajectoryMidpoint";
  switchFactor: number | null;
  switchTargetBodyId: string | null;
  switchTargetBodyName: string | null;
  trajectoryCenter: Vec2 | null;
  trajectoryEnd: Vec2 | null;
};

type AssistTargetDecision = {
  debug: AssistTargetDebugInfo;
  target: Body;
};

const getTrajectoryCenter = (simulationState: SimulationState, predictedTrajectoryEnd: Vec2 | null): Vec2 | null =>
  predictedTrajectoryEnd ? scale(add(simulationState.spacecraft.position, predictedTrajectoryEnd), 0.5) : null;

const getTrajectorySegmentWeightedCenter = (predictedTrajectoryPoints: Vec2[]): Vec2 | null => {
  if (predictedTrajectoryPoints.length < 2) {
    return null;
  }

  let weightedMidpointSum = vec();
  let totalSegmentLength = 0;

  for (let index = 0; index < predictedTrajectoryPoints.length - 1; index += 1) {
    const start = predictedTrajectoryPoints[index];
    const end = predictedTrajectoryPoints[index + 1];
    const segment = sub(end, start);
    const segmentLength = length(segment);

    if (segmentLength === 0) {
      continue;
    }

    const segmentMidpoint = scale(add(start, end), 0.5);
    weightedMidpointSum = add(weightedMidpointSum, scale(segmentMidpoint, segmentLength));
    totalSegmentLength += segmentLength;
  }

  return totalSegmentLength > 0 ? scale(weightedMidpointSum, 1 / totalSegmentLength) : null;
};

const getNearestSurfaceDecision = (
  simulationState: SimulationState,
  currentAutoTargetId: string | null,
  autoSelectConfig: AutoAssistTargetConfig,
  predictedTrajectoryPoints: Vec2[],
  predictedTrajectoryEnd: Vec2 | null,
): AssistTargetDecision => {
  const trajectoryCenter = getTrajectorySegmentWeightedCenter(predictedTrajectoryPoints) ?? getTrajectoryCenter(simulationState, predictedTrajectoryEnd);
  const referencePoint = trajectoryCenter ?? simulationState.spacecraft.position;
  const metrics = simulationState.bodies
    .map<AssistTargetMetric>((body) => ({
      body,
      midpointDistance: length(sub(body.position, referencePoint)),
    }))
    .sort((a, b) => a.midpointDistance - b.midpointDistance);

  const bestMetric = metrics[0];

  if (!bestMetric) {
    throw new Error("Cannot auto-select an assist target without bodies.");
  }

  const currentMetric = metrics.find(({ body }) => body.id === currentAutoTargetId);

  let target = bestMetric.body;

  if (currentMetric && currentMetric.body.id !== bestMetric.body.id) {
    target = bestMetric.midpointDistance * autoSelectConfig.switchRangeMultiplier < currentMetric.midpointDistance

      ? bestMetric.body
      : currentMetric.body;
  }

  const currentSwitchThreshold =
    currentMetric && currentMetric.body.id !== bestMetric.body.id
      ? currentMetric.midpointDistance / autoSelectConfig.switchRangeMultiplier
      : null;

  return {
    debug: {
      autoSelectNearestSurface: true,
      bodies: metrics.map((metric, index) => ({
        bodyId: metric.body.id,
        bodyName: metric.body.name,
        candidateRatioToCurrent:
          currentMetric && metric.body.id !== currentMetric.body.id ? metric.midpointDistance / currentMetric.midpointDistance : null,
        isBestCandidate: index === 0,
        isCurrentAutoTarget: metric.body.id === currentMetric?.body.id,
        meetsSwitchThreshold:
          currentSwitchThreshold !== null && metric.body.id !== currentMetric?.body.id
            ? metric.midpointDistance < currentSwitchThreshold
            : null,
        midpointDistance: metric.midpointDistance,
      })),
      currentAutoTargetId,
      selectedBodyId: target.id,
      selectionMode: "trajectoryMidpoint",
      switchFactor: autoSelectConfig.switchRangeMultiplier,
      switchTargetBodyId: bestMetric.body.id,
      switchTargetBodyName: bestMetric.body.name,
      trajectoryCenter,
      trajectoryEnd: predictedTrajectoryEnd,
    },
    target,
  };
};

const getManualTargetDecision = (simulationState: SimulationState, selectedIndex: number): AssistTargetDecision => {
  const normalizedIndex = ((selectedIndex % simulationState.bodies.length) + simulationState.bodies.length) % simulationState.bodies.length;
  const target = simulationState.bodies[normalizedIndex] ?? simulationState.bodies[0];

  return {
    debug: {
      autoSelectNearestSurface: false,
      bodies: simulationState.bodies.map((body, index) => ({
        bodyId: body.id,
        bodyName: body.name,
        candidateRatioToCurrent: null,
        isBestCandidate: index === normalizedIndex,
        isCurrentAutoTarget: index === normalizedIndex,
        meetsSwitchThreshold: null,
        midpointDistance: length(sub(body.position, simulationState.spacecraft.position)),
      })),
      currentAutoTargetId: null,
      selectedBodyId: target.id,
      selectionMode: "manual",
      switchFactor: null,
      switchTargetBodyId: null,
      switchTargetBodyName: null,
      trajectoryCenter: null,
      trajectoryEnd: null,
    },
    target,
  };
};

export const getAssistTargetDecisionForState = (simulationState: SimulationState, selection: AssistTargetSelection): AssistTargetDecision => {
  if (simulationState.bodies.length === 0) {
    throw new Error("Cannot select an assist target without bodies.");
  }

  if (selection.autoSelectNearestSurface) {
    return getNearestSurfaceDecision(
      simulationState,
      selection.currentAutoTargetId,
      selection.autoSelectConfig,
      selection.predictedTrajectoryPoints,
      selection.predictedTrajectoryEnd,
    );
  }

  return getManualTargetDecision(simulationState, selection.selectedIndex);
};

export const getAssistTargetForState = (simulationState: SimulationState, selection: AssistTargetSelection): Body =>
  getAssistTargetDecisionForState(simulationState, selection).target;

import { G } from "../simulation/constants";
import { idleControls } from "../simulation/state";
import type { Body, ControlInput, SimulationState } from "../simulation/types";
import { length, normalize, scale, sub } from "../simulation/vector";

export type AssistMode = "off" | "capture" | "circularize";

export type CaptureMetrics = {
  circularSpeed: number;
  distance: number;
  insideRange: boolean;
  relativeSpeed: number;
  roughAssistRange: number;
  surfaceDistance: number;
  specificEnergy: number;
};

export type CircularizePlan = {
  burnHeading: number;
  deltaV: number;
  desiredVelocityHeading: number;
  distance: number;
  radialSpeed: number;
  tangentialSpeed: number;
};

const autopilotHeadingDeadZone = 0.015;
const captureBurnSpeedRatio = 1.05;
const circularizeBurnDeltaVThreshold = 15;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export const getAutopilotTurnForHeading = (currentHeading: number, desiredHeading: number, autopilotRotationRate: number) => {
  const error = normalizeAngle(desiredHeading - currentHeading);

  if (Math.abs(error) < autopilotHeadingDeadZone) {
    return 0;
  }

  return clamp(error / autopilotRotationRate, -1, 1);
};

export const getCaptureMetricsForState = (simulationState: SimulationState, target: Body): CaptureMetrics => {
  const relativePosition = sub(simulationState.spacecraft.position, target.position);
  const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
  const distance = length(relativePosition);
  const relativeSpeed = length(relativeVelocity);
  const roughAssistRange = target.radius + (target.id === "moon" ? 80_000_000 : 30_000_000);
  const circularSpeed = Math.sqrt((G * target.mass) / Math.max(distance, target.radius));

  return {
    circularSpeed,
    distance,
    insideRange: distance < roughAssistRange,
    relativeSpeed,
    roughAssistRange,
    surfaceDistance: Math.max(0, distance - target.radius),
    specificEnergy: relativeSpeed ** 2 / 2 - (G * target.mass) / Math.max(distance, target.radius),
  };
};

export const shouldCaptureBurnForMetrics = (metrics: CaptureMetrics) =>
  metrics.insideRange && metrics.relativeSpeed > metrics.circularSpeed * captureBurnSpeedRatio;

export const getCircularizePlanForState = (simulationState: SimulationState, target: Body): CircularizePlan => {
  const relativePosition = sub(simulationState.spacecraft.position, target.position);
  const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
  const distance = Math.max(length(relativePosition), target.radius);
  const radial = normalize(relativePosition);
  const tangentialDirection = relativePosition.x * relativeVelocity.y - relativePosition.y * relativeVelocity.x >= 0 ? 1 : -1;
  const tangent = {
    x: -radial.y * tangentialDirection,
    y: radial.x * tangentialDirection,
  };
  const circularSpeed = Math.sqrt((G * target.mass) / distance);
  const desiredVelocity = scale(tangent, circularSpeed);
  const correction = sub(desiredVelocity, relativeVelocity);

  return {
    burnHeading: Math.atan2(correction.y, correction.x),
    deltaV: length(correction),
    desiredVelocityHeading: Math.atan2(tangent.y, tangent.x),
    distance,
    radialSpeed: relativeVelocity.x * radial.x + relativeVelocity.y * radial.y,
    tangentialSpeed: relativeVelocity.x * tangent.x + relativeVelocity.y * tangent.y,
  };
};

export const shouldCircularizeBurn = (metrics: CaptureMetrics, plan: CircularizePlan) =>
  metrics.specificEnergy < 0 && plan.deltaV > circularizeBurnDeltaVThreshold;

export const getAssistPredictionControlsForState = (
  simulationState: SimulationState,
  targetId: string,
  assistMode: AssistMode,
  autopilotRotationRate: number,
): ControlInput => {
  const target = simulationState.bodies.find((body) => body.id === targetId);

  if (!target || assistMode === "off") {
    return idleControls();
  }

  if (assistMode === "capture") {
    const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
    const desiredHeading = Math.atan2(-relativeVelocity.y, -relativeVelocity.x);
    const metrics = getCaptureMetricsForState(simulationState, target);

    return {
      main: shouldCaptureBurnForMetrics(metrics) ? 1 : 0,
      reverse: 0,
      strafe: 0,
      turn: getAutopilotTurnForHeading(simulationState.spacecraft.heading, desiredHeading, autopilotRotationRate),
    };
  }

  const metrics = getCaptureMetricsForState(simulationState, target);
  const plan = getCircularizePlanForState(simulationState, target);

  return {
    main: shouldCircularizeBurn(metrics, plan) ? 1 : 0,
    reverse: 0,
    strafe: 0,
    turn: getAutopilotTurnForHeading(simulationState.spacecraft.heading, plan.burnHeading, autopilotRotationRate),
  };
};

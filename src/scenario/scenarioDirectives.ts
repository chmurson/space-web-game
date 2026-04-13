import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { ScenarioSessionValue } from "./scenarioSession";
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
  type ScenarioDirectiveLimits,
} from "./scenarioDirectiveTypes";
import { getRuntimeScenarioDefinition } from "./scenarioRegistry";

type DirectiveContext = {
  limits: ScenarioDirectiveLimits;
  runtime: AppRuntimeState;
};

type ScenarioDirectiveResolver = (context: DirectiveContext) => RuntimeScenarioDirectives;

const getStringValue = (value: ScenarioSessionValue, key: string): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const nestedValue = value[key];
  return typeof nestedValue === "string" ? nestedValue : null;
};

const getStringArrayValue = (value: ScenarioSessionValue, key: string): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const nestedValue = value[key];
  return Array.isArray(nestedValue) ? nestedValue.filter((entry): entry is string => typeof entry === "string") : [];
};

const getNumberValue = (value: ScenarioSessionValue, key: string): number | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const nestedValue = value[key];
  return typeof nestedValue === "number" ? nestedValue : null;
};

const genericDirectiveResolver: ScenarioDirectiveResolver = ({ runtime }) => ({
  ...createDefaultScenarioDirectives(),
  cameraFollowBodyId: getStringValue(runtime.scenarioSession.state, "cameraFollowBodyId"),
  cameraFollowOffset: {
    x: getNumberValue(runtime.scenarioSession.state, "cameraFollowOffsetX") ?? 0,
    y: getNumberValue(runtime.scenarioSession.state, "cameraFollowOffsetY") ?? 0,
  },
  forcedAssistTargetId: getStringValue(runtime.scenarioSession.state, "forcedAssistTargetId"),
  hiddenBodyIds: getStringArrayValue(runtime.scenarioSession.state, "hiddenBodyIds"),
});

export const resolveRuntimeScenarioDirectives = (runtime: AppRuntimeState, limits: ScenarioDirectiveLimits): RuntimeScenarioDirectives => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);

  if (definition?.getDirectives && (!definition.isState || definition.isState(runtime.scenarioSession.state))) {
    return definition.getDirectives(runtime.scenarioSession.state, limits);
  }

  const resolver: ScenarioDirectiveResolver = genericDirectiveResolver;
  return resolver({ limits, runtime });
};

export const getConstrainedTimeWarpIndex = (
  timeWarpIndex: number,
  timeWarps: number[],
  maxTimeWarp: number | null,
) => {
  if (maxTimeWarp === null) {
    return Math.min(Math.max(timeWarpIndex, 0), Math.max(0, timeWarps.length - 1));
  }

  const maxAllowedIndex = Math.max(
    0,
    timeWarps.reduce((bestIndex, warp, index) => (warp <= maxTimeWarp ? index : bestIndex), -1),
  );
  return Math.min(Math.max(timeWarpIndex, 0), maxAllowedIndex);
};

export const applyRuntimeScenarioDirectiveConstraints = (runtime: AppRuntimeState, limits: ScenarioDirectiveLimits) => {
  runtime.timeWarpIndex = getConstrainedTimeWarpIndex(runtime.timeWarpIndex, limits.timeWarps, runtime.scenarioDirectives.maxTimeWarp);
  runtime.viewportSize = Math.min(
    runtime.scenarioDirectives.maxViewportSize ?? limits.maxViewportSize,
    Math.max(runtime.scenarioDirectives.minViewportSize ?? limits.minViewportSize, runtime.viewportSize),
  );
  runtime.coastPredictionHorizonHours = Math.min(
    runtime.scenarioDirectives.maxCoastPredictionHorizonHours ?? limits.maxCoastPredictionHorizonHours,
    runtime.coastPredictionHorizonHours,
  );
};

export const syncRuntimeScenarioDirectives = (runtime: AppRuntimeState, limits: ScenarioDirectiveLimits) => {
  runtime.scenarioDirectives = resolveRuntimeScenarioDirectives(runtime, limits);
  applyRuntimeScenarioDirectiveConstraints(runtime, limits);
};

import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { ScenarioSessionValue } from "./scenarioSession";

export type RuntimeScenarioDirectives = {
  forcedAssistTargetId: string | null;
  hiddenBodyIds: string[];
  maxCoastPredictionHorizonHours: number | null;
  maxTimeWarp: number | null;
  maxViewportSize: number | null;
  minViewportSize: number | null;
};

export type ScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: number;
  maxViewportSize: number;
  minViewportSize: number;
  timeWarps: number[];
};

type DirectiveContext = {
  limits: ScenarioDirectiveLimits;
  runtime: AppRuntimeState;
};

type ScenarioDirectiveResolver = (context: DirectiveContext) => RuntimeScenarioDirectives;

export const createDefaultScenarioDirectives = (): RuntimeScenarioDirectives => ({
  forcedAssistTargetId: null,
  hiddenBodyIds: [],
  maxCoastPredictionHorizonHours: null,
  maxTimeWarp: null,
  maxViewportSize: null,
  minViewportSize: null,
});

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

const genericDirectiveResolver: ScenarioDirectiveResolver = ({ runtime }) => ({
  ...createDefaultScenarioDirectives(),
  forcedAssistTargetId: getStringValue(runtime.scenarioSession.state, "forcedAssistTargetId"),
  hiddenBodyIds: getStringArrayValue(runtime.scenarioSession.state, "hiddenBodyIds"),
});

const scenarioDirectiveResolvers: Record<string, ScenarioDirectiveResolver> = {
  tutorial: genericDirectiveResolver,
};

export const resolveRuntimeScenarioDirectives = (runtime: AppRuntimeState, limits: ScenarioDirectiveLimits): RuntimeScenarioDirectives => {
  const resolver = scenarioDirectiveResolvers[runtime.scenarioSession.scenarioId] ?? genericDirectiveResolver;
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

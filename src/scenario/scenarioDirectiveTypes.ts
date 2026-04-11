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
  defaultViewportSize: number;
  maxViewportSize: number;
  minViewportSize: number;
  timeWarps: number[];
};

export const createDefaultScenarioDirectives = (): RuntimeScenarioDirectives => ({
  forcedAssistTargetId: null,
  hiddenBodyIds: [],
  maxCoastPredictionHorizonHours: null,
  maxTimeWarp: null,
  maxViewportSize: null,
  minViewportSize: null,
});

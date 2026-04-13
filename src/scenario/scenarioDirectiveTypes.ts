export type RuntimeScenarioDirectives = {
  cameraFollowBodyId: string | null;
  cameraFollowOffset: { x: number; y: number };
  forcedAssistTargetId: string | null;
  hiddenBodyIds: string[];
  maxCoastPredictionHorizonHours: number | null;
  maxTimeWarp: number | null;
  maxViewportSize: number | null;
  minViewportSize: number | null;
  uiOverrides: {
    overlay: {
      topBar: {
        hideTrustPill: boolean | null;
        hideTimeWrapPill: boolean | null;
        hideScenarioInfoButton: boolean | null;
      };
    };
    gameVisuals: {
      hideTrajectory: boolean | null;
    },
  };
};

export type ScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: number;
  defaultViewportSize: number;
  maxViewportSize: number;
  minViewportSize: number;
  timeWarps: number[];
};

export const createDefaultScenarioDirectives = (): RuntimeScenarioDirectives => ({
  cameraFollowBodyId: null,
  cameraFollowOffset: { x: 0, y: 0 },
  forcedAssistTargetId: null,
  hiddenBodyIds: [],
  maxCoastPredictionHorizonHours: null,
  maxTimeWarp: null,
  maxViewportSize: null,
  minViewportSize: null,
  uiOverrides: {
    overlay: {
      topBar: {
        hideTrustPill: null,
        hideTimeWrapPill: null,
        hideScenarioInfoButton: null,
      },
    },
    gameVisuals: {
      hideTrajectory: null,
    },
  },
});

import { getBodyInfluences } from "../simulation/bodyInfluence";
import { length, sub } from "../simulation/vector";
import type { OverlayUiRefs } from "../ui/createOverlayUi";
import { getDebugPanelLines, getGuidanceText } from "../ui/hudText";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { GameQueries } from "../runtime/gameQueries";
import type { TrajectoryPresentation } from "./trajectoryPresentation";

export const createHudPresentation = (options: {
  defaultViewport: number;
  overlayUi: OverlayUiRefs;
  physicsEngineName: string;
  queries: GameQueries;
  rendererProfiler: RendererProfiler;
  runtime: AppRuntimeState;
  timeWarps: number[];
  trajectoryPresentation: TrajectoryPresentation;
}) => ({
  update: (metrics: { smoothedCpuMs: number; smoothedFps: number }) => {
    const earth = options.runtime.state.bodies.find((body) => body.id === "earth");
    if (!earth) {
      return;
    }

    const relativeVelocity = sub(options.runtime.state.spacecraft.velocity, earth.velocity);
    const speed = length(relativeVelocity);
    const target = options.queries.getAssistTarget();
    const targetMetrics = options.queries.getCaptureMetrics(target);
    const circularizePlan = options.runtime.assistMode === "circularize" ? options.queries.getCircularizePlan(target) : null;
    const predictionState = options.trajectoryPresentation.getPredictionState();

    if (options.overlayUi.statEngine) {
      options.overlayUi.statEngine.textContent = options.physicsEngineName;
    }
    if (options.overlayUi.statWarp) {
      options.overlayUi.statWarp.textContent = `${options.timeWarps[options.runtime.timeWarpIndex] ?? 1}x`;
    }
    if (options.overlayUi.statSpeed) {
      options.overlayUi.statSpeed.textContent = `${speed.toFixed(0)} m/s`;
    }
    if (options.overlayUi.statFuel) {
      options.overlayUi.statFuel.textContent = `${options.runtime.state.spacecraft.fuelUsed.toFixed(1)} kg`;
    }
    if (options.overlayUi.statZoom) {
      options.overlayUi.statZoom.textContent = `${(options.defaultViewport / options.runtime.viewportSize).toFixed(1)}x`;
    }
    if (options.overlayUi.statTarget) {
      options.overlayUi.statTarget.textContent = target.name;
    }
    if (options.overlayUi.statTargetSpeed) {
      options.overlayUi.statTargetSpeed.textContent = `${targetMetrics.relativeSpeed.toFixed(0)} m/s`;
    }
    if (options.overlayUi.statAssist) {
      options.overlayUi.statAssist.textContent =
        options.runtime.crashedBodyName
          ? "Crashed"
          : options.runtime.assistMode === "capture"
            ? "Capture"
            : options.runtime.assistMode === "circularize"
              ? "Circularize"
              : "Off";
    }
    if (options.overlayUi.statGuidance) {
      options.overlayUi.statGuidance.textContent = getGuidanceText({
        assistMode: options.runtime.assistMode,
        circularizePlan,
        crashedBodyName: options.runtime.crashedBodyName,
        predictedImpact: predictionState.predictedImpact,
        predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
        targetMetrics,
      });
    }

    options.overlayUi.debugPanel.element.style.display = options.runtime.debugModeEnabled ? "block" : "none";
    if (options.runtime.debugModeEnabled) {
      options.overlayUi.debugPanel.setText(
        getDebugPanelLines({
          assistMode: options.runtime.assistMode,
          bodyInfluences: getBodyInfluences(options.runtime.state),
          coastPredictionHorizonSeconds: options.queries.getCoastPredictionHorizonSeconds(),
          debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
          debugSnapshotStatus: options.runtime.debugSnapshotStatus,
          fpsIndicatorEnabled: options.runtime.fpsIndicatorEnabled,
          performanceDebugEnabled: options.runtime.performanceDebugEnabled,
          predictionStepSeconds: options.queries.getPredictionConfig().stepSeconds,
          predictedImpact: predictionState.predictedImpact,
          predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
          smoothedCpuMs: metrics.smoothedCpuMs,
          smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
          targetMetrics,
          targetName: target.name,
        }).join("\n"),
      );
      options.overlayUi.debugPanel.setJson(null);
    }

    const fpsIndicatorVisible = options.runtime.debugModeEnabled && options.runtime.fpsIndicatorEnabled;
    options.overlayUi.fpsIndicator.style.display = fpsIndicatorVisible ? "block" : "none";
    options.overlayUi.fpsIndicator.textContent = `FPS ${metrics.smoothedFps.toFixed(1)}`;
  },
});

export type HudPresentation = ReturnType<typeof createHudPresentation>;

import * as THREE from "three";

import type { AssistMode, CaptureMetrics, CircularizePlan } from "../assist/orbitalAssist";
import type { PredictedClosestApproach, PredictedImpact } from "../prediction/trajectoryPrediction";
import type { BodyInfluence } from "../simulation/bodyInfluence";
import type { OverlayUiRefs } from "./createOverlayUi";
import { getDebugPanelLines, getGuidanceText } from "./hudText";

export type Ripple = {
  age: number;
  element: HTMLElement;
};

export const createRipple = (parent: HTMLElement, ripples: Ripple[], screenX: number, screenY: number) => {
  const ripple = document.createElement("div");
  ripple.className = "map-ripple";
  ripple.style.left = `${screenX}px`;
  ripple.style.top = `${screenY}px`;
  ripple.innerHTML = "<span></span><span></span><span></span>";
  parent.appendChild(ripple);
  ripples.push({ element: ripple, age: 0 });
};

export const updateRipples = (ripples: Ripple[], dt: number) => {
  const maxAge = 1.15;

  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += dt;
    const progress = ripple.age / maxAge;
    const rings = Array.from(ripple.element.children) as HTMLElement[];

    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      const ring = rings[ringIndex];
      const delayedProgress = THREE.MathUtils.clamp(progress - ringIndex * 0.14, 0, 1);
      ring.style.opacity = `${Math.max(0, 0.62 * (1 - delayedProgress))}`;
      ring.style.transform = `scale(${1 + delayedProgress * 4.33})`;
    }

    if (ripple.age >= maxAge) {
      ripple.element.remove();
      ripples.splice(index, 1);
    }
  }
};

export const updateHud = (options: {
  assistMode: AssistMode;
  bodyInfluences: BodyInfluence[];
  circularizePlan: CircularizePlan | null;
  coastPredictionHorizonSeconds: number;
  crashedBodyName: string | null;
  debugModeEnabled: boolean;
  debugNoGravityEnabled: boolean;
  debugSnapshotStatus: string;
  defaultViewport: number;
  fpsIndicatorEnabled: boolean;
  fuelUsed: number;
  overlayUi: OverlayUiRefs;
  performanceDebugEnabled: boolean;
  physicsEngineName: string;
  predictedImpact: PredictedImpact | null;
  predictedTargetClosestApproach: PredictedClosestApproach | null;
  predictionStepSeconds: number;
  smoothedCpuMs: number;
  smoothedGpuMs: number | null;
  speed: number;
  targetMetrics: CaptureMetrics;
  targetName: string;
  timeWarp: number;
  viewportSize: number;
}) => {
  if (options.overlayUi.statEngine) {
    options.overlayUi.statEngine.textContent = options.physicsEngineName;
  }
  if (options.overlayUi.statWarp) {
    options.overlayUi.statWarp.textContent = `${options.timeWarp}x`;
  }
  if (options.overlayUi.statSpeed) {
    options.overlayUi.statSpeed.textContent = `${options.speed.toFixed(0)} m/s`;
  }
  if (options.overlayUi.statFuel) {
    options.overlayUi.statFuel.textContent = `${options.fuelUsed.toFixed(1)} kg`;
  }
  if (options.overlayUi.statZoom) {
    options.overlayUi.statZoom.textContent = `${(options.defaultViewport / options.viewportSize).toFixed(1)}x`;
  }
  if (options.overlayUi.statTarget) {
    options.overlayUi.statTarget.textContent = options.targetName;
  }
  if (options.overlayUi.statTargetSpeed) {
    options.overlayUi.statTargetSpeed.textContent = `${options.targetMetrics.relativeSpeed.toFixed(0)} m/s`;
  }
  if (options.overlayUi.statAssist) {
    options.overlayUi.statAssist.textContent =
      options.crashedBodyName ? "Crashed" : options.assistMode === "capture" ? "Capture" : options.assistMode === "circularize" ? "Circularize" : "Off";
  }
  if (options.overlayUi.statGuidance) {
    options.overlayUi.statGuidance.textContent = getGuidanceText({
      assistMode: options.assistMode,
      circularizePlan: options.circularizePlan,
      crashedBodyName: options.crashedBodyName,
      predictedImpact: options.predictedImpact,
      predictedTargetClosestApproach: options.predictedTargetClosestApproach,
      targetMetrics: options.targetMetrics,
    });
  }
  options.overlayUi.debugPanel.element.style.display = options.debugModeEnabled ? "block" : "none";
  if (options.debugModeEnabled) {
    options.overlayUi.debugPanel.setText(
      getDebugPanelLines({
        assistMode: options.assistMode,
        bodyInfluences: options.bodyInfluences,
        coastPredictionHorizonSeconds: options.coastPredictionHorizonSeconds,
        debugNoGravityEnabled: options.debugNoGravityEnabled,
        debugSnapshotStatus: options.debugSnapshotStatus,
        fpsIndicatorEnabled: options.fpsIndicatorEnabled,
        performanceDebugEnabled: options.performanceDebugEnabled,
        predictionStepSeconds: options.predictionStepSeconds,
        predictedImpact: options.predictedImpact,
        predictedTargetClosestApproach: options.predictedTargetClosestApproach,
        smoothedCpuMs: options.smoothedCpuMs,
        smoothedGpuMs: options.smoothedGpuMs,
        targetMetrics: options.targetMetrics,
        targetName: options.targetName,
      }).join("\n"),
    );
    options.overlayUi.debugPanel.setJson(null);
  }
};

export const updateFpsIndicator = (overlayUi: OverlayUiRefs, visible: boolean, smoothedFps: number) => {
  overlayUi.fpsIndicator.style.display = visible ? "block" : "none";
  overlayUi.fpsIndicator.textContent = `FPS ${smoothedFps.toFixed(1)}`;
};

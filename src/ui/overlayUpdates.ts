import * as THREE from "three";

import type { AssistMode, CaptureMetrics, CircularizePlan } from "../assist/orbitalAssist";
import { RENDER_SCALE } from "../simulation/constants";
import type { PredictedClosestApproach, PredictedImpact } from "../prediction/trajectoryPrediction";
import type { BodyInfluence } from "../simulation/bodyInfluence";
import type { Body, Spacecraft } from "../simulation/types";
import type { Vec2 } from "../simulation/vector";
import type { PointerScreenPosition } from "../input/pointerCameraInput";
import { formatDistance } from "./formatters";
import type { OverlayUiRefs } from "./createOverlayUi";
import { getDebugPanelLines, getGuidanceText } from "./hudText";

export type Ripple = {
  age: number;
  element: HTMLElement;
};

type RenderPositionFn = (x: number, y: number, lift?: number) => THREE.Vector3;

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

export const updateSpacecraftCallout = (options: {
  camera: THREE.Camera;
  defaultViewport: number;
  overlayUi: OverlayUiRefs;
  pointerScreenPosition: PointerScreenPosition;
  renderPosition: RenderPositionFn;
  isThrusting: boolean;
  spacecraft: Spacecraft;
  spacecraftLabelIntroUntil: number;
  spacecraftModelZoomThreshold: number;
  viewportSize: number;
}) => {
  const position = options.renderPosition(options.spacecraft.position.x, options.spacecraft.position.y, 1.2);
  position.project(options.camera);

  const screenX = (position.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight;
  const isVisible = position.z > -1 && position.z < 1;
  const useSymbolicShip = options.viewportSize > options.defaultViewport / options.spacecraftModelZoomThreshold;
  const showLabel =
    performance.now() < options.spacecraftLabelIntroUntil ||
    Math.hypot(options.pointerScreenPosition.x - screenX, options.pointerScreenPosition.y - screenY) < 28;

  options.overlayUi.spacecraftCallout.style.setProperty("--dot-opacity", useSymbolicShip ? "1" : "0");

  if (!isVisible) {
    options.overlayUi.spacecraftCallout.style.display = "none";
    options.overlayUi.spacecraftIconThrust.style.display = "none";
    return;
  }

  options.overlayUi.spacecraftCallout.style.display = useSymbolicShip || showLabel ? "flex" : "none";
  options.overlayUi.spacecraftCallout.style.left = `${screenX}px`;
  options.overlayUi.spacecraftCallout.style.top = `${screenY}px`;
  if (options.overlayUi.spacecraftCalloutLabel) {
    options.overlayUi.spacecraftCalloutLabel.style.display = showLabel ? "inline-block" : "none";
  }

  const forward = {
    x: Math.cos(options.spacecraft.heading),
    y: Math.sin(options.spacecraft.heading),
  };
  const forwardPosition = options.renderPosition(
    options.spacecraft.position.x + forward.x * 1_000_000,
    options.spacecraft.position.y + forward.y * 1_000_000,
    1.2,
  );
  forwardPosition.project(options.camera);
  const forwardX = (forwardPosition.x * 0.5 + 0.5) * window.innerWidth;
  const forwardY = (-forwardPosition.y * 0.5 + 0.5) * window.innerHeight;
  const headingAngle = Math.atan2(forwardY - screenY, forwardX - screenX);

  options.overlayUi.spacecraftCallout.style.setProperty("--ship-heading", `${headingAngle}rad`);

  const iconThrustVisible =
    options.viewportSize > options.defaultViewport / options.spacecraftModelZoomThreshold && options.isThrusting;
  options.overlayUi.spacecraftIconThrust.style.display = iconThrustVisible ? "block" : "none";
  if (iconThrustVisible) {
    const backOffset = 8;
    options.overlayUi.spacecraftIconThrust.style.left = `${screenX - Math.cos(headingAngle) * backOffset}px`;
    options.overlayUi.spacecraftIconThrust.style.top = `${screenY - Math.sin(headingAngle) * backOffset}px`;
    options.overlayUi.spacecraftIconThrust.style.transform = `translate(-50%, -50%) rotate(${headingAngle}rad)`;
  }
};

export const updateOffscreenIndicators = (options: {
  bodies: Body[];
  camera: THREE.Camera;
  overlayUi: OverlayUiRefs;
  renderPosition: RenderPositionFn;
  spacecraftPosition: Vec2;
}) => {
  const edgePadding = 28;
  const screenCenterX = window.innerWidth * 0.5;
  const screenCenterY = window.innerHeight * 0.5;

  for (const body of options.bodies) {
    const indicator = options.overlayUi.offscreenIndicators.get(body.id);
    if (!indicator) {
      continue;
    }

    const position = options.renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(options.camera);

    const isVisible = position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z > -1 && position.z < 1;

    if (isVisible) {
      indicator.style.display = "none";
      continue;
    }

    const projectedX = (position.x * 0.5 + 0.5) * window.innerWidth;
    const projectedY = (-position.y * 0.5 + 0.5) * window.innerHeight;
    const direction = Math.atan2(projectedY - screenCenterY, projectedX - screenCenterX);
    const distance = Math.max(
      0,
      Math.hypot(body.position.x - options.spacecraftPosition.x, body.position.y - options.spacecraftPosition.y) - body.radius,
    );
    const pointer = indicator.querySelector<HTMLElement>(".pointer");
    const label = indicator.querySelector<HTMLElement>(".label");

    if (pointer) {
      pointer.style.transform = `rotate(${direction + Math.PI / 2}rad)`;
    }
    if (label) {
      label.textContent = `${body.name} ${formatDistance(distance)}`;
    }

    indicator.style.display = "flex";
    indicator.style.visibility = "hidden";
    const bounds = indicator.getBoundingClientRect();
    const edgeX = THREE.MathUtils.clamp(projectedX, bounds.width * 0.5 + edgePadding, window.innerWidth - bounds.width * 0.5 - edgePadding);
    const edgeY = THREE.MathUtils.clamp(
      projectedY,
      bounds.height * 0.5 + edgePadding,
      window.innerHeight - bounds.height * 0.5 - edgePadding,
    );

    indicator.style.left = `${edgeX}px`;
    indicator.style.top = `${edgeY}px`;
    indicator.style.visibility = "visible";
  }
};

export const updateBodyLabels = (options: {
  bodies: Body[];
  camera: THREE.Camera;
  overlayUi: OverlayUiRefs;
  renderPosition: RenderPositionFn;
  viewportSize: number;
}) => {
  const labelRadiusThreshold = 24;
  const pixelsPerRenderUnit = window.innerHeight / options.viewportSize;

  for (const body of options.bodies) {
    const label = options.overlayUi.bodyLabels.get(body.id);
    if (!label) {
      continue;
    }

    const apparentRadius = body.radius * RENDER_SCALE * pixelsPerRenderUnit;
    const position = options.renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(options.camera);
    const isVisible = position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z > -1 && position.z < 1;

    if (!isVisible || apparentRadius > labelRadiusThreshold) {
      label.style.display = "none";
      continue;
    }

    const screenX = (position.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight;
    label.style.display = "block";
    label.style.visibility = "hidden";
    const bounds = label.getBoundingClientRect();
    const labelX = THREE.MathUtils.clamp(screenX + 10, 8, window.innerWidth - bounds.width - 8);
    const labelY = THREE.MathUtils.clamp(screenY, bounds.height * 0.5 + 8, window.innerHeight - bounds.height * 0.5 - 8);
    label.style.left = `${labelX}px`;
    label.style.top = `${labelY}px`;
    label.style.visibility = "visible";
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

import * as THREE from "three";

import type { CaptureMetrics, CircularizePlan } from "../assist/orbitalAssist";
import type { KeyboardInput } from "../input/keyboardInput";
import type { PointerCameraInput } from "../input/pointerCameraInput";
import type { TrajectoryPredictionConfig } from "../prediction/trajectoryPrediction";
import { renderPosition, updateCircularizationVisuals, updateSpacecraftTrail, updateTargetRelativePredictionVisuals, updateWorldVisuals } from "../render/sceneUpdates";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { GameSceneRefs } from "../scene/createGameScene";
import { getBodyInfluences } from "../simulation/bodyInfluence";
import type { Body, ControlInput, PhysicsEngine, SimulationState } from "../simulation/types";
import { length, sub } from "../simulation/vector";
import type { OverlayUiRefs } from "../ui/createOverlayUi";
import { type Ripple, updateBodyLabels, updateFpsIndicator, updateHud as updateOverlayHud, updateOffscreenIndicators, updateRipples, updateSpacecraftCallout } from "../ui/overlayUpdates";
import type { AppRuntimeState } from "./appRuntimeState";
import type { RuntimeActions } from "./runtimeActions";
import { stepSimulationFrame } from "./simulationStep";
import type { TrajectoryPredictionRuntime } from "./trajectoryPredictionRuntime";

export const createFrameLoop = (options: {
  defaultViewport: number;
  gameScene: GameSceneRefs;
  getAssistPredictionControls(simulationState: SimulationState, targetId: string): ControlInput;
  getAssistTarget(): Body;
  getAutopilotTurn(desiredHeading: number): number;
  getCaptureMetrics(target: Body): CaptureMetrics;
  getCircularizePlan(target: Body): CircularizePlan;
  getCoastPredictionHorizonSeconds(): number;
  getPredictionConfig(): TrajectoryPredictionConfig;
  keyboardInput: KeyboardInput;
  overlayUi: OverlayUiRefs;
  physicsEngine: PhysicsEngine;
  physicsEngineName: string;
  pointerCameraInput: PointerCameraInput;
  rendererProfiler: RendererProfiler;
  ripples: Ripple[];
  runtime: AppRuntimeState;
  runtimeActions: RuntimeActions;
  shouldCaptureBurn(target: Body): boolean;
  spacecraftModelZoomThreshold: number;
  timeWarps: number[];
  trajectoryPredictionRuntime: TrajectoryPredictionRuntime;
}) => {
  let lastTime = performance.now();
  let smoothedFps = 60;
  let smoothedCpuMs = 0;

  const updateHud = () => {
    const earth = options.runtime.state.bodies.find((body) => body.id === "earth") as Body;
    const relativeVelocity = sub(options.runtime.state.spacecraft.velocity, earth.velocity);
    const speed = length(relativeVelocity);
    const target = options.getAssistTarget();
    const targetMetrics = options.getCaptureMetrics(target);
    const circularizePlan = options.runtime.assistMode === "circularize" ? options.getCircularizePlan(target) : null;
    const predictionState = options.trajectoryPredictionRuntime.getState();

    updateOverlayHud({
      assistMode: options.runtime.assistMode,
      bodyInfluences: getBodyInfluences(options.runtime.state),
      circularizePlan,
      coastPredictionHorizonSeconds: options.getCoastPredictionHorizonSeconds(),
      crashedBodyName: options.runtime.crashedBodyName,
      debugModeEnabled: options.runtime.debugModeEnabled,
      debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
      debugSnapshotStatus: options.runtime.debugSnapshotStatus,
      defaultViewport: options.defaultViewport,
      fpsIndicatorEnabled: options.runtime.fpsIndicatorEnabled,
      fuelUsed: options.runtime.state.spacecraft.fuelUsed,
      overlayUi: options.overlayUi,
      performanceDebugEnabled: options.runtime.performanceDebugEnabled,
      physicsEngineName: options.physicsEngineName,
      predictedImpact: predictionState.predictedImpact,
      predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
      predictionStepSeconds: options.getPredictionConfig().stepSeconds,
      smoothedCpuMs,
      smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
      speed,
      targetMetrics,
      targetName: target.name,
      timeWarp: options.timeWarps[options.runtime.timeWarpIndex] ?? 1,
      viewportSize: options.runtime.viewportSize,
    });
  };

  const refreshTrajectoryPrediction = () => {
    options.trajectoryPredictionRuntime.refresh({
      assistMode: options.runtime.assistMode,
      coastPredictionHorizonSeconds: options.getCoastPredictionHorizonSeconds(),
      debugModeEnabled: options.runtime.debugModeEnabled,
      debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
      gameScene: options.gameScene,
      getAssistPredictionControls: options.getAssistPredictionControls,
      getAssistTarget: options.getAssistTarget,
      getCaptureMetrics: options.getCaptureMetrics,
      physicsEngine: options.physicsEngine,
      predictionConfig: options.getPredictionConfig(),
      state: options.runtime.state,
    });
  };

  const animate = (time: number) => {
    const frameStart = performance.now();
    const realDt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    smoothedFps = THREE.MathUtils.lerp(smoothedFps, 1 / Math.max(realDt, 1 / 240), 0.12);
    const isThrusting = options.runtime.state.controls.main > 0 && options.runtime.state.spacecraft.fuel > 0;

    const simulationStep = stepSimulationFrame({
      assistMode: options.runtime.assistMode,
      crashedBodyName: options.runtime.crashedBodyName,
      getAssistTarget: options.getAssistTarget,
      getAutopilotTurn: options.getAutopilotTurn,
      getCaptureMetrics: options.getCaptureMetrics,
      getCircularizePlan: options.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      maxControlWarp: 100,
      physicsEngine: options.physicsEngine,
      realDt,
      shouldCaptureBurn: options.shouldCaptureBurn,
      state: options.runtime.state,
      targetHeading: options.runtime.targetHeading,
      timeWarpIndex: options.runtime.timeWarpIndex,
      timeWarps: options.timeWarps,
    });
    options.runtime.assistMode = simulationStep.assistMode;
    options.runtime.crashedBodyName = simulationStep.crashedBodyName;
    options.runtime.state = simulationStep.state;
    options.runtime.targetHeading = simulationStep.targetHeading;
    options.runtime.timeWarpIndex = simulationStep.timeWarpIndex;

    updateRipples(options.ripples, realDt);
    options.runtimeActions.updateCamera();
    options.trajectoryPredictionRuntime.maybeRefresh(realDt, {
      assistMode: options.runtime.assistMode,
      coastPredictionHorizonSeconds: options.getCoastPredictionHorizonSeconds(),
      debugModeEnabled: options.runtime.debugModeEnabled,
      debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
      gameScene: options.gameScene,
      getAssistPredictionControls: options.getAssistPredictionControls,
      getAssistTarget: options.getAssistTarget,
      getCaptureMetrics: options.getCaptureMetrics,
      physicsEngine: options.physicsEngine,
      predictionConfig: options.getPredictionConfig(),
      state: options.runtime.state,
    });

    const predictionState = options.trajectoryPredictionRuntime.getState();
    if (options.runtime.assistMode !== "off") {
      options.gameScene.assistedPredictionMaterial.color.set(options.runtime.assistMode === "capture" ? 0xf59e0b : 0xfacc15);
    }

    updateWorldVisuals({
      bodies: options.runtime.state.bodies,
      defaultViewport: options.defaultViewport,
      gameScene: options.gameScene,
      spacecraft: options.runtime.state.spacecraft,
      spacecraftModelZoomThreshold: options.spacecraftModelZoomThreshold,
      viewportSize: options.runtime.viewportSize,
    });
    updateSpacecraftTrail({
      gameScene: options.gameScene,
      isThrusting,
      spacecraft: options.runtime.state.spacecraft,
    });
    updateTargetRelativePredictionVisuals({
      debugModeEnabled: options.runtime.debugModeEnabled,
      gameScene: options.gameScene,
      predictedImpact: predictionState.predictedImpact,
      target: options.getAssistTarget(),
      targetRelativeAssistedPoints: predictionState.targetRelativeAssistedPoints,
      targetRelativePredictionEnd: predictionState.targetRelativePredictionEnd,
      targetRelativePredictionPoints: predictionState.targetRelativePredictionPoints,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.viewportSize,
    });
    updateCircularizationVisuals({
      circularizePlan:
        options.runtime.assistMode === "circularize" && !options.runtime.crashedBodyName ? options.getCircularizePlan(options.getAssistTarget()) : null,
      gameScene: options.gameScene,
      spacecraftPosition: options.runtime.state.spacecraft.position,
      target: options.runtime.assistMode === "circularize" && !options.runtime.crashedBodyName ? options.getAssistTarget() : null,
      viewportSize: options.runtime.viewportSize,
    });
    updateSpacecraftCallout({
      camera: options.gameScene.camera,
      defaultViewport: options.defaultViewport,
      isThrusting,
      overlayUi: options.overlayUi,
      pointerScreenPosition: options.pointerCameraInput.pointerScreenPosition,
      renderPosition,
      spacecraft: options.runtime.state.spacecraft,
      spacecraftLabelIntroUntil: options.runtime.spacecraftLabelIntroUntil,
      spacecraftModelZoomThreshold: options.spacecraftModelZoomThreshold,
      viewportSize: options.runtime.viewportSize,
    });
    updateOffscreenIndicators({
      bodies: options.runtime.state.bodies,
      camera: options.gameScene.camera,
      overlayUi: options.overlayUi,
      renderPosition,
      spacecraftPosition: options.runtime.state.spacecraft.position,
    });
    updateBodyLabels({
      bodies: options.runtime.state.bodies,
      camera: options.gameScene.camera,
      overlayUi: options.overlayUi,
      renderPosition,
      viewportSize: options.runtime.viewportSize,
    });
    updateHud();
    updateFpsIndicator(options.overlayUi, options.runtime.debugModeEnabled && options.runtime.fpsIndicatorEnabled, smoothedFps);
    options.rendererProfiler.render(options.gameScene.scene, options.gameScene.camera, options.runtime.performanceDebugEnabled);

    smoothedCpuMs = THREE.MathUtils.lerp(smoothedCpuMs, performance.now() - frameStart, 0.15);
    requestAnimationFrame(animate);
  };

  return {
    refreshTrajectoryPrediction,
    start: () => {
      options.runtimeActions.updateCamera();
      updateWorldVisuals({
        bodies: options.runtime.state.bodies,
        defaultViewport: options.defaultViewport,
        gameScene: options.gameScene,
        spacecraft: options.runtime.state.spacecraft,
        spacecraftModelZoomThreshold: options.spacecraftModelZoomThreshold,
        viewportSize: options.runtime.viewportSize,
      });
      updateSpacecraftTrail({
        gameScene: options.gameScene,
        isThrusting: options.runtime.state.controls.main > 0 && options.runtime.state.spacecraft.fuel > 0,
        spacecraft: options.runtime.state.spacecraft,
      });
      updateHud();
      requestAnimationFrame(animate);
    },
  };
};

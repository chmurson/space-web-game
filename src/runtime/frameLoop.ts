import * as THREE from "three";

import type { KeyboardInput } from "../input/keyboardInput";
import type { BodyPresentation } from "../presentation/bodyPresentation";
import type { SpacecraftPresentation } from "../presentation/spacecraftPresentation";
import type { TrajectoryPresentation } from "../presentation/trajectoryPresentation";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { GameSceneRefs } from "../scene/createGameScene";
import { getBodyInfluences } from "../simulation/bodyInfluence";
import type { Body, PhysicsEngine } from "../simulation/types";
import { length, sub } from "../simulation/vector";
import type { OverlayUiRefs } from "../ui/createOverlayUi";
import { type Ripple, updateFpsIndicator, updateHud as updateOverlayHud, updateRipples } from "../ui/overlayUpdates";
import type { AppRuntimeState } from "./appRuntimeState";
import type { GameQueries } from "./gameQueries";
import type { RuntimeActions } from "./runtimeActions";
import { stepSimulationFrame } from "./simulationStep";

export const createFrameLoop = (options: {
  defaultViewport: number;
  gameScene: GameSceneRefs;
  keyboardInput: KeyboardInput;
  overlayUi: OverlayUiRefs;
  physicsEngine: PhysicsEngine;
  physicsEngineName: string;
  queries: GameQueries;
  rendererProfiler: RendererProfiler;
  ripples: Ripple[];
  runtime: AppRuntimeState;
  runtimeActions: RuntimeActions;
  bodyPresentation: BodyPresentation;
  spacecraftPresentation: SpacecraftPresentation;
  timeWarps: number[];
  trajectoryPresentation: TrajectoryPresentation;
}) => {
  let lastTime = performance.now();
  let smoothedFps = 60;
  let smoothedCpuMs = 0;

  const updateHud = () => {
    const earth = options.runtime.state.bodies.find((body) => body.id === "earth") as Body;
    const relativeVelocity = sub(options.runtime.state.spacecraft.velocity, earth.velocity);
    const speed = length(relativeVelocity);
    const target = options.queries.getAssistTarget();
    const targetMetrics = options.queries.getCaptureMetrics(target);
    const circularizePlan = options.runtime.assistMode === "circularize" ? options.queries.getCircularizePlan(target) : null;
    const predictionState = options.trajectoryPresentation.getPredictionState();

    updateOverlayHud({
      assistMode: options.runtime.assistMode,
      bodyInfluences: getBodyInfluences(options.runtime.state),
      circularizePlan,
      coastPredictionHorizonSeconds: options.queries.getCoastPredictionHorizonSeconds(),
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
      predictionStepSeconds: options.queries.getPredictionConfig().stepSeconds,
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
    options.trajectoryPresentation.refreshPrediction();
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
      getAssistTarget: options.queries.getAssistTarget,
      getAutopilotTurn: options.queries.getAutopilotTurn,
      getCaptureMetrics: options.queries.getCaptureMetrics,
      getCircularizePlan: options.queries.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      maxControlWarp: 100,
      physicsEngine: options.physicsEngine,
      realDt,
      shouldCaptureBurn: options.queries.shouldCaptureBurn,
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
    options.trajectoryPresentation.maybeRefreshPrediction(realDt);

    options.bodyPresentation.updateVisuals({
      bodies: options.runtime.state.bodies,
      spacecraftPosition: options.runtime.state.spacecraft.position,
      viewportSize: options.runtime.viewportSize,
    });
    options.spacecraftPresentation.updateVisuals({
      isThrusting,
      spacecraft: options.runtime.state.spacecraft,
      spacecraftLabelIntroUntil: options.runtime.spacecraftLabelIntroUntil,
      viewportSize: options.runtime.viewportSize,
    });
    options.trajectoryPresentation.updateVisuals();
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
      options.bodyPresentation.updateVisuals({
        bodies: options.runtime.state.bodies,
        spacecraftPosition: options.runtime.state.spacecraft.position,
        viewportSize: options.runtime.viewportSize,
      });
      options.spacecraftPresentation.updateVisuals({
        isThrusting: options.runtime.state.controls.main > 0 && options.runtime.state.spacecraft.fuel > 0,
        spacecraft: options.runtime.state.spacecraft,
        spacecraftLabelIntroUntil: options.runtime.spacecraftLabelIntroUntil,
        viewportSize: options.runtime.viewportSize,
      });
      updateHud();
      requestAnimationFrame(animate);
    },
  };
};

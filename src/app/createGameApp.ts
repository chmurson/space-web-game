import * as THREE from "three";

import { gameConfig } from "../config/gameConfig";
import { bindKeyboardShortcuts } from "../input/bindKeyboardShortcuts";
import { createKeyboardInput } from "../input/keyboardInput";
import { bindPointerCameraInput } from "../input/pointerCameraInput";
import { createBodyPresentation } from "../presentation/bodyPresentation";
import { createHudPresentation } from "../presentation/hudPresentation";
import { createSpacecraftPresentation } from "../presentation/spacecraftPresentation";
import { createTrajectoryPresentation } from "../presentation/trajectoryPresentation";
import { createRendererProfiler } from "../render/rendererProfiler";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { createFrameLoop } from "../runtime/frameLoop";
import { createGameQueries } from "../runtime/gameQueries";
import { createRuntimeActions } from "../runtime/runtimeActions";
import { createTrajectoryPredictionRuntime } from "../runtime/trajectoryPredictionRuntime";
import { createDefaultScenarioDirectives, type ScenarioDirectiveLimits } from "../scenario/scenarioDirectiveTypes";
import { syncRuntimeScenarioDirectives } from "../scenario/scenarioDirectives";
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  type RuntimeScenarioOptions,
  } from "../scenario/runtimeScenario";
import { createGameScene } from "../scene/createGameScene";
import { RENDER_SCALE } from "../simulation/constants";
import { defaultPhysicsEngine, physicsEngines } from "../simulation/physics";
import { createOverlayUi } from "../ui/createOverlayUi";
import { createRipple, type Ripple } from "../ui/overlayUpdates";
import { readUserSettings, updateUserSettings } from "../userSettingsStorage";

export const createGameApp = (app: HTMLDivElement) => {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedEngine = urlParams.get("engine") ?? "";
  const physicsEngine = physicsEngines[requestedEngine] ?? defaultPhysicsEngine;
  const requestedScenario = urlParams.get("scenario") ?? "earth-moon";
  const scenario = createRequestedRuntimeScenario(requestedScenario);
  const userSettings = readUserSettings();
  const keyboardInput = createKeyboardInput();
  const timeWarps = gameConfig.controls.timeWarps;
  const autoSelectNearestSurface = gameConfig.assistTarget.autoSelectNearestSurface;
  const autopilotRotationRate = gameConfig.controls.autopilotRotationRate;
  const defaultCoastPredictionHorizonHours = gameConfig.trajectory.horizon.defaultHours;
  const minCoastPredictionHorizonHours = gameConfig.trajectory.horizon.minHours;
  const maxCoastPredictionHorizonHours = gameConfig.trajectory.horizon.maxHours;
  const cameraDistance = gameConfig.camera.distance;
  const cameraElevation = THREE.MathUtils.degToRad(gameConfig.camera.elevationDegrees);
  const defaultViewport = gameConfig.camera.viewport.default;
  const spacecraftModelZoomThreshold = gameConfig.camera.spacecraftModelZoomThreshold;
  const minViewport = defaultViewport / gameConfig.camera.viewport.minDivisor;
  const maxViewport = gameConfig.camera.viewport.max;
  const runtimeScenarioOptions: RuntimeScenarioOptions = {
    defaultCoastPredictionHorizonHours,
    defaultViewportSize: defaultViewport,
    maxCoastPredictionHorizonHours,
    maxViewportSize: maxViewport,
    minCoastPredictionHorizonHours,
    minViewportSize: minViewport,
  };
  const initialRuntimeScenarioState = createRuntimeScenarioState(scenario, runtimeScenarioOptions);
  const runtime: AppRuntimeState = {
    assistMode: "off",
    assistTargetIndex: 1,
    coastPredictionHorizonHours: initialRuntimeScenarioState.coastPredictionHorizonHours,
    crashedBodyName: null,
    debugModeEnabled: userSettings.debugModeEnabled,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: "",
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
    scenarioDirectives: createDefaultScenarioDirectives(),
    scenarioSession: initialRuntimeScenarioState.scenarioSession,
    spacecraftLabelIntroUntil: performance.now() + 5_000,
    state: initialRuntimeScenarioState.state,
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: initialRuntimeScenarioState.viewportSize,
  };
  const scenarioDirectiveLimits: ScenarioDirectiveLimits = {
    defaultViewportSize: defaultViewport,
    maxCoastPredictionHorizonHours,
    maxViewportSize: maxViewport,
    minViewportSize: minViewport,
    timeWarps,
  };
  syncRuntimeScenarioDirectives(runtime, scenarioDirectiveLimits);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05070d);
  app.appendChild(renderer.domElement);

  const rendererProfiler = createRendererProfiler(renderer);
  const gameScene = createGameScene(runtime.state.bodies, gameConfig.trajectory.rendering);
  const trajectoryPredictionRuntime = createTrajectoryPredictionRuntime();
  const ripples: Ripple[] = [];
  const overlayUi = createOverlayUi({
    app,
    bodies: runtime.state.bodies,
    scenarioDescription: scenario.description,
    scenarioName: scenario.name,
    showCycleTargetHint: !autoSelectNearestSurface,
  });
  const queries = createGameQueries({
    autoSelectNearestSurface,
    autoSelectConfig: {
      switchRangeMultiplier: gameConfig.assistTarget.switchRangeMultiplier,
    },
    autopilotRotationRate,
    getPredictedTrajectoryEnd: () => trajectoryPredictionRuntime.getState().absolutePredictionEnd,
    getPredictedTrajectoryPoints: () => trajectoryPredictionRuntime.getState().absolutePredictionPoints,
    maxPredictionLoopRevolutions: gameConfig.trajectory.loopTrim.maxRevolutions,
    predictionSampling: gameConfig.trajectory.sampling,
    runtime,
  });
  const trajectoryPresentation = createTrajectoryPresentation({
    gameScene,
    physicsEngine,
    queries,
    runtime,
    trajectoryPredictionRuntime,
  });
  const hudPresentation = createHudPresentation({
    defaultViewport,
    overlayUi,
    physicsEngineName: physicsEngine.name,
    queries,
    rendererProfiler,
    runtime,
    timeWarps,
    trajectoryPresentation,
  });

  const runtimeActions = createRuntimeActions({
    app,
    cameraDistance,
    cameraElevation,
    createRipple,
    gameScene,
    maxCoastPredictionHorizonHours,
    maxViewport,
    minCoastPredictionHorizonHours,
    minViewport,
    renderer,
    requestedScenario,
    ripples,
    runtime,
    scenarioDirectiveLimits,
    runtimeScenarioOptions,
    timeWarps,
    updateUserSettings,
  });

  const pointerCameraInput = bindPointerCameraInput({
    camera: gameScene.camera,
    getSpacecraftPosition: () => runtime.state.spacecraft.position,
    onResize: runtimeActions.handleResize,
    onTargetHeadingSelected: (heading, screenPosition) => {
      runtimeActions.setTargetHeading(heading, screenPosition.x, screenPosition.y);
    },
    onZoom: runtimeActions.zoomCamera,
    renderScale: RENDER_SCALE,
    rendererElement: renderer.domElement,
    windowTarget: window,
  });

  const frameLoop = createFrameLoop({
    gameScene,
    hudPresentation,
    keyboardInput,
    physicsEngine,
    queries,
    rendererProfiler,
    ripples,
    runtime,
    runtimeActions,
    scenarioDirectiveLimits,
    bodyPresentation: createBodyPresentation({
      gameScene,
      overlayUi,
    }),
    spacecraftPresentation: createSpacecraftPresentation({
      defaultViewport,
      gameScene,
      overlayUi,
      pointerCameraInput,
      spacecraftModelZoomThreshold,
    }),
    timeWarps,
    trajectoryPresentation,
  });

  bindKeyboardShortcuts({
    autoDiscoverStrongestInfluence: autoSelectNearestSurface,
    getDebugModeEnabled: () => runtime.debugModeEnabled,
    handleAction: (action) => {
      const result = runtimeActions.handleKeyboardShortcutAction(action);
      if (result.refreshTrajectoryPrediction) {
        frameLoop.refreshTrajectoryPrediction();
      }
    },
    keyboardInput,
    windowTarget: window,
  });

  frameLoop.start();
};

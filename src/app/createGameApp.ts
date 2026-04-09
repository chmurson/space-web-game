import * as THREE from "three";

import { appSettings } from "../appSettings";
import { getAssistTargetForState } from "../assist/assistTarget";
import {
  getAssistPredictionControlsForState,
  getAutopilotTurnForHeading,
  getCaptureMetricsForState,
  getCircularizePlanForState,
  shouldCaptureBurnForMetrics,
} from "../assist/orbitalAssist";
import { gameConfig } from "../config/gameConfig";
import { bindKeyboardShortcuts } from "../input/bindKeyboardShortcuts";
import { createKeyboardInput } from "../input/keyboardInput";
import { bindPointerCameraInput } from "../input/pointerCameraInput";
import { createSpacecraftPresentation } from "../presentation/spacecraftPresentation";
import { createTrajectoryPresentation } from "../presentation/trajectoryPresentation";
import { getTrajectoryPredictionConfig } from "../prediction/trajectoryPrediction";
import { createRendererProfiler } from "../render/rendererProfiler";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { createFrameLoop } from "../runtime/frameLoop";
import { createRuntimeActions } from "../runtime/runtimeActions";
import { createTrajectoryPredictionRuntime } from "../runtime/trajectoryPredictionRuntime";
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  type RuntimeScenarioOptions,
} from "../scenario/runtimeScenario";
import { createGameScene } from "../scene/createGameScene";
import { RENDER_SCALE } from "../simulation/constants";
import { defaultPhysicsEngine, physicsEngines } from "../simulation/physics";
import type { Body, ControlInput, SimulationState } from "../simulation/types";
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
    spacecraftLabelIntroUntil: performance.now() + 5_000,
    state: initialRuntimeScenarioState.state,
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: initialRuntimeScenarioState.viewportSize,
  };

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
    showCycleTargetHint: !appSettings.assistTarget.autoDiscoverStrongestInfluence,
  });

  const getAssistTarget = () =>
    getAssistTargetForState(runtime.state, {
      autoDiscoverStrongestInfluence: appSettings.assistTarget.autoDiscoverStrongestInfluence,
      selectedIndex: runtime.assistTargetIndex,
    });

  const getAutopilotTurn = (desiredHeading: number) => getAutopilotTurnForHeading(runtime.state.spacecraft.heading, desiredHeading, autopilotRotationRate);

  const getCaptureMetrics = (target: Body) => getCaptureMetricsForState(runtime.state, target);

  const shouldCaptureBurn = (target: Body) => shouldCaptureBurnForMetrics(getCaptureMetrics(target));

  const getCircularizePlan = (target: Body) => getCircularizePlanForState(runtime.state, target);

  const getAssistPredictionControls = (simulationState: SimulationState, targetId: string): ControlInput =>
    getAssistPredictionControlsForState(simulationState, targetId, runtime.assistMode, autopilotRotationRate);

  const getCoastPredictionHorizonSeconds = () => runtime.coastPredictionHorizonHours * 60 * 60;

  const getPredictionConfig = () =>
    getTrajectoryPredictionConfig(
      getCoastPredictionHorizonSeconds(),
      gameConfig.trajectory.sampling,
      gameConfig.trajectory.loopTrim.maxRevolutions,
    );

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
    defaultViewport,
    gameScene,
    getAssistPredictionControls,
    getAssistTarget,
    getAutopilotTurn,
    getCaptureMetrics,
    getCircularizePlan,
    getCoastPredictionHorizonSeconds,
    getPredictionConfig,
    keyboardInput,
    overlayUi,
    physicsEngine,
    physicsEngineName: physicsEngine.name,
    rendererProfiler,
    ripples,
    runtime,
    runtimeActions,
    spacecraftPresentation: createSpacecraftPresentation({
      defaultViewport,
      gameScene,
      overlayUi,
      pointerCameraInput,
      spacecraftModelZoomThreshold,
    }),
    shouldCaptureBurn,
    spacecraftModelZoomThreshold,
    timeWarps,
    trajectoryPresentation: createTrajectoryPresentation({
      gameScene,
      getAssistPredictionControls,
      getAssistTarget,
      getCaptureMetrics,
      getCircularizePlan,
      getCoastPredictionHorizonSeconds,
      getPredictionConfig,
      physicsEngine,
      runtime,
      trajectoryPredictionRuntime,
    }),
  });

  bindKeyboardShortcuts({
    autoDiscoverStrongestInfluence: appSettings.assistTarget.autoDiscoverStrongestInfluence,
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

import "./style.css";
import * as THREE from "three";
import { appSettings } from "./appSettings";
import { getAssistTargetForState } from "./assist/assistTarget";
import {
  getAssistPredictionControlsForState,
  getAutopilotTurnForHeading,
  getCaptureMetricsForState,
  getCircularizePlanForState,
  shouldCaptureBurnForMetrics,
} from "./assist/orbitalAssist";
import { gameConfig } from "./config/gameConfig";
import {
  getTrajectoryPredictionConfig,
} from "./prediction/trajectoryPrediction";
import { bindKeyboardShortcuts } from "./input/bindKeyboardShortcuts";
import { createKeyboardInput } from "./input/keyboardInput";
import { bindPointerCameraInput } from "./input/pointerCameraInput";
import { createRendererProfiler } from "./render/rendererProfiler";
import {
  renderPosition,
  updateCircularizationVisuals,
  updateSpacecraftTrail,
  updateTargetRelativePredictionVisuals,
  updateWorldVisuals,
} from "./render/sceneUpdates";
import type { AppRuntimeState } from "./runtime/appRuntimeState";
import { createRuntimeActions } from "./runtime/runtimeActions";
import { stepSimulationFrame } from "./runtime/simulationStep";
import { createTrajectoryPredictionRuntime } from "./runtime/trajectoryPredictionRuntime";
import { createGameScene } from "./scene/createGameScene";
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  type RuntimeScenarioOptions,
} from "./scenario/runtimeScenario";
import { getBodyInfluences } from "./simulation/bodyInfluence";
import { RENDER_SCALE } from "./simulation/constants";
import { defaultPhysicsEngine, physicsEngines } from "./simulation/physics";
import type { Body, ControlInput, SimulationState } from "./simulation/types";
import { length, sub } from "./simulation/vector";
import { createOverlayUi } from "./ui/createOverlayUi";
import {
  createRipple,
  type Ripple,
  updateBodyLabels,
  updateFpsIndicator,
  updateHud as updateOverlayHud,
  updateOffscreenIndicators,
  updateRipples,
  updateSpacecraftCallout,
} from "./ui/overlayUpdates";
import { readUserSettings, updateUserSettings } from "./userSettingsStorage";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}

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

const getPredictionConfig = () => {
  return getTrajectoryPredictionConfig(
    getCoastPredictionHorizonSeconds(),
    gameConfig.trajectory.sampling,
    gameConfig.trajectory.loopTrim.maxRevolutions,
  );
};
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

const updateHud = () => {
  const earth = runtime.state.bodies.find((body) => body.id === "earth") as Body;
  const relativeVelocity = sub(runtime.state.spacecraft.velocity, earth.velocity);
  const speed = length(relativeVelocity);
  const target = getAssistTarget();
  const targetMetrics = getCaptureMetrics(target);
  const circularizePlan = runtime.assistMode === "circularize" ? getCircularizePlan(target) : null;
  const predictionState = trajectoryPredictionRuntime.getState();

  updateOverlayHud({
    assistMode: runtime.assistMode,
    bodyInfluences: getBodyInfluences(runtime.state),
    circularizePlan,
    coastPredictionHorizonSeconds: getCoastPredictionHorizonSeconds(),
    crashedBodyName: runtime.crashedBodyName,
    debugModeEnabled: runtime.debugModeEnabled,
    debugNoGravityEnabled: runtime.debugNoGravityEnabled,
    debugSnapshotStatus: runtime.debugSnapshotStatus,
    defaultViewport,
    fpsIndicatorEnabled: runtime.fpsIndicatorEnabled,
    fuelUsed: runtime.state.spacecraft.fuelUsed,
    overlayUi,
    performanceDebugEnabled: runtime.performanceDebugEnabled,
    physicsEngineName: physicsEngine.name,
    predictedImpact: predictionState.predictedImpact,
    predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
    predictionStepSeconds: getPredictionConfig().stepSeconds,
    smoothedCpuMs,
    smoothedGpuMs: rendererProfiler.getSmoothedGpuMs(),
    speed,
    targetMetrics,
    targetName: target.name,
    timeWarp: timeWarps[runtime.timeWarpIndex] ?? 1,
    viewportSize: runtime.viewportSize,
  });
};

let lastTime = performance.now();
let smoothedFps = 60;
let smoothedCpuMs = 0;

const animate = (time: number) => {
  const frameStart = performance.now();
  const realDt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  smoothedFps = THREE.MathUtils.lerp(smoothedFps, 1 / Math.max(realDt, 1 / 240), 0.12);
  const isThrusting = runtime.state.controls.main > 0 && runtime.state.spacecraft.fuel > 0;

  const simulationStep = stepSimulationFrame({
    assistMode: runtime.assistMode,
    crashedBodyName: runtime.crashedBodyName,
    getAssistTarget,
    getAutopilotTurn,
    getCaptureMetrics,
    getCircularizePlan,
    keyboardInput,
    maxControlWarp: 100,
    physicsEngine,
    realDt,
    shouldCaptureBurn,
    state: runtime.state,
    targetHeading: runtime.targetHeading,
    timeWarpIndex: runtime.timeWarpIndex,
    timeWarps,
  });
  runtime.assistMode = simulationStep.assistMode;
  runtime.crashedBodyName = simulationStep.crashedBodyName;
  runtime.state = simulationStep.state;
  runtime.targetHeading = simulationStep.targetHeading;
  runtime.timeWarpIndex = simulationStep.timeWarpIndex;

  updateRipples(ripples, realDt);
  runtimeActions.updateCamera();
  const predictionConfig = getPredictionConfig();
  trajectoryPredictionRuntime.maybeRefresh(realDt, {
    assistMode: runtime.assistMode,
    coastPredictionHorizonSeconds: getCoastPredictionHorizonSeconds(),
    debugModeEnabled: runtime.debugModeEnabled,
    debugNoGravityEnabled: runtime.debugNoGravityEnabled,
    gameScene,
    getAssistPredictionControls,
    getAssistTarget,
    getCaptureMetrics,
    physicsEngine,
    predictionConfig,
    state: runtime.state,
  });
  const predictionState = trajectoryPredictionRuntime.getState();
  if (runtime.assistMode !== "off") {
    gameScene.assistedPredictionMaterial.color.set(runtime.assistMode === "capture" ? 0xf59e0b : 0xfacc15);
  }
  updateWorldVisuals({
    bodies: runtime.state.bodies,
    defaultViewport,
    gameScene,
    spacecraft: runtime.state.spacecraft,
    spacecraftModelZoomThreshold,
    viewportSize: runtime.viewportSize,
  });
  updateSpacecraftTrail({
    gameScene,
    isThrusting,
    spacecraft: runtime.state.spacecraft,
  });
  updateTargetRelativePredictionVisuals({
    debugModeEnabled: runtime.debugModeEnabled,
    gameScene,
    predictedImpact: predictionState.predictedImpact,
    target: getAssistTarget(),
    targetRelativeAssistedPoints: predictionState.targetRelativeAssistedPoints,
    targetRelativePredictionEnd: predictionState.targetRelativePredictionEnd,
    targetRelativePredictionPoints: predictionState.targetRelativePredictionPoints,
    viewportHeight: window.innerHeight,
    viewportSize: runtime.viewportSize,
  });
  updateCircularizationVisuals({
    circularizePlan: runtime.assistMode === "circularize" && !runtime.crashedBodyName ? getCircularizePlan(getAssistTarget()) : null,
    gameScene,
    spacecraftPosition: runtime.state.spacecraft.position,
    target: runtime.assistMode === "circularize" && !runtime.crashedBodyName ? getAssistTarget() : null,
    viewportSize: runtime.viewportSize,
  });
  updateSpacecraftCallout({
    camera: gameScene.camera,
    defaultViewport,
    isThrusting,
    overlayUi,
    pointerScreenPosition: pointerCameraInput.pointerScreenPosition,
    renderPosition,
    spacecraft: runtime.state.spacecraft,
    spacecraftLabelIntroUntil: runtime.spacecraftLabelIntroUntil,
    spacecraftModelZoomThreshold,
    viewportSize: runtime.viewportSize,
  });
  updateOffscreenIndicators({
    bodies: runtime.state.bodies,
    camera: gameScene.camera,
    overlayUi,
    renderPosition,
    spacecraftPosition: runtime.state.spacecraft.position,
  });
  updateBodyLabels({
    bodies: runtime.state.bodies,
    camera: gameScene.camera,
    overlayUi,
    renderPosition,
    viewportSize: runtime.viewportSize,
  });
  updateHud();
  updateFpsIndicator(overlayUi, runtime.debugModeEnabled && runtime.fpsIndicatorEnabled, smoothedFps);
  rendererProfiler.render(gameScene.scene, gameScene.camera, runtime.performanceDebugEnabled);

  smoothedCpuMs = THREE.MathUtils.lerp(smoothedCpuMs, performance.now() - frameStart, 0.15);
  requestAnimationFrame(animate);
};

const refreshTrajectoryPrediction = () => {
  trajectoryPredictionRuntime.refresh({
    assistMode: runtime.assistMode,
    coastPredictionHorizonSeconds: getCoastPredictionHorizonSeconds(),
    debugModeEnabled: runtime.debugModeEnabled,
    debugNoGravityEnabled: runtime.debugNoGravityEnabled,
    gameScene,
    getAssistPredictionControls,
    getAssistTarget,
    getCaptureMetrics,
    physicsEngine,
    predictionConfig: getPredictionConfig(),
    state: runtime.state,
  });
};
bindKeyboardShortcuts({
  autoDiscoverStrongestInfluence: appSettings.assistTarget.autoDiscoverStrongestInfluence,
  getDebugModeEnabled: () => runtime.debugModeEnabled,
  handleAction: (action) => {
    const result = runtimeActions.handleKeyboardShortcutAction(action);
    if (result.refreshTrajectoryPrediction) {
      refreshTrajectoryPrediction();
    }
  },
  keyboardInput,
  windowTarget: window,
});

runtimeActions.updateCamera();
updateWorldVisuals({
  bodies: runtime.state.bodies,
  defaultViewport,
  gameScene,
  spacecraft: runtime.state.spacecraft,
  spacecraftModelZoomThreshold,
  viewportSize: runtime.viewportSize,
});
updateSpacecraftTrail({
  gameScene,
  isThrusting: runtime.state.controls.main > 0 && runtime.state.spacecraft.fuel > 0,
  spacecraft: runtime.state.spacecraft,
});
updateHud();
requestAnimationFrame(animate);

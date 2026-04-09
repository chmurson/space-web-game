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
  shouldCircularizeBurn,
  type AssistMode,
} from "./assist/orbitalAssist";
import { gameConfig } from "./config/gameConfig";
import {
  getTrajectoryPredictionConfig,
  predictAssistedTrajectory,
  predictCoastTrajectory,
  type PredictedClosestApproach,
  type PredictedImpact,
} from "./prediction/trajectoryPrediction";
import { createKeyboardInput } from "./input/keyboardInput";
import { bindPointerCameraInput } from "./input/pointerCameraInput";
import { getKeyboardShortcutAction, type KeyboardShortcutAction } from "./input/keyboardShortcuts";
import {
  renderPosition,
  updateCameraView,
  updateCircularizationVisuals,
  updateInertialPredictionVisual,
  updateSpacecraftTrail,
  updateTargetRelativePredictionVisuals,
  updateWorldVisuals,
} from "./render/sceneUpdates";
import { createGameScene } from "./scene/createGameScene";
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  loadDebugRuntimeScenario,
  saveRuntimeDebugSnapshot,
  type RuntimeScenarioOptions,
} from "./scenario/runtimeScenario";
import { getBodyInfluences } from "./simulation/bodyInfluence";
import { RENDER_SCALE } from "./simulation/constants";
import { defaultPhysicsEngine, physicsEngines } from "./simulation/physics";
import { idleControls } from "./simulation/state";
import type { Body, ControlInput, SimulationState } from "./simulation/types";
import { add, fromAngle, length, normalize, scale, sub } from "./simulation/vector";
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
let timeWarpIndex = 0;
const autopilotRotationRate = gameConfig.controls.autopilotRotationRate;
let assistTargetIndex = 1;
let assistMode: AssistMode = "off";
let debugModeEnabled = userSettings.debugModeEnabled;
let debugNoGravityEnabled = false;
let fpsIndicatorEnabled = false;
let performanceDebugEnabled = false;
let debugSnapshotStatus = "";
const defaultCoastPredictionHorizonHours = gameConfig.trajectory.horizon.defaultHours;
const minCoastPredictionHorizonHours = gameConfig.trajectory.horizon.minHours;
const maxCoastPredictionHorizonHours = gameConfig.trajectory.horizon.maxHours;
let crashedBodyName: string | null = null;
let predictedImpact: PredictedImpact | null = null;
let predictedTargetClosestApproach: PredictedClosestApproach | null = null;
let spacecraftLabelIntroUntil = performance.now() + 5_000;
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
let state: SimulationState = initialRuntimeScenarioState.state;
let coastPredictionHorizonHours = initialRuntimeScenarioState.coastPredictionHorizonHours;
let viewportSize = initialRuntimeScenarioState.viewportSize;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070d);
app.appendChild(renderer.domElement);
const gl = renderer.getContext() as WebGL2RenderingContext;
const gpuTimerExtension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
const pendingGpuQueries: WebGLQuery[] = [];

let targetRelativePredictionPoints: { x: number; y: number }[] = [];
let targetRelativeAssistedPoints: { x: number; y: number }[] = [];
let targetRelativePredictionEnd: { x: number; y: number } | null = null;
const gameScene = createGameScene(state.bodies, gameConfig.trajectory.rendering);
const ripples: Ripple[] = [];
let targetHeading: number | null = null;

const overlayUi = createOverlayUi({
  app,
  bodies: state.bodies,
  scenarioDescription: scenario.description,
  scenarioName: scenario.name,
  showCycleTargetHint: !appSettings.assistTarget.autoDiscoverStrongestInfluence,
});

const getAssistTarget = () =>
  getAssistTargetForState(state, {
    autoDiscoverStrongestInfluence: appSettings.assistTarget.autoDiscoverStrongestInfluence,
    selectedIndex: assistTargetIndex,
  });

const getAutopilotTurn = (desiredHeading: number) => getAutopilotTurnForHeading(state.spacecraft.heading, desiredHeading, autopilotRotationRate);

const getCaptureMetrics = (target: Body) => getCaptureMetricsForState(state, target);

const shouldCaptureBurn = (target: Body) => shouldCaptureBurnForMetrics(getCaptureMetrics(target));

const getCircularizePlan = (target: Body) => getCircularizePlanForState(state, target);

const getAssistPredictionControls = (simulationState: SimulationState, targetId: string): ControlInput =>
  getAssistPredictionControlsForState(simulationState, targetId, assistMode, autopilotRotationRate);

const getCoastPredictionHorizonSeconds = () => coastPredictionHorizonHours * 60 * 60;

const getPredictionConfig = () => {
  return getTrajectoryPredictionConfig(
    getCoastPredictionHorizonSeconds(),
    gameConfig.trajectory.sampling,
    gameConfig.trajectory.loopTrim.maxRevolutions,
  );
};

const updateControls = (): ControlInput => {
  if (crashedBodyName) {
    return idleControls();
  }

  const manualControls = keyboardInput.getManualControls();
  let main = manualControls.main;
  const manualTurn = manualControls.turn;
  let turn = manualTurn;

  if (manualTurn !== 0) {
    targetHeading = null;
    assistMode = "off";
  } else if (assistMode === "capture") {
    const target = getAssistTarget();
    const relativeVelocity = sub(state.spacecraft.velocity, target.velocity);
    const desiredHeading = Math.atan2(-relativeVelocity.y, -relativeVelocity.x);
    turn = getAutopilotTurn(desiredHeading);

    if (shouldCaptureBurn(target)) {
      main = 1;
    }
  } else if (assistMode === "circularize") {
    const target = getAssistTarget();
    const plan = getCircularizePlan(target);
    const metrics = getCaptureMetrics(target);
    turn = getAutopilotTurn(plan.burnHeading);

    if (shouldCircularizeBurn(metrics, plan)) {
      main = 1;
    }
  } else if (targetHeading !== null) {
    turn = getAutopilotTurn(targetHeading);

    if (turn === 0) {
      targetHeading = null;
    }
  }

  return {
    main,
    reverse: manualControls.reverse,
    strafe: manualControls.strafe,
    turn,
  };
};

const capWarpForActiveControls = (controls: ControlInput) => {
  const maxControlWarp = 100;
  const usingManualTurn = keyboardInput.hasManualTurn();
  const usingControls = controls.main !== 0 || controls.reverse !== 0 || controls.strafe !== 0 || usingManualTurn;
  const maxControlWarpIndex = timeWarps.indexOf(maxControlWarp);

  if (usingControls && maxControlWarpIndex >= 0 && timeWarps[timeWarpIndex] > maxControlWarp) {
    timeWarpIndex = maxControlWarpIndex;
  }
};

const resetScenario = () => {
  const freshRuntimeScenarioState = createRuntimeScenarioState(createRequestedRuntimeScenario(requestedScenario), runtimeScenarioOptions);
  state = freshRuntimeScenarioState.state;
  viewportSize = freshRuntimeScenarioState.viewportSize;
  coastPredictionHorizonHours = freshRuntimeScenarioState.coastPredictionHorizonHours;
  gameScene.trailPoints.length = 0;
  targetHeading = null;
  assistMode = "off";
  crashedBodyName = null;
  spacecraftLabelIntroUntil = performance.now() + 5_000;
};

const saveDebugScenarioSnapshot = () => {
  if (saveRuntimeDebugSnapshot(state, { viewportSize, coastPredictionHorizonHours })) {
    debugSnapshotStatus = "snapshot saved; use [7] load or ?scenario=debug-snapshot";
  } else {
    debugSnapshotStatus = "snapshot save failed";
  }
};

const loadDebugScenarioSnapshot = () => {
  const loadedDebugScenario = loadDebugRuntimeScenario(runtimeScenarioOptions);
  if (!loadedDebugScenario) {
    debugSnapshotStatus = "no debug snapshot saved";
    return;
  }

  state = loadedDebugScenario.runtimeState.state;
  viewportSize = loadedDebugScenario.runtimeState.viewportSize;
  coastPredictionHorizonHours = loadedDebugScenario.runtimeState.coastPredictionHorizonHours;
  gameScene.trailPoints.length = 0;
  targetHeading = null;
  assistMode = "off";
  crashedBodyName = null;
  assistTargetIndex = Math.min(assistTargetIndex, Math.max(0, state.bodies.length - 1));
  spacecraftLabelIntroUntil = performance.now() + 5_000;
  debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`;
};

const setTargetHeading = (heading: number, clientX: number, clientY: number) => {
  targetHeading = heading;
  assistMode = "off";
  createRipple(app, ripples, clientX, clientY);
};

const updateCamera = () =>
  updateCameraView({
    cameraDistance,
    cameraElevation,
    gameScene,
    spacecraftPosition: state.spacecraft.position,
    viewportHeight: window.innerHeight,
    viewportSize,
    viewportWidth: window.innerWidth,
  });

const zoomCamera = (factor: number) => {
  viewportSize = THREE.MathUtils.clamp(viewportSize * factor, minViewport, maxViewport);
  updateCamera();
};

const pointerCameraInput = bindPointerCameraInput({
  camera: gameScene.camera,
  getSpacecraftPosition: () => state.spacecraft.position,
  onResize: () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCamera();
  },
  onTargetHeadingSelected: (heading, screenPosition) => {
    setTargetHeading(heading, screenPosition.x, screenPosition.y);
  },
  onZoom: (zoomFactor) => {
    zoomCamera(zoomFactor);
  },
  renderScale: RENDER_SCALE,
  rendererElement: renderer.domElement,
  windowTarget: window,
});

const updateTrajectoryPrediction = () => {
  const predictionConfig = getPredictionConfig();
  const initialTarget = getAssistTarget();
  const targetId = initialTarget.id;
  const allowLoopTrim = getCaptureMetrics(initialTarget).specificEnergy < 0;
  const coastPrediction = predictCoastTrajectory(state, physicsEngine, initialTarget, predictionConfig, allowLoopTrim);

  predictedImpact = coastPrediction.impact;
  predictedTargetClosestApproach = coastPrediction.closestApproach;
  targetRelativePredictionPoints = coastPrediction.relativePoints;
  targetRelativePredictionEnd = targetRelativePredictionPoints.at(-1) ?? null;

  if (assistMode === "off") {
    targetRelativeAssistedPoints = [];
    gameScene.assistedPredictionLine.visible = false;
    return;
  }

  gameScene.assistedPredictionMaterial.color.set(assistMode === "capture" ? 0xf59e0b : 0xfacc15);
  targetRelativeAssistedPoints = predictAssistedTrajectory(state, physicsEngine, targetId, predictionConfig, getAssistPredictionControls).relativePoints;
};

const updateHud = () => {
  const earth = state.bodies.find((body) => body.id === "earth") as Body;
  const relativeVelocity = sub(state.spacecraft.velocity, earth.velocity);
  const speed = length(relativeVelocity);
  const target = getAssistTarget();
  const targetMetrics = getCaptureMetrics(target);
  const circularizePlan = assistMode === "circularize" ? getCircularizePlan(target) : null;

  updateOverlayHud({
    assistMode,
    bodyInfluences: getBodyInfluences(state),
    circularizePlan,
    coastPredictionHorizonSeconds: getCoastPredictionHorizonSeconds(),
    crashedBodyName,
    debugModeEnabled,
    debugNoGravityEnabled,
    debugSnapshotStatus,
    defaultViewport,
    fpsIndicatorEnabled,
    fuelUsed: state.spacecraft.fuelUsed,
    overlayUi,
    performanceDebugEnabled,
    physicsEngineName: physicsEngine.name,
    predictedImpact,
    predictedTargetClosestApproach,
    predictionStepSeconds: getPredictionConfig().stepSeconds,
    smoothedCpuMs,
    smoothedGpuMs,
    speed,
    targetMetrics,
    targetName: target.name,
    timeWarp: timeWarps[timeWarpIndex] ?? 1,
    viewportSize,
  });
};

const detectCollision = () => state.bodies.find((body) => length(sub(state.spacecraft.position, body.position)) <= body.radius);

const stopOnCollision = (body: Body) => {
  const outward = normalize(sub(state.spacecraft.position, body.position));
  const fallback = fromAngle(state.spacecraft.heading);
  const normal = length(outward) > 0 ? outward : fallback;

  crashedBodyName = body.name;
  assistMode = "off";
  targetHeading = null;
  state = {
    ...state,
    controls: idleControls(),
    spacecraft: {
      ...state.spacecraft,
      position: add(body.position, scale(normal, body.radius)),
      velocity: { ...body.velocity },
    },
  };
};

const stepSimulation = (realDt: number) => {
  if (crashedBodyName) {
    state = {
      ...state,
      controls: idleControls(),
    };
    return;
  }

  const controls = updateControls();
  capWarpForActiveControls(controls);
  const timeWarp = timeWarps[timeWarpIndex] ?? 1;
  const physicsStep = 1;
  let remaining = Math.min(realDt * timeWarp, 3600);

  while (remaining > 0) {
    const dt = Math.min(physicsStep, remaining);
    state = {
      ...state,
      controls: updateControls(),
    };
    state = physicsEngine.step(state, dt);
    const collision = detectCollision();
    if (collision) {
      stopOnCollision(collision);
      break;
    }
    remaining -= dt;
  }

  state = {
    ...state,
    controls: updateControls(),
  };
};

let lastTime = performance.now();
let predictionRefreshElapsed = 0;
let smoothedFps = 60;
let smoothedCpuMs = 0;
let smoothedGpuMs: number | null = null;

const animate = (time: number) => {
  const frameStart = performance.now();
  const realDt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  smoothedFps = THREE.MathUtils.lerp(smoothedFps, 1 / Math.max(realDt, 1 / 240), 0.12);
  const isThrusting = state.controls.main > 0 && state.spacecraft.fuel > 0;

  stepSimulation(realDt);
  updateRipples(ripples, realDt);
  updateCamera();
  predictionRefreshElapsed += realDt;
  if (predictionRefreshElapsed >= getPredictionConfig().refreshInterval) {
    updateTrajectoryPrediction();
    updateInertialPredictionVisual({
      enabled: debugModeEnabled && debugNoGravityEnabled,
      gameScene,
      predictionSeconds: Math.min(getCoastPredictionHorizonSeconds() * 0.3, 90 * 60),
      spacecraftPosition: state.spacecraft.position,
      spacecraftVelocity: state.spacecraft.velocity,
    });
    predictionRefreshElapsed = 0;
  }
  updateWorldVisuals({
    bodies: state.bodies,
    defaultViewport,
    gameScene,
    spacecraft: state.spacecraft,
    spacecraftModelZoomThreshold,
    viewportSize,
  });
  updateSpacecraftTrail({
    gameScene,
    isThrusting,
    spacecraft: state.spacecraft,
  });
  updateTargetRelativePredictionVisuals({
    debugModeEnabled,
    gameScene,
    predictedImpact,
    target: getAssistTarget(),
    targetRelativeAssistedPoints,
    targetRelativePredictionEnd,
    targetRelativePredictionPoints,
    viewportHeight: window.innerHeight,
    viewportSize,
  });
  updateCircularizationVisuals({
    circularizePlan: assistMode === "circularize" && !crashedBodyName ? getCircularizePlan(getAssistTarget()) : null,
    gameScene,
    spacecraftPosition: state.spacecraft.position,
    target: assistMode === "circularize" && !crashedBodyName ? getAssistTarget() : null,
    viewportSize,
  });
  updateSpacecraftCallout({
    camera: gameScene.camera,
    defaultViewport,
    isThrusting,
    overlayUi,
    pointerScreenPosition: pointerCameraInput.pointerScreenPosition,
    renderPosition,
    spacecraft: state.spacecraft,
    spacecraftLabelIntroUntil,
    spacecraftModelZoomThreshold,
    viewportSize,
  });
  updateOffscreenIndicators({
    bodies: state.bodies,
    camera: gameScene.camera,
    overlayUi,
    renderPosition,
    spacecraftPosition: state.spacecraft.position,
  });
  updateBodyLabels({
    bodies: state.bodies,
    camera: gameScene.camera,
    overlayUi,
    renderPosition,
    viewportSize,
  });
  updateHud();
  updateFpsIndicator(overlayUi, debugModeEnabled && fpsIndicatorEnabled, smoothedFps);

  if (performanceDebugEnabled && gpuTimerExtension) {
    const disjoint = gl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT) as boolean;
    if (!disjoint) {
      const query = gl.createQuery();
      if (query) {
        gl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, query);
        renderer.render(gameScene.scene, gameScene.camera);
        gl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT);
        pendingGpuQueries.push(query);
      } else {
        renderer.render(gameScene.scene, gameScene.camera);
      }
    } else {
      renderer.render(gameScene.scene, gameScene.camera);
    }
  } else {
    renderer.render(gameScene.scene, gameScene.camera);
  }

  if (performanceDebugEnabled && gpuTimerExtension) {
    while (pendingGpuQueries.length > 0) {
      const query = pendingGpuQueries[0];
      const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) as boolean;
      const disjoint = gl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT) as boolean;

      if (!available || disjoint) {
        break;
      }

      const elapsedNanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
      smoothedGpuMs = smoothedGpuMs === null ? elapsedNanoseconds / 1_000_000 : THREE.MathUtils.lerp(smoothedGpuMs, elapsedNanoseconds / 1_000_000, 0.2);
      gl.deleteQuery(query);
      pendingGpuQueries.shift();
    }
  } else {
    smoothedGpuMs = null;
  }

  smoothedCpuMs = THREE.MathUtils.lerp(smoothedCpuMs, performance.now() - frameStart, 0.15);
  requestAnimationFrame(animate);
};

const refreshTrajectoryPrediction = () => {
  updateTrajectoryPrediction();
  updateInertialPredictionVisual({
    enabled: debugModeEnabled && debugNoGravityEnabled,
    gameScene,
    predictionSeconds: Math.min(getCoastPredictionHorizonSeconds() * 0.3, 90 * 60),
    spacecraftPosition: state.spacecraft.position,
    spacecraftVelocity: state.spacecraft.velocity,
  });
  predictionRefreshElapsed = 0;
};

const handleKeyboardShortcutAction = (action: KeyboardShortcutAction) => {
  if (action === "increaseTimeWarp") {
    timeWarpIndex = Math.min(timeWarpIndex + 1, timeWarps.length - 1);
    return;
  }
  if (action === "decreaseTimeWarp") {
    timeWarpIndex = Math.max(timeWarpIndex - 1, 0);
    return;
  }
  if (action === "resetScenario") {
    resetScenario();
    return;
  }
  if (action === "cycleAssistTarget") {
    assistTargetIndex = (assistTargetIndex + 1) % state.bodies.length;
    return;
  }
  if (action === "cycleAssistMode") {
    assistMode = assistMode === "off" ? "capture" : assistMode === "capture" ? "circularize" : "off";
    targetHeading = null;
    return;
  }
  if (action === "toggleDebugMode") {
    debugModeEnabled = !debugModeEnabled;
    updateUserSettings({ debugModeEnabled });
    return;
  }
  if (action === "toggleNoGravityDebug") {
    debugNoGravityEnabled = !debugNoGravityEnabled;
    return;
  }
  if (action === "toggleFpsIndicator") {
    fpsIndicatorEnabled = !fpsIndicatorEnabled;
    return;
  }
  if (action === "togglePerformanceDebug") {
    performanceDebugEnabled = !performanceDebugEnabled;
    return;
  }
  if (action === "decreaseCoastHorizon") {
    coastPredictionHorizonHours = Math.max(minCoastPredictionHorizonHours, coastPredictionHorizonHours / 2);
    refreshTrajectoryPrediction();
    return;
  }
  if (action === "increaseCoastHorizon") {
    coastPredictionHorizonHours = Math.min(maxCoastPredictionHorizonHours, coastPredictionHorizonHours * 2);
    refreshTrajectoryPrediction();
    return;
  }
  if (action === "saveDebugSnapshot") {
    saveDebugScenarioSnapshot();
    return;
  }
  if (action === "loadDebugSnapshot") {
    loadDebugScenarioSnapshot();
    return;
  }
  if (action === "zoomIn") {
    zoomCamera(0.82);
    return;
  }
  if (action === "zoomOut") {
    zoomCamera(1.22);
  }
};

window.addEventListener("keydown", (event) => {
  keyboardInput.press(event.code);

  const shortcutAction = getKeyboardShortcutAction(event, {
    autoDiscoverStrongestInfluence: appSettings.assistTarget.autoDiscoverStrongestInfluence,
    debugModeEnabled,
  });
  if (shortcutAction) {
    handleKeyboardShortcutAction(shortcutAction);
  }
});

window.addEventListener("keyup", (event) => {
  keyboardInput.release(event.code);
});

updateCamera();
updateWorldVisuals({
  bodies: state.bodies,
  defaultViewport,
  gameScene,
  spacecraft: state.spacecraft,
  spacecraftModelZoomThreshold,
  viewportSize,
});
updateSpacecraftTrail({
  gameScene,
  isThrusting: state.controls.main > 0 && state.spacecraft.fuel > 0,
  spacecraft: state.spacecraft,
});
updateHud();
requestAnimationFrame(animate);

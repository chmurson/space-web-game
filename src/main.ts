import "./style.css";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
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
import { updateColoredLine2Geometry, updateLine2Geometry } from "./rendering/line2Geometry";
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
import { formatDistance } from "./ui/formatters";
import { getDebugPanelLines, getGuidanceText } from "./ui/hudText";
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
const {
  assistedPredictionLine,
  assistedPredictionMaterial,
  bodyMeshes,
  camera,
  cameraTarget,
  circularOrbitGeometry,
  circularOrbitLine,
  circularOrbitMaterial,
  desiredVelocityGeometry,
  desiredVelocityLine,
  desiredVelocityMaterial,
  engineGlow,
  impactGradientLine,
  impactGradientMaterial,
  inertialPredictionGeometry,
  inertialPredictionLine,
  inertialPredictionMaterial,
  predictionDashPixels,
  predictionEndMarker,
  predictionEndMarkerFill,
  predictionEndMarkerMinScreenRadius,
  predictionEndMarkerRadius,
  predictionGapPixels,
  predictionLine,
  predictionMaterial,
  replacePredictionLineGeometryOnUpdate,
  scene,
  spacecraftMarker,
  spacecraftMesh,
  trail,
  trailPoints,
} = gameScene;
let predictionGeometry = gameScene.predictionGeometry;
let impactGradientGeometry = gameScene.impactGradientGeometry;
let assistedPredictionGeometry = gameScene.assistedPredictionGeometry;

type Ripple = {
  element: HTMLElement;
  age: number;
};

const ripples: Ripple[] = [];
let targetHeading: number | null = null;

const {
  bodyLabels,
  debugPanel,
  fpsIndicator,
  offscreenIndicators,
  spacecraftCallout,
  spacecraftCalloutLabel,
  spacecraftIconThrust,
  statAssist,
  statEngine,
  statFuel,
  statGuidance,
  statSpeed,
  statTarget,
  statTargetSpeed,
  statWarp,
  statZoom,
} = createOverlayUi({
  app,
  bodies: state.bodies,
  scenarioDescription: scenario.description,
  scenarioName: scenario.name,
  showCycleTargetHint: !appSettings.assistTarget.autoDiscoverStrongestInfluence,
});

const renderPosition = (x: number, y: number, lift = 0) => new THREE.Vector3(x * RENDER_SCALE, lift, y * RENDER_SCALE);

const applyTargetRelativePredictionLine = (
  relativePoints: { x: number; y: number }[],
  geometry: LineGeometry,
  line: Line2,
  lift: number,
) => {
  if (relativePoints.length === 0) {
    line.visible = false;
    return geometry;
  }

  const target = getAssistTarget();
  const positions: number[] = [];

  for (const point of relativePoints) {
    const renderedPoint = renderPosition(target.position.x + point.x, target.position.y + point.y, lift);
    positions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
  }

  return updateLine2Geometry(line, geometry, positions, {
    replaceGeometryOnUpdate: replacePredictionLineGeometryOnUpdate,
  });
};

const updateTargetRelativePredictionVisuals = () => {
  const gradientPointCount = Math.min(18, targetRelativePredictionPoints.length);
  const hasImpactGradient = Boolean(predictedImpact) && targetRelativePredictionPoints.length >= 3;

  predictionGeometry = applyTargetRelativePredictionLine(targetRelativePredictionPoints, predictionGeometry, predictionLine, 0.18);
  assistedPredictionGeometry = applyTargetRelativePredictionLine(targetRelativeAssistedPoints, assistedPredictionGeometry, assistedPredictionLine, 0.2);

  if (!targetRelativePredictionEnd) {
    predictionEndMarker.visible = false;
    impactGradientLine.visible = false;
    return;
  }

  const target = getAssistTarget();
  predictionEndMarker.position.copy(renderPosition(target.position.x + targetRelativePredictionEnd.x, target.position.y + targetRelativePredictionEnd.y, 0.18));
  predictionEndMarker.quaternion.copy(camera.quaternion);
  const markerRadius = Math.max(predictionEndMarkerRadius, predictionEndMarkerMinScreenRadius * (viewportSize / window.innerHeight));
  predictionEndMarker.scale.setScalar(markerRadius);
  predictionEndMarkerFill.material.color.set(predictedImpact ? "#ef4444" : "#67e8f9");
  predictionEndMarker.visible = debugModeEnabled || Boolean(predictedImpact);

  if (!hasImpactGradient) {
    impactGradientLine.visible = false;
    return;
  }

  const gradientPoints = targetRelativePredictionPoints.slice(-gradientPointCount);
  const gradientPositions: number[] = [];
  const gradientColors: number[] = [];
  const startColor = new THREE.Color("#67e8f9");
  const endColor = new THREE.Color("#ef4444");

  for (let index = 0; index < gradientPoints.length; index += 1) {
    const point = gradientPoints[index];
    const renderedPoint = renderPosition(target.position.x + point.x, target.position.y + point.y, 0.19);
    const blend = index / Math.max(gradientPoints.length - 1, 1);
    const color = startColor.clone().lerp(endColor, blend);

    gradientPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
    gradientColors.push(color.r, color.g, color.b);
  }

  impactGradientGeometry = updateColoredLine2Geometry(impactGradientLine, impactGradientGeometry, gradientPositions, gradientColors, {
    replaceGeometryOnUpdate: replacePredictionLineGeometryOnUpdate,
  });
};

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
  trailPoints.length = 0;
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
  trailPoints.length = 0;
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
  createRipple(clientX, clientY);
};

const updateCamera = () => {
  const target = renderPosition(state.spacecraft.position.x, state.spacecraft.position.y);
  cameraTarget.set(target.x, 0, target.z);

  camera.left = -viewportSize * (window.innerWidth / window.innerHeight) * 0.5;
  camera.right = viewportSize * (window.innerWidth / window.innerHeight) * 0.5;
  camera.top = viewportSize * 0.5;
  camera.bottom = -viewportSize * 0.5;

  const horizontal = Math.cos(cameraElevation) * cameraDistance;
  const vertical = Math.sin(cameraElevation) * cameraDistance;
  camera.position.set(cameraTarget.x + horizontal, vertical, cameraTarget.z + horizontal);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
  predictionMaterial.resolution.set(window.innerWidth, window.innerHeight);
  impactGradientMaterial.resolution.set(window.innerWidth, window.innerHeight);
  inertialPredictionMaterial.resolution.set(window.innerWidth, window.innerHeight);
  assistedPredictionMaterial.resolution.set(window.innerWidth, window.innerHeight);
  circularOrbitMaterial.resolution.set(window.innerWidth, window.innerHeight);
  desiredVelocityMaterial.resolution.set(window.innerWidth, window.innerHeight);
  const renderUnitsPerPixel = viewportSize / window.innerHeight;
  predictionMaterial.dashSize = renderUnitsPerPixel * predictionDashPixels;
  predictionMaterial.gapSize = renderUnitsPerPixel * predictionGapPixels;
  impactGradientMaterial.dashSize = renderUnitsPerPixel * predictionDashPixels;
  impactGradientMaterial.gapSize = renderUnitsPerPixel * predictionGapPixels;
  inertialPredictionMaterial.dashSize = renderUnitsPerPixel * predictionDashPixels;
  inertialPredictionMaterial.gapSize = renderUnitsPerPixel * predictionGapPixels;
  assistedPredictionMaterial.dashSize = renderUnitsPerPixel * predictionDashPixels;
  assistedPredictionMaterial.gapSize = renderUnitsPerPixel * predictionGapPixels;
};

const updateCircularizationVisuals = () => {
  if (assistMode !== "circularize" || crashedBodyName) {
    circularOrbitLine.visible = false;
    desiredVelocityLine.visible = false;
    return;
  }

  const target = getAssistTarget();
  const plan = getCircularizePlan(target);
  const targetPosition = renderPosition(target.position.x, target.position.y, 0.11);
  const orbitRadius = plan.distance * RENDER_SCALE;
  const orbitPoints: number[] = [];
  const segments = 128;

  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    orbitPoints.push(targetPosition.x + Math.cos(angle) * orbitRadius, 0.11, targetPosition.z + Math.sin(angle) * orbitRadius);
  }

  circularOrbitGeometry.setPositions(orbitPoints);
  circularOrbitLine.computeLineDistances();
  circularOrbitLine.visible = true;

  const spacecraftPosition = renderPosition(state.spacecraft.position.x, state.spacecraft.position.y, 0.16);
  const arrowLength = THREE.MathUtils.clamp(orbitRadius * 0.2, 1.5, viewportSize * 0.16);
  const desiredDirection = fromAngle(plan.desiredVelocityHeading);
  const desiredEnd = {
    x: spacecraftPosition.x + desiredDirection.x * arrowLength,
    z: spacecraftPosition.z + desiredDirection.y * arrowLength,
  };

  desiredVelocityGeometry.setPositions([spacecraftPosition.x, 0.16, spacecraftPosition.z, desiredEnd.x, 0.16, desiredEnd.z]);
  desiredVelocityLine.computeLineDistances();
  desiredVelocityLine.visible = true;
};

const zoomCamera = (factor: number) => {
  viewportSize = THREE.MathUtils.clamp(viewportSize * factor, minViewport, maxViewport);
  updateCamera();
};

const pointerCameraInput = bindPointerCameraInput({
  camera,
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

const updateMeshes = () => {
  const useSymbolicShip = viewportSize > defaultViewport / spacecraftModelZoomThreshold;

  for (const body of state.bodies) {
    const mesh = bodyMeshes.get(body.id);
    if (mesh) {
      mesh.position.copy(renderPosition(body.position.x, body.position.y));
    }
  }

  spacecraftMesh.position.copy(renderPosition(state.spacecraft.position.x, state.spacecraft.position.y, 1.2));
  spacecraftMesh.rotation.y = -state.spacecraft.heading + Math.PI / 2;
  spacecraftMesh.visible = !useSymbolicShip;
  spacecraftMarker.position.copy(renderPosition(state.spacecraft.position.x, state.spacecraft.position.y, 1.1));
  spacecraftMarker.scale.setScalar(Math.max(1, viewportSize / 520));
  spacecraftMarker.visible = !useSymbolicShip;
  spacecraftCallout.style.setProperty("--dot-opacity", useSymbolicShip ? "1" : "0");

  const thrusting = state.controls.main > 0 && state.spacecraft.fuel > 0;
  const glowMaterial = engineGlow.material;
  glowMaterial.opacity = thrusting ? 0.8 : 0;

  const trailPosition = renderPosition(state.spacecraft.position.x, state.spacecraft.position.y, 0.35);
  const lastPoint = trailPoints.at(-1);
  if (!lastPoint || lastPoint.distanceToSquared(trailPosition) > 4) {
    trailPoints.push(trailPosition);
    if (trailPoints.length > 450) {
      trailPoints.shift();
    }
    trail.geometry.dispose();
    trail.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  }
};

const createRipple = (screenX: number, screenY: number) => {
  const ripple = document.createElement("div");
  ripple.className = "map-ripple";
  ripple.style.left = `${screenX}px`;
  ripple.style.top = `${screenY}px`;
  ripple.innerHTML = "<span></span><span></span><span></span>";
  app.appendChild(ripple);
  ripples.push({ element: ripple, age: 0 });
};

const updateRipples = (dt: number) => {
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
  predictionGeometry = applyTargetRelativePredictionLine(targetRelativePredictionPoints, predictionGeometry, predictionLine, 0.18);

  if (assistMode === "off") {
    targetRelativeAssistedPoints = [];
    assistedPredictionLine.visible = false;
    return;
  }

  assistedPredictionMaterial.color.set(assistMode === "capture" ? 0xf59e0b : 0xfacc15);
  targetRelativeAssistedPoints = predictAssistedTrajectory(state, physicsEngine, targetId, predictionConfig, getAssistPredictionControls).relativePoints;
  assistedPredictionGeometry = applyTargetRelativePredictionLine(targetRelativeAssistedPoints, assistedPredictionGeometry, assistedPredictionLine, 0.2);
};

const updateInertialPrediction = () => {
  if (!(debugModeEnabled && debugNoGravityEnabled)) {
    inertialPredictionLine.visible = false;
    return;
  }

  const predictionSeconds = Math.min(getCoastPredictionHorizonSeconds() * 0.3, 90 * 60);
  const steps = 64;
  const points: number[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const t = (predictionSeconds * step) / steps;
    const x = state.spacecraft.position.x + state.spacecraft.velocity.x * t;
    const y = state.spacecraft.position.y + state.spacecraft.velocity.y * t;
    const point = renderPosition(x, y, 0.14);
    points.push(point.x, point.y, point.z);
  }

  inertialPredictionGeometry.setPositions(points);
  inertialPredictionLine.computeLineDistances();
  inertialPredictionLine.visible = true;
};

const updateCallout = () => {
  const position = renderPosition(state.spacecraft.position.x, state.spacecraft.position.y, 1.2);
  position.project(camera);

  const screenX = (position.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight;
  const isVisible = position.z > -1 && position.z < 1;
  const useSymbolicShip = viewportSize > defaultViewport / spacecraftModelZoomThreshold;
  const showLabel =
    performance.now() < spacecraftLabelIntroUntil ||
    Math.hypot(pointerCameraInput.pointerScreenPosition.x - screenX, pointerCameraInput.pointerScreenPosition.y - screenY) < 28;

  if (!isVisible) {
    spacecraftCallout.style.display = "none";
    spacecraftIconThrust.style.display = "none";
    return;
  }

  spacecraftCallout.style.display = useSymbolicShip || showLabel ? "flex" : "none";
  spacecraftCallout.style.left = `${screenX}px`;
  spacecraftCallout.style.top = `${screenY}px`;
  if (spacecraftCalloutLabel) {
    spacecraftCalloutLabel.style.display = showLabel ? "inline-block" : "none";
  }

  const forward = fromAngle(state.spacecraft.heading);
  const forwardPosition = renderPosition(state.spacecraft.position.x + forward.x * 1_000_000, state.spacecraft.position.y + forward.y * 1_000_000, 1.2);
  forwardPosition.project(camera);
  const forwardX = (forwardPosition.x * 0.5 + 0.5) * window.innerWidth;
  const forwardY = (-forwardPosition.y * 0.5 + 0.5) * window.innerHeight;
  const headingAngle = Math.atan2(forwardY - screenY, forwardX - screenX);

  spacecraftCallout.style.setProperty("--ship-heading", `${headingAngle}rad`);

  const iconThrustVisible = viewportSize > defaultViewport / spacecraftModelZoomThreshold && state.controls.main > 0 && state.spacecraft.fuel > 0;
  spacecraftIconThrust.style.display = iconThrustVisible ? "block" : "none";
  if (iconThrustVisible) {
    const backOffset = 8;
    spacecraftIconThrust.style.left = `${screenX - Math.cos(headingAngle) * backOffset}px`;
    spacecraftIconThrust.style.top = `${screenY - Math.sin(headingAngle) * backOffset}px`;
    spacecraftIconThrust.style.transform = `translate(-50%, -50%) rotate(${headingAngle}rad)`;
  }
};

const updateOffscreenIndicators = () => {
  const edgePadding = 28;
  const screenCenterX = window.innerWidth * 0.5;
  const screenCenterY = window.innerHeight * 0.5;

  for (const body of state.bodies) {
    const indicator = offscreenIndicators.get(body.id);
    if (!indicator) {
      continue;
    }

    const position = renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(camera);

    const isVisible = position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z > -1 && position.z < 1;

    if (isVisible) {
      indicator.style.display = "none";
      continue;
    }

    const projectedX = (position.x * 0.5 + 0.5) * window.innerWidth;
    const projectedY = (-position.y * 0.5 + 0.5) * window.innerHeight;
    const direction = Math.atan2(projectedY - screenCenterY, projectedX - screenCenterX);
    const distance = Math.max(0, length(sub(body.position, state.spacecraft.position)) - body.radius);
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

const updateBodyLabels = () => {
  const labelRadiusThreshold = 24;
  const pixelsPerRenderUnit = window.innerHeight / viewportSize;

  for (const body of state.bodies) {
    const label = bodyLabels.get(body.id);
    if (!label) {
      continue;
    }

    const apparentRadius = body.radius * RENDER_SCALE * pixelsPerRenderUnit;
    const position = renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(camera);
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

const updateHud = () => {
  const earth = state.bodies.find((body) => body.id === "earth") as Body;
  const relativeVelocity = sub(state.spacecraft.velocity, earth.velocity);
  const speed = length(relativeVelocity);

  if (statEngine) {
    statEngine.textContent = physicsEngine.name;
  }
  if (statWarp) {
    statWarp.textContent = `${timeWarps[timeWarpIndex]}x`;
  }
  if (statSpeed) {
    statSpeed.textContent = `${speed.toFixed(0)} m/s`;
  }
  if (statFuel) {
    statFuel.textContent = `${state.spacecraft.fuelUsed.toFixed(1)} kg`;
  }
  if (statZoom) {
    statZoom.textContent = `${(defaultViewport / viewportSize).toFixed(1)}x`;
  }
  const target = getAssistTarget();
  const targetMetrics = getCaptureMetrics(target);
  const targetRelativeSpeed = targetMetrics.relativeSpeed;
  const circularizePlan = assistMode === "circularize" ? getCircularizePlan(target) : null;
  if (statTarget) {
    statTarget.textContent = target.name;
  }
  if (statTargetSpeed) {
    statTargetSpeed.textContent = `${targetRelativeSpeed.toFixed(0)} m/s`;
  }
  if (statAssist) {
    statAssist.textContent = crashedBodyName ? "Crashed" : assistMode === "capture" ? "Capture" : assistMode === "circularize" ? "Circularize" : "Off";
  }
  if (statGuidance) {
    statGuidance.textContent = getGuidanceText({
      assistMode,
      circularizePlan,
      crashedBodyName,
      predictedImpact,
      predictedTargetClosestApproach,
      targetMetrics,
    });
  }
  debugPanel.element.style.display = debugModeEnabled ? "block" : "none";
  if (debugModeEnabled) {
    debugPanel.setText(
      getDebugPanelLines({
        assistMode,
        bodyInfluences: getBodyInfluences(state),
        coastPredictionHorizonSeconds: getCoastPredictionHorizonSeconds(),
        debugNoGravityEnabled,
        debugSnapshotStatus,
        fpsIndicatorEnabled,
        performanceDebugEnabled,
        predictionStepSeconds: getPredictionConfig().stepSeconds,
        predictedImpact,
        predictedTargetClosestApproach,
        smoothedCpuMs,
        smoothedGpuMs,
        targetMetrics,
        targetName: target.name,
      }).join("\n"),
    );
    debugPanel.setJson(null);
  }
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

  stepSimulation(realDt);
  updateRipples(realDt);
  updateCamera();
  predictionRefreshElapsed += realDt;
  if (predictionRefreshElapsed >= getPredictionConfig().refreshInterval) {
    updateTrajectoryPrediction();
    updateInertialPrediction();
    predictionRefreshElapsed = 0;
  }
  updateMeshes();
  updateTargetRelativePredictionVisuals();
  updateCircularizationVisuals();
  updateCallout();
  updateOffscreenIndicators();
  updateBodyLabels();
  updateHud();
  fpsIndicator.style.display = debugModeEnabled && fpsIndicatorEnabled ? "block" : "none";
  fpsIndicator.textContent = `FPS ${smoothedFps.toFixed(1)}`;

  if (performanceDebugEnabled && gpuTimerExtension) {
    const disjoint = gl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT) as boolean;
    if (!disjoint) {
      const query = gl.createQuery();
      if (query) {
        gl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, query);
        renderer.render(scene, camera);
        gl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT);
        pendingGpuQueries.push(query);
      } else {
        renderer.render(scene, camera);
      }
    } else {
      renderer.render(scene, camera);
    }
  } else {
    renderer.render(scene, camera);
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
  updateInertialPrediction();
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
updateMeshes();
updateHud();
requestAnimationFrame(animate);

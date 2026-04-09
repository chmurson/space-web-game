import "./style.css";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { appSettings } from "./appSettings";
import {
  createScenarioFromSnapshot,
  createSnapshotFromState,
  readDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
  type RuntimeScenario,
} from "./debugScenarioSnapshot";
import { G, RENDER_SCALE } from "./simulation/constants";
import { defaultPhysicsEngine, physicsEngines } from "./simulation/physics";
import { createEarthMoonScenario, createMoonCaptureDebugScenario } from "./simulation/scenarios/earthMoon";
import { cloneSimulationState, idleControls } from "./simulation/state";
import type { Body, ControlInput, SimulationState } from "./simulation/types";
import { add, fromAngle, length, lengthSq, normalize, scale, sub } from "./simulation/vector";
import { readUserSettings, updateUserSettings } from "./userSettingsStorage";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}

const urlParams = new URLSearchParams(window.location.search);
const requestedEngine = urlParams.get("engine") ?? "";
const physicsEngine = physicsEngines[requestedEngine] ?? defaultPhysicsEngine;
const requestedScenario = urlParams.get("scenario") ?? "earth-moon";

const createScenario = (): RuntimeScenario => {
  if (requestedScenario === "moon-capture-debug") {
    return createMoonCaptureDebugScenario();
  }

  if (requestedScenario === "debug-snapshot") {
    const snapshot = readDebugScenarioSnapshot();
    if (snapshot) {
      return createScenarioFromSnapshot(snapshot);
    }
  }

  return createEarthMoonScenario();
};
const scenario = createScenario();
const userSettings = readUserSettings();
let state: SimulationState = {
  elapsed: scenario.elapsed ?? 0,
  bodies: scenario.bodies,
  spacecraft: scenario.spacecraft,
  controls: idleControls(),
};

const keys = new Set<string>();
const timeWarps = [1, 10, 50, 100, 500, 2_000, 8_000];
let timeWarpIndex = 0;
const autopilotRotationRate = 0.9;
let assistTargetIndex = 1;
type AssistMode = "off" | "capture" | "circularize";
let assistMode: AssistMode = "off";
let debugModeEnabled = userSettings.debugModeEnabled;
let debugNoGravityEnabled = false;
let fpsIndicatorEnabled = false;
let performanceDebugEnabled = false;
let debugSnapshotStatus = "";
const defaultCoastPredictionHorizonHours = 1;
const minCoastPredictionHorizonHours = 0.5;
const maxCoastPredictionHorizonHours = 32 * 24;
let coastPredictionHorizonHours = THREE.MathUtils.clamp(
  scenario.coastPredictionHorizonHours ?? defaultCoastPredictionHorizonHours,
  minCoastPredictionHorizonHours,
  maxCoastPredictionHorizonHours,
);
let crashedBodyName: string | null = null;
let predictedImpact: { bodyName: string; time: number } | null = null;
let predictedTargetClosestApproach: { altitude: number; bodyName: string; time: number } | null = null;
let spacecraftLabelIntroUntil = performance.now() + 5_000;
let mouseScreenX = 0;
let mouseScreenY = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070d);
app.appendChild(renderer.domElement);
const gl = renderer.getContext() as WebGL2RenderingContext;
const gpuTimerExtension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
const pendingGpuQueries: WebGLQuery[] = [];

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070d, 0.0018);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5_000);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraDistance = 700;
const cameraElevation = THREE.MathUtils.degToRad(66);
const defaultViewport = 520;
const spacecraftModelZoomThreshold = 15;
const minViewport = defaultViewport / 30;
const maxViewport = 700;
let viewportSize = THREE.MathUtils.clamp(scenario.viewportSize ?? defaultViewport, minViewport, maxViewport);

const ambientLight = new THREE.AmbientLight(0x7f8fa6, 1.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.position.set(-1, 2, 1);
scene.add(sunLight);

const grid = new THREE.GridHelper(900, 36, 0x1d4ed8, 0x18253a);
grid.position.y = -0.05;
scene.add(grid);

const bodyMeshes = new Map<string, THREE.Mesh>();

for (const body of state.bodies) {
  const geometry = new THREE.SphereGeometry(Math.max(body.radius * RENDER_SCALE, 1), 32, 16);
  const material = new THREE.MeshStandardMaterial({
    color: body.color,
    roughness: 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = body.name;
  bodyMeshes.set(body.id, mesh);
  scene.add(mesh);
}

const spacecraftMesh = new THREE.Group();
spacecraftMesh.scale.setScalar(1.5);
const shipBody = new THREE.Mesh(
  new THREE.ConeGeometry(0.08, 0.32, 4),
  new THREE.MeshStandardMaterial({ color: "#e8eef8", roughness: 0.5, fog: false }),
);
shipBody.rotation.x = Math.PI / 2;
spacecraftMesh.add(shipBody);

const engineGlow = new THREE.Mesh(
  new THREE.ConeGeometry(0.06, 0.16, 12),
  new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0, fog: false }),
);
engineGlow.position.z = -0.24;
engineGlow.rotation.x = -Math.PI / 2;
spacecraftMesh.add(engineGlow);
scene.add(spacecraftMesh);

const spacecraftMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.25, 0.015, 8, 32),
  new THREE.MeshBasicMaterial({ color: "#67e8f9", transparent: true, opacity: 0.9, fog: false }),
);
spacecraftMarker.rotation.x = Math.PI / 2;
scene.add(spacecraftMarker);

const trailPoints: THREE.Vector3[] = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.84 });
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);

let targetRelativePredictionPoints: { x: number; y: number }[] = [];
let targetRelativeAssistedPoints: { x: number; y: number }[] = [];
let targetRelativePredictionEnd: { x: number; y: number } | null = null;
let predictionGeometry = new LineGeometry();
const predictionDashPixels = 12;
const predictionGapPixels = 8;
// Replacing geometry avoids stale Line2 instanced buffers after trajectory length changes.
// Whether reusing geometry is materially faster is still an open profiling question.
const replacePredictionLineGeometryOnUpdate = true;
const predictionMaterial = new LineMaterial({
  color: 0x67e8f9,
  linewidth: 1.5,
  transparent: true,
  opacity: 0.69,
  dashed: true,
  dashSize: predictionDashPixels,
  gapSize: predictionGapPixels,
});
const predictionLine = new Line2(predictionGeometry, predictionMaterial);
scene.add(predictionLine);

let impactGradientGeometry = new LineGeometry();
const impactGradientMaterial = new LineMaterial({
  color: 0xffffff,
  linewidth: 1.8,
  transparent: true,
  opacity: 0.95,
  dashed: true,
  dashSize: predictionDashPixels,
  gapSize: predictionGapPixels,
  vertexColors: true,
});
const impactGradientLine = new Line2(impactGradientGeometry, impactGradientMaterial);
impactGradientLine.visible = false;
scene.add(impactGradientLine);

const inertialPredictionGeometry = new LineGeometry();
const inertialPredictionMaterial = new LineMaterial({
  color: 0xdbeafe,
  linewidth: 1,
  transparent: true,
  opacity: 0.46,
  dashed: true,
  dashSize: predictionDashPixels,
  gapSize: predictionGapPixels,
});
const inertialPredictionLine = new Line2(inertialPredictionGeometry, inertialPredictionMaterial);
scene.add(inertialPredictionLine);

let assistedPredictionGeometry = new LineGeometry();
const assistedPredictionMaterial = new LineMaterial({
  color: 0xfacc15,
  linewidth: 1.2,
  transparent: true,
  opacity: 0.7,
  dashed: true,
  dashSize: predictionDashPixels,
  gapSize: predictionGapPixels,
});
const assistedPredictionLine = new Line2(assistedPredictionGeometry, assistedPredictionMaterial);
assistedPredictionLine.visible = false;
scene.add(assistedPredictionLine);

const circularOrbitGeometry = new LineGeometry();
const circularOrbitMaterial = new LineMaterial({
  color: 0x67e8f9,
  linewidth: 1,
  transparent: true,
  opacity: 0.28,
});
const circularOrbitLine = new Line2(circularOrbitGeometry, circularOrbitMaterial);
circularOrbitLine.visible = false;
scene.add(circularOrbitLine);

const desiredVelocityGeometry = new LineGeometry();
const desiredVelocityMaterial = new LineMaterial({
  color: 0xfacc15,
  linewidth: 1.5,
  transparent: true,
  opacity: 0.72,
});
const desiredVelocityLine = new Line2(desiredVelocityGeometry, desiredVelocityMaterial);
desiredVelocityLine.visible = false;
scene.add(desiredVelocityLine);

const predictionEndMarkerRadius = 0.17;
const predictionEndMarkerMinScreenRadius = 5.5;
const predictionEndMarker = new THREE.Group();
const predictionEndMarkerBacking = new THREE.Mesh(
  new THREE.CircleGeometry(1, 24),
  new THREE.MeshBasicMaterial({
    color: "#05070d",
    depthTest: false,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
);
const predictionEndMarkerFill = new THREE.Mesh(
  new THREE.CircleGeometry(1, 24),
  new THREE.MeshBasicMaterial({
    color: "#67e8f9",
    opacity: 0.5,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
);
predictionEndMarkerBacking.renderOrder = 10;
predictionEndMarkerFill.renderOrder = 11;
predictionEndMarkerBacking.scale.setScalar(1.25);
predictionEndMarker.add(predictionEndMarkerBacking, predictionEndMarkerFill);
predictionEndMarker.renderOrder = 10;
scene.add(predictionEndMarker);

type Ripple = {
  element: HTMLElement;
  age: number;
};

const raycaster = new THREE.Raycaster();
const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();
const pointerWorld = new THREE.Vector3();
const ripples: Ripple[] = [];
let targetHeading: number | null = null;

const hud = document.createElement("section");
hud.className = "hud";
hud.innerHTML = `
  <h1>${scenario.name}</h1>
  <p>${scenario.description}</p>
  <div class="stats">
    <div class="stat"><span>Engine</span><strong data-stat="engine"></strong></div>
    <div class="stat"><span>Time warp</span><strong data-stat="warp"></strong></div>
    <div class="stat"><span>Speed</span><strong data-stat="speed"></strong></div>
    <div class="stat"><span>Fuel used</span><strong data-stat="fuel"></strong></div>
    <div class="stat"><span>Zoom</span><strong data-stat="zoom"></strong></div>
    <div class="stat"><span>Target</span><strong data-stat="target"></strong></div>
    <div class="stat"><span>Target speed</span><strong data-stat="target-speed"></strong></div>
    <div class="stat"><span>Assist</span><strong data-stat="assist"></strong></div>
    <div class="stat"><span>Guidance</span><strong data-stat="guidance"></strong></div>
  </div>
  <div class="controls">
    <p><kbd>W</kbd> main engine <kbd>S</kbd> brake <kbd>Q</kbd>/<kbd>E</kbd> side thrusters</p>
    <p><kbd>A</kbd>/<kbd>D</kbd> rotate <kbd>[</kbd>/<kbd>]</kbd> time warp <kbd>-</kbd>/<kbd>=</kbd> zoom <kbd>R</kbd> reset</p>
    <p>${appSettings.assistTarget.autoDiscoverStrongestInfluence ? "" : "<kbd>T</kbd> target body "}<kbd>C</kbd> assist mode</p>
    <p>Double-click the map to point the spacecraft toward that direction.</p>
  </div>
`;
app.appendChild(hud);

const debugPanel = document.createElement("div");
debugPanel.className = "debug-panel";
let latestDebugJson = "";
const debugPanelText = document.createElement("pre");
debugPanelText.className = "debug-panel-text";
const debugPanelJson = document.createElement("pre");
debugPanelJson.className = "debug-panel-text debug-panel-json";
debugPanelJson.style.display = "none";
const debugPanelCopyButton = document.createElement("button");
debugPanelCopyButton.type = "button";
debugPanelCopyButton.className = "debug-panel-copy";
debugPanelCopyButton.textContent = "Copy debug JSON";
debugPanelCopyButton.style.display = "none";
debugPanel.append(debugPanelText, debugPanelJson, debugPanelCopyButton);
app.appendChild(debugPanel);
const stopDebugPanelEventPropagation = (event: Event) => {
  event.stopPropagation();
};
for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "auxclick", "dblclick", "wheel"]) {
  debugPanel.addEventListener(eventName, stopDebugPanelEventPropagation);
}
debugPanelCopyButton.addEventListener("click", async (event) => {
  event.stopPropagation();

  try {
    await navigator.clipboard.writeText(latestDebugJson);
    debugPanelCopyButton.textContent = "Copied";
    window.setTimeout(() => {
      debugPanelCopyButton.textContent = "Copy debug JSON";
    }, 1_200);
  } catch {
    debugPanelCopyButton.textContent = "Copy failed";
    window.setTimeout(() => {
      debugPanelCopyButton.textContent = "Copy debug JSON";
    }, 1_800);
  }
});

const setDebugPanelJson = (payload: unknown | null) => {
  latestDebugJson = payload === null ? "" : JSON.stringify(payload, null, 2);
  debugPanelJson.style.display = latestDebugJson ? "block" : "none";
  debugPanelJson.textContent = latestDebugJson ? `\ndebug json:\n${latestDebugJson}` : "";
  debugPanelCopyButton.style.display = latestDebugJson ? "block" : "none";
};

const statEngine = hud.querySelector<HTMLElement>('[data-stat="engine"]');
const statWarp = hud.querySelector<HTMLElement>('[data-stat="warp"]');
const statSpeed = hud.querySelector<HTMLElement>('[data-stat="speed"]');
const statFuel = hud.querySelector<HTMLElement>('[data-stat="fuel"]');
const statZoom = hud.querySelector<HTMLElement>('[data-stat="zoom"]');
const statTarget = hud.querySelector<HTMLElement>('[data-stat="target"]');
const statTargetSpeed = hud.querySelector<HTMLElement>('[data-stat="target-speed"]');
const statAssist = hud.querySelector<HTMLElement>('[data-stat="assist"]');
const statGuidance = hud.querySelector<HTMLElement>('[data-stat="guidance"]');

const fpsIndicator = document.createElement("div");
fpsIndicator.className = "fps-indicator";
fpsIndicator.style.display = "none";
app.appendChild(fpsIndicator);

const spacecraftCallout = document.createElement("div");
spacecraftCallout.className = "spacecraft-callout";
spacecraftCallout.innerHTML = "<span>Spacecraft</span>";
app.appendChild(spacecraftCallout);
const spacecraftCalloutLabel = spacecraftCallout.querySelector<HTMLSpanElement>("span");

const spacecraftIconThrust = document.createElement("div");
spacecraftIconThrust.className = "spacecraft-icon-thrust";
spacecraftIconThrust.style.display = "none";
app.appendChild(spacecraftIconThrust);

const offscreenIndicators = new Map<string, HTMLElement>();
const bodyLabels = new Map<string, HTMLElement>();

for (const body of state.bodies) {
  const indicator = document.createElement("div");
  indicator.className = "offscreen-indicator";
  indicator.innerHTML = `<div class="pointer"></div><div class="label"></div>`;
  indicator.style.display = "none";
  app.appendChild(indicator);
  offscreenIndicators.set(body.id, indicator);

  const label = document.createElement("div");
  label.className = "body-label";
  label.textContent = body.name;
  label.style.display = "none";
  app.appendChild(label);
  bodyLabels.set(body.id, label);
}

const renderPosition = (x: number, y: number, lift = 0) => new THREE.Vector3(x * RENDER_SCALE, lift, y * RENDER_SCALE);

const getTargetRelativePosition = (simulationState: SimulationState, targetId: string, spacecraftPosition: { x: number; y: number }) => {
  const predictedTarget = simulationState.bodies.find((body) => body.id === targetId);

  if (!predictedTarget) {
    return { ...spacecraftPosition };
  }

  return sub(spacecraftPosition, predictedTarget.position);
};

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

  const nextGeometry = replacePredictionLineGeometryOnUpdate ? new LineGeometry() : geometry;
  nextGeometry.setPositions(positions);

  if (replacePredictionLineGeometryOnUpdate) {
    geometry.dispose();
    line.geometry = nextGeometry;
  }

  line.computeLineDistances();
  syncDashedLineEndpoint(line.material, getLineGeometryDistance(nextGeometry));
  line.visible = positions.length >= 6;
  return nextGeometry;
};

const getLineGeometryDistance = (geometry: LineGeometry) => {
  const distanceAttribute = geometry.getAttribute("instanceDistanceEnd");
  if (!distanceAttribute || distanceAttribute.count === 0) {
    return 0;
  }

  return distanceAttribute.getX(distanceAttribute.count - 1);
};

const syncDashedLineEndpoint = (material: LineMaterial, lineDistance: number) => {
  if (!("USE_DASH" in material.defines) || lineDistance <= 0) {
    return;
  }

  const dashPeriod = material.dashSize + material.gapSize;
  if (dashPeriod <= 0) {
    return;
  }

  const endpointPhase = material.dashSize * 0.5;
  material.dashOffset = THREE.MathUtils.euclideanModulo(endpointPhase - lineDistance, dashPeriod);
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
  let previousGradientPoint: THREE.Vector3 | null = null;
  let gradientDistance = 0;

  for (let index = 0; index < gradientPoints.length; index += 1) {
    const point = gradientPoints[index];
    const renderedPoint = renderPosition(target.position.x + point.x, target.position.y + point.y, 0.19);
    const blend = index / Math.max(gradientPoints.length - 1, 1);
    const color = startColor.clone().lerp(endColor, blend);

    gradientPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
    gradientColors.push(color.r, color.g, color.b);

    if (previousGradientPoint) {
      gradientDistance += renderedPoint.distanceTo(previousGradientPoint);
    }
    previousGradientPoint = renderedPoint;
  }

  const nextImpactGradientGeometry = replacePredictionLineGeometryOnUpdate ? new LineGeometry() : impactGradientGeometry;
  nextImpactGradientGeometry.setPositions(gradientPositions);
  nextImpactGradientGeometry.setColors(gradientColors);

  if (replacePredictionLineGeometryOnUpdate) {
    impactGradientGeometry.dispose();
    impactGradientGeometry = nextImpactGradientGeometry;
    impactGradientLine.geometry = impactGradientGeometry;
  }

  impactGradientLine.computeLineDistances();
  syncDashedLineEndpoint(impactGradientMaterial, gradientDistance);
  impactGradientLine.visible = true;
};

const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

const getBodyInfluences = (simulationState: SimulationState) => {
  const influences = simulationState.bodies.map((body) => {
    const distanceSquared = Math.max(lengthSq(sub(body.position, simulationState.spacecraft.position)), 1);
    return {
      body,
      acceleration: (G * body.mass) / distanceSquared,
    };
  });
  const totalAcceleration = influences.reduce((sum, influence) => sum + influence.acceleration, 0);

  return influences
    .map((influence) => ({
      ...influence,
      share: totalAcceleration > 0 ? influence.acceleration / totalAcceleration : 0,
    }))
    .sort((a, b) => b.acceleration - a.acceleration);
};

const getStrongestInfluenceBody = (simulationState: SimulationState) => {
  return getBodyInfluences(simulationState)[0]?.body ?? simulationState.bodies[0];
};

const getAssistTarget = () =>
  appSettings.assistTarget.autoDiscoverStrongestInfluence
    ? getStrongestInfluenceBody(state)
    : (state.bodies[assistTargetIndex % state.bodies.length] ?? state.bodies[0]);

const getAutopilotTurn = (desiredHeading: number) => {
  const error = normalizeAngle(desiredHeading - state.spacecraft.heading);

  if (Math.abs(error) < 0.015) {
    return 0;
  }

  return THREE.MathUtils.clamp(error / autopilotRotationRate, -1, 1);
};

const getAutopilotTurnForHeading = (currentHeading: number, desiredHeading: number) => {
  const error = normalizeAngle(desiredHeading - currentHeading);

  if (Math.abs(error) < 0.015) {
    return 0;
  }

  return THREE.MathUtils.clamp(error / autopilotRotationRate, -1, 1);
};

const getCaptureMetricsForState = (simulationState: SimulationState, target: Body) => {
  const relativePosition = sub(simulationState.spacecraft.position, target.position);
  const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
  const distance = length(relativePosition);
  const relativeSpeed = length(relativeVelocity);
  const roughAssistRange = target.radius + (target.id === "moon" ? 80_000_000 : 30_000_000);
  const circularSpeed = Math.sqrt((G * target.mass) / Math.max(distance, target.radius));

  return {
    circularSpeed,
    distance,
    insideRange: distance < roughAssistRange,
    relativeSpeed,
    roughAssistRange,
    surfaceDistance: Math.max(0, distance - target.radius),
    specificEnergy: relativeSpeed ** 2 / 2 - (G * target.mass) / Math.max(distance, target.radius),
  };
};

const getCaptureMetrics = (target: Body) => getCaptureMetricsForState(state, target);

const shouldCaptureBurn = (target: Body) => {
  const metrics = getCaptureMetrics(target);
  return metrics.insideRange && metrics.relativeSpeed > metrics.circularSpeed * 1.05;
};

const getCircularizePlanForState = (simulationState: SimulationState, target: Body) => {
  const relativePosition = sub(simulationState.spacecraft.position, target.position);
  const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
  const distance = Math.max(length(relativePosition), target.radius);
  const radial = normalize(relativePosition);
  const tangentialDirection = relativePosition.x * relativeVelocity.y - relativePosition.y * relativeVelocity.x >= 0 ? 1 : -1;
  const tangent = {
    x: -radial.y * tangentialDirection,
    y: radial.x * tangentialDirection,
  };
  const circularSpeed = Math.sqrt((G * target.mass) / distance);
  const desiredVelocity = scale(tangent, circularSpeed);
  const correction = sub(desiredVelocity, relativeVelocity);

  return {
    burnHeading: Math.atan2(correction.y, correction.x),
    deltaV: length(correction),
    desiredVelocityHeading: Math.atan2(tangent.y, tangent.x),
    distance,
    radialSpeed: relativeVelocity.x * radial.x + relativeVelocity.y * radial.y,
    tangentialSpeed: relativeVelocity.x * tangent.x + relativeVelocity.y * tangent.y,
  };
};

const getCircularizePlan = (target: Body) => getCircularizePlanForState(state, target);

const getAssistPredictionControls = (simulationState: SimulationState, targetId: string): ControlInput => {
  const target = simulationState.bodies.find((body) => body.id === targetId);

  if (!target || assistMode === "off") {
    return idleControls();
  }

  if (assistMode === "capture") {
    const relativeVelocity = sub(simulationState.spacecraft.velocity, target.velocity);
    const desiredHeading = Math.atan2(-relativeVelocity.y, -relativeVelocity.x);
    const metrics = getCaptureMetricsForState(simulationState, target);

    return {
      main: metrics.insideRange && metrics.relativeSpeed > metrics.circularSpeed * 1.05 ? 1 : 0,
      reverse: 0,
      strafe: 0,
      turn: getAutopilotTurnForHeading(simulationState.spacecraft.heading, desiredHeading),
    };
  }

  const metrics = getCaptureMetricsForState(simulationState, target);
  const plan = getCircularizePlanForState(simulationState, target);

  return {
    main: metrics.specificEnergy < 0 && plan.deltaV > 15 ? 1 : 0,
    reverse: 0,
    strafe: 0,
    turn: getAutopilotTurnForHeading(simulationState.spacecraft.heading, plan.burnHeading),
  };
};

const getCaptureGuidance = (target: Body) => {
  const metrics = getCaptureMetrics(target);

  if (!metrics.insideRange) {
    if (predictedTargetClosestApproach) {
      return `Pe ${formatDistance(Math.max(0, predictedTargetClosestApproach.altitude))} in ${formatDuration(predictedTargetClosestApproach.time)}`;
    }

    return `Close in ${formatDistance(metrics.distance - metrics.roughAssistRange)}`;
  }

  if (assistMode === "circularize") {
    if (metrics.specificEnergy >= 0) {
      return "Need capture first";
    }

    const plan = getCircularizePlan(target);
    return plan.deltaV > 15 ? `Circularizing ${plan.deltaV.toFixed(0)} m/s` : "Orbit stable-ish";
  }

  if (metrics.specificEnergy < 0 && !predictedImpact) {
    return "Captured: circularize";
  }

  if (metrics.relativeSpeed > metrics.circularSpeed * 1.05) {
    return assistMode === "capture" ? "Burning retrograde" : "Ready: press C";
  }

  if (metrics.relativeSpeed < metrics.circularSpeed * 0.75) {
    return "Slow: watch escape";
  }

  return "Near capture speed";
};

const formatDistance = (meters: number) => {
  if (meters >= 1_000_000) {
    return `${Math.round(meters / 1_000_000).toLocaleString()} Mm`;
  }

  return `${Math.round(meters / 1_000).toLocaleString()} km`;
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (seconds >= 24 * 3600) {
    return `${(seconds / (24 * 3600)).toLocaleString(undefined, { maximumFractionDigits: 1 })}d`;
  }

  return `${(seconds / 3600).toFixed(1)}h`;
};

const formatSpecificEnergy = (energy: number) => `${(energy / 1_000).toFixed(1)} kJ/kg`;

const formatAcceleration = (acceleration: number) => {
  if (acceleration >= 0.01) {
    return acceleration.toFixed(3);
  }
  if (acceleration >= 0.0001) {
    return acceleration.toFixed(5);
  }

  return acceleration.toExponential(2);
};

const formatBodyInfluences = (simulationState: SimulationState) =>
  getBodyInfluences(simulationState)
    .map((influence) => `${influence.body.name} ${formatAcceleration(influence.acceleration)} m/s^2 (${(influence.share * 100).toFixed(1)}%)`)
    .join(" | ");

const getPredictionConfig = () => {
  return { refreshInterval: 0.2, stepSeconds: 30 };
};

const getCoastPredictionHorizonSeconds = () => coastPredictionHorizonHours * 60 * 60;

const shouldTrimLoopedPrediction = (
  relativePoints: { x: number; y: number }[],
  candidatePoint: { x: number; y: number },
  referenceDistance: number,
  trimDelayMultiplier: number,
) => {
  const minPointCountBeforeTrim = Math.round(64 * trimDelayMultiplier);
  const minimumSeparation = Math.round(40 * trimDelayMultiplier);

  if (relativePoints.length < minPointCountBeforeTrim) {
    return false;
  }

  const loopThreshold = Math.max(200_000, referenceDistance * 0.02);

  for (let index = 0; index < relativePoints.length - minimumSeparation; index += 1) {
    if (length(sub(candidatePoint, relativePoints[index])) < loopThreshold) {
      return true;
    }
  }

  return false;
};

const updateControls = (): ControlInput => {
  if (crashedBodyName) {
    return idleControls();
  }

  let main = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  const manualTurn = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + (keys.has("KeyD") || keys.has("ArrowRight") ? -1 : 0);
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
    turn = getAutopilotTurn(plan.burnHeading);

    if (getCaptureMetrics(target).specificEnergy < 0 && plan.deltaV > 15) {
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
    reverse: keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0,
    strafe: (keys.has("KeyQ") ? -1 : 0) + (keys.has("KeyE") ? 1 : 0),
    turn,
  };
};

const capWarpForActiveControls = (controls: ControlInput) => {
  const maxControlWarp = 100;
  const usingManualTurn = keys.has("KeyA") || keys.has("KeyD") || keys.has("ArrowLeft") || keys.has("ArrowRight");
  const usingControls = controls.main !== 0 || controls.reverse !== 0 || controls.strafe !== 0 || usingManualTurn;
  const maxControlWarpIndex = timeWarps.indexOf(maxControlWarp);

  if (usingControls && maxControlWarpIndex >= 0 && timeWarps[timeWarpIndex] > maxControlWarp) {
    timeWarpIndex = maxControlWarpIndex;
  }
};

const resetScenario = () => {
  const freshScenario = createScenario();
  state = {
    elapsed: freshScenario.elapsed ?? 0,
    bodies: freshScenario.bodies,
    spacecraft: freshScenario.spacecraft,
    controls: idleControls(),
  };
  viewportSize = THREE.MathUtils.clamp(freshScenario.viewportSize ?? defaultViewport, minViewport, maxViewport);
  coastPredictionHorizonHours = THREE.MathUtils.clamp(
    freshScenario.coastPredictionHorizonHours ?? defaultCoastPredictionHorizonHours,
    minCoastPredictionHorizonHours,
    maxCoastPredictionHorizonHours,
  );
  trailPoints.length = 0;
  targetHeading = null;
  assistMode = "off";
  crashedBodyName = null;
  spacecraftLabelIntroUntil = performance.now() + 5_000;
};

const saveDebugScenarioSnapshot = () => {
  try {
    writeDebugScenarioSnapshot(createSnapshotFromState(state, { viewportSize, coastPredictionHorizonHours }));
    debugSnapshotStatus = "snapshot saved; use [7] load or ?scenario=debug-snapshot";
  } catch {
    debugSnapshotStatus = "snapshot save failed";
  }
};

const loadDebugScenarioSnapshot = () => {
  const snapshot = readDebugScenarioSnapshot();
  if (!snapshot) {
    debugSnapshotStatus = "no debug snapshot saved";
    return;
  }

  const snapshotScenario = createScenarioFromSnapshot(snapshot);
  state = {
    elapsed: snapshotScenario.elapsed ?? 0,
    bodies: snapshotScenario.bodies,
    spacecraft: snapshotScenario.spacecraft,
    controls: idleControls(),
  };
  viewportSize = THREE.MathUtils.clamp(snapshotScenario.viewportSize ?? defaultViewport, minViewport, maxViewport);
  coastPredictionHorizonHours = THREE.MathUtils.clamp(
    snapshotScenario.coastPredictionHorizonHours ?? defaultCoastPredictionHorizonHours,
    minCoastPredictionHorizonHours,
    maxCoastPredictionHorizonHours,
  );
  trailPoints.length = 0;
  targetHeading = null;
  assistMode = "off";
  crashedBodyName = null;
  assistTargetIndex = Math.min(assistTargetIndex, Math.max(0, state.bodies.length - 1));
  spacecraftLabelIntroUntil = performance.now() + 5_000;
  debugSnapshotStatus = `loaded snapshot from ${new Date(snapshot.savedAt).toLocaleString()}`;
};

const setTargetHeadingFromScreenPoint = (clientX: number, clientY: number) => {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
  pointerNdc.y = -(((clientY - bounds.top) / bounds.height) * 2 - 1);

  raycaster.setFromCamera(pointerNdc, camera);
  const intersection = raycaster.ray.intersectPlane(pointerPlane, pointerWorld);

  if (!intersection) {
    return;
  }

  const targetX = pointerWorld.x / RENDER_SCALE;
  const targetY = pointerWorld.z / RENDER_SCALE;
  targetHeading = Math.atan2(targetY - state.spacecraft.position.y, targetX - state.spacecraft.position.x);
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
  let predictedState = cloneSimulationState(state);
  const predictedRelativePoints: { x: number; y: number }[] = [];
  const predictionStep = predictionConfig.stepSeconds;
  const maxPredictionSeconds = getCoastPredictionHorizonSeconds();
  const maxSteps = maxPredictionSeconds / predictionStep;
  const targetId = getAssistTarget().id;
  const initialTarget = getAssistTarget();
  const initialTargetDistance = length(sub(state.spacecraft.position, initialTarget.position));
  const allowLoopTrim = getCaptureMetrics(initialTarget).specificEnergy < 0;
  predictedImpact = null;
  predictedTargetClosestApproach = null;

  for (let step = 0; step < maxSteps; step += 1) {
    predictedState = physicsEngine.step(predictedState, predictionStep);
    const { spacecraft } = predictedState;
    const predictionTime = (step + 1) * predictionStep;
    const relativePoint = getTargetRelativePosition(predictedState, targetId, spacecraft.position);
    if (allowLoopTrim && shouldTrimLoopedPrediction(predictedRelativePoints, relativePoint, initialTargetDistance, coastPredictionHorizonHours / defaultCoastPredictionHorizonHours)) {
      break;
    }
    predictedRelativePoints.push(relativePoint);

    const predictedTarget = predictedState.bodies.find((body) => body.id === targetId);
    if (predictedTarget) {
      const altitude = length(sub(spacecraft.position, predictedTarget.position)) - predictedTarget.radius;

      if (!predictedTargetClosestApproach || altitude < predictedTargetClosestApproach.altitude) {
        predictedTargetClosestApproach = {
          altitude,
          bodyName: predictedTarget.name,
          time: predictionTime,
        };
      }
    }

    const hitBody = predictedState.bodies.find((body) => length(sub(spacecraft.position, body.position)) <= body.radius);
    if (hitBody) {
      predictedImpact = {
        bodyName: hitBody.name,
        time: predictionTime,
      };
      break;
    }
  }

  targetRelativePredictionPoints = predictedRelativePoints;
  targetRelativePredictionEnd = predictedRelativePoints.at(-1) ?? null;
  predictionGeometry = applyTargetRelativePredictionLine(targetRelativePredictionPoints, predictionGeometry, predictionLine, 0.18);

  if (assistMode === "off") {
    targetRelativeAssistedPoints = [];
    assistedPredictionLine.visible = false;
    return;
  }

  let assistedState = cloneSimulationState(state);
  const assistedRelativePoints: { x: number; y: number }[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    assistedState = {
      ...assistedState,
      controls: getAssistPredictionControls(assistedState, targetId),
    };
    assistedState = physicsEngine.step(assistedState, predictionStep);
    assistedRelativePoints.push(getTargetRelativePosition(assistedState, targetId, assistedState.spacecraft.position));

    const hitBody = assistedState.bodies.find((body) => length(sub(assistedState.spacecraft.position, body.position)) <= body.radius);
    if (hitBody) {
      break;
    }
  }

  assistedPredictionMaterial.color.set(assistMode === "capture" ? 0xf59e0b : 0xfacc15);
  targetRelativeAssistedPoints = assistedRelativePoints;
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
  const showLabel = performance.now() < spacecraftLabelIntroUntil || Math.hypot(mouseScreenX - screenX, mouseScreenY - screenY) < 28;

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
    statGuidance.textContent = crashedBodyName
      ? `Hit ${crashedBodyName}. Press R`
      : predictedImpact
        ? `Impact ${predictedImpact.bodyName} in ${formatDuration(predictedImpact.time)}`
        : getCaptureGuidance(target);
  }
  if (debugPanel) {
    debugPanel.style.display = debugModeEnabled ? "block" : "none";
    const debugLines = [
      `debug: [1] no-gravity ${debugNoGravityEnabled ? "on" : "off"} | [2] fps ${fpsIndicatorEnabled ? "on" : "off"} | [3] perf ${performanceDebugEnabled ? "on" : "off"}`,
      `coast horizon: [4]/2 [5]x2 => ${formatDuration(getCoastPredictionHorizonSeconds())}`,
      `snapshot: [6] save | [7] load${debugSnapshotStatus ? ` | ${debugSnapshotStatus}` : ""}`,
      `target: ${target.name}`,
      `gravity: ${formatBodyInfluences(state)}`,
      `surface: ${formatDistance(targetMetrics.surfaceDistance)} | range: ${targetMetrics.insideRange ? "inside" : "outside"}`,
      `v_rel: ${targetMetrics.relativeSpeed.toFixed(0)} m/s | v_circ: ${targetMetrics.circularSpeed.toFixed(0)} m/s`,
      `energy: ${formatSpecificEnergy(targetMetrics.specificEnergy)} | ${targetMetrics.specificEnergy < 0 ? "bound" : "unbound"}`,
      `assist: ${assistMode}`,
      predictedTargetClosestApproach
        ? `pred Pe: ${formatDistance(Math.max(0, predictedTargetClosestApproach.altitude))} in ${formatDuration(predictedTargetClosestApproach.time)}`
        : "pred Pe: calculating",
      predictedImpact ? `pred impact: ${predictedImpact.bodyName} in ${formatDuration(predictedImpact.time)}` : "pred impact: none",
    ];

    if (performanceDebugEnabled) {
      const frameBudgetMs60 = 1000 / 60;
      const frameBudgetMs30 = 1000 / 30;
      const limitingFrameMs = smoothedGpuMs === null ? smoothedCpuMs : Math.max(smoothedCpuMs, smoothedGpuMs);
      debugLines.push(
        `cpu: ${smoothedCpuMs.toFixed(2)} ms | gpu: ${smoothedGpuMs === null ? "n/a" : `${smoothedGpuMs.toFixed(2)} ms`}`,
        `headroom60: ${(frameBudgetMs60 - limitingFrameMs).toFixed(2)} ms | headroom30: ${(frameBudgetMs30 - limitingFrameMs).toFixed(2)} ms`,
      );
    }

    debugPanelText.textContent = debugLines.join("\n");
    setDebugPanelJson(null);
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

window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "BracketRight") {
    timeWarpIndex = Math.min(timeWarpIndex + 1, timeWarps.length - 1);
  }
  if (event.code === "BracketLeft") {
    timeWarpIndex = Math.max(timeWarpIndex - 1, 0);
  }
  if (event.code === "KeyR") {
    resetScenario();
  }
  if (!event.repeat && !appSettings.assistTarget.autoDiscoverStrongestInfluence && event.code === "KeyT") {
    assistTargetIndex = (assistTargetIndex + 1) % state.bodies.length;
  }
  if (!event.repeat && event.code === "KeyC") {
    assistMode = assistMode === "off" ? "capture" : assistMode === "capture" ? "circularize" : "off";
    targetHeading = null;
  }
  if (!event.repeat && event.ctrlKey && event.code === "KeyX") {
    debugModeEnabled = !debugModeEnabled;
    updateUserSettings({ debugModeEnabled });
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit1") {
    debugNoGravityEnabled = !debugNoGravityEnabled;
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit2") {
    fpsIndicatorEnabled = !fpsIndicatorEnabled;
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit3") {
    performanceDebugEnabled = !performanceDebugEnabled;
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit4") {
    coastPredictionHorizonHours = Math.max(minCoastPredictionHorizonHours, coastPredictionHorizonHours / 2);
    updateTrajectoryPrediction();
    updateInertialPrediction();
    predictionRefreshElapsed = 0;
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit5") {
    coastPredictionHorizonHours = Math.min(maxCoastPredictionHorizonHours, coastPredictionHorizonHours * 2);
    updateTrajectoryPrediction();
    updateInertialPrediction();
    predictionRefreshElapsed = 0;
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit6") {
    saveDebugScenarioSnapshot();
  }
  if (!event.repeat && debugModeEnabled && event.code === "Digit7") {
    loadDebugScenarioSnapshot();
  }
  if (event.code === "Equal" || event.code === "NumpadAdd") {
    zoomCamera(0.82);
  }
  if (event.code === "Minus" || event.code === "NumpadSubtract") {
    zoomCamera(1.22);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCamera();
});

window.addEventListener("mousemove", (event) => {
  mouseScreenX = event.clientX;
  mouseScreenY = event.clientY;
});

window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const normalizedDelta = event.deltaY * modeScale;
    const zoomFactor = THREE.MathUtils.clamp(Math.exp(normalizedDelta * 0.0015), 0.75, 1.35);
    zoomCamera(zoomFactor);
  },
  { passive: false },
);

renderer.domElement.addEventListener("dblclick", (event) => {
  setTargetHeadingFromScreenPoint(event.clientX, event.clientY);
});

updateCamera();
updateMeshes();
updateHud();
requestAnimationFrame(animate);

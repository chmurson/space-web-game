import * as THREE from "three";

import type { CircularizePlan } from "../assist/orbitalAssist";
import type { PredictedImpact } from "../prediction/trajectoryPrediction";
import { updateColoredLine2Geometry, updateLine2Geometry } from "../rendering/line2Geometry";
import { RENDER_SCALE } from "../simulation/constants";
import type { Body, Spacecraft } from "../simulation/types";
import { fromAngle, type Vec2 } from "../simulation/vector";
import type { GameSceneRefs } from "../scene/createGameScene";

export const renderPosition = (x: number, y: number, lift = 0) => new THREE.Vector3(x * RENDER_SCALE, lift, y * RENDER_SCALE);

export const updateCameraView = (options: {
  cameraDistance: number;
  cameraElevation: number;
  gameScene: GameSceneRefs;
  spacecraftPosition: Vec2;
  viewportHeight: number;
  viewportSize: number;
  viewportWidth: number;
}) => {
  const target = renderPosition(options.spacecraftPosition.x, options.spacecraftPosition.y);
  options.gameScene.cameraTarget.set(target.x, 0, target.z);

  options.gameScene.camera.left = -options.viewportSize * (options.viewportWidth / options.viewportHeight) * 0.5;
  options.gameScene.camera.right = options.viewportSize * (options.viewportWidth / options.viewportHeight) * 0.5;
  options.gameScene.camera.top = options.viewportSize * 0.5;
  options.gameScene.camera.bottom = -options.viewportSize * 0.5;

  const horizontal = Math.cos(options.cameraElevation) * options.cameraDistance;
  const vertical = Math.sin(options.cameraElevation) * options.cameraDistance;
  options.gameScene.camera.position.set(options.gameScene.cameraTarget.x + horizontal, vertical, options.gameScene.cameraTarget.z + horizontal);
  options.gameScene.camera.lookAt(options.gameScene.cameraTarget);
  options.gameScene.camera.updateProjectionMatrix();
  options.gameScene.predictionMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  options.gameScene.impactGradientMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  options.gameScene.inertialPredictionMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  options.gameScene.assistedPredictionMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  options.gameScene.circularOrbitMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  options.gameScene.desiredVelocityMaterial.resolution.set(options.viewportWidth, options.viewportHeight);
  const renderUnitsPerPixel = options.viewportSize / options.viewportHeight;
  options.gameScene.predictionMaterial.dashSize = renderUnitsPerPixel * options.gameScene.predictionDashPixels;
  options.gameScene.predictionMaterial.gapSize = renderUnitsPerPixel * options.gameScene.predictionGapPixels;
  options.gameScene.impactGradientMaterial.dashSize = renderUnitsPerPixel * options.gameScene.predictionDashPixels;
  options.gameScene.impactGradientMaterial.gapSize = renderUnitsPerPixel * options.gameScene.predictionGapPixels;
  options.gameScene.inertialPredictionMaterial.dashSize = renderUnitsPerPixel * options.gameScene.predictionDashPixels;
  options.gameScene.inertialPredictionMaterial.gapSize = renderUnitsPerPixel * options.gameScene.predictionGapPixels;
  options.gameScene.assistedPredictionMaterial.dashSize = renderUnitsPerPixel * options.gameScene.predictionDashPixels;
  options.gameScene.assistedPredictionMaterial.gapSize = renderUnitsPerPixel * options.gameScene.predictionGapPixels;
};

export const updateWorldVisuals = (options: {
  bodies: Body[];
  defaultViewport: number;
  gameScene: GameSceneRefs;
  spacecraft: Spacecraft;
  spacecraftModelZoomThreshold: number;
  viewportSize: number;
}) => {
  const useSymbolicShip = options.viewportSize > options.defaultViewport / options.spacecraftModelZoomThreshold;

  for (const body of options.bodies) {
    const mesh = options.gameScene.bodyMeshes.get(body.id);
    if (mesh) {
      mesh.position.copy(renderPosition(body.position.x, body.position.y));
    }
  }

  options.gameScene.spacecraftMesh.position.copy(renderPosition(options.spacecraft.position.x, options.spacecraft.position.y, 1.2));
  options.gameScene.spacecraftMesh.rotation.y = -options.spacecraft.heading + Math.PI / 2;
  options.gameScene.spacecraftMesh.visible = !useSymbolicShip;
  options.gameScene.spacecraftMarker.position.copy(renderPosition(options.spacecraft.position.x, options.spacecraft.position.y, 1.1));
  options.gameScene.spacecraftMarker.scale.setScalar(Math.max(1, options.viewportSize / 520));
  options.gameScene.spacecraftMarker.visible = !useSymbolicShip;
};

const trailPointDistanceThreshold = 4;
const maxTrailPoints = 450;

export const updateSpacecraftTrail = (options: {
  gameScene: GameSceneRefs;
  isThrusting: boolean;
  spacecraft: Spacecraft;
}) => {
  options.gameScene.engineGlow.material.opacity = options.isThrusting ? 0.8 : 0;

  const trailPosition = renderPosition(options.spacecraft.position.x, options.spacecraft.position.y, 0.35);
  const lastPoint = options.gameScene.trailPoints.at(-1);
  if (!lastPoint || lastPoint.distanceToSquared(trailPosition) > trailPointDistanceThreshold) {
    options.gameScene.trailPoints.push(trailPosition);
    if (options.gameScene.trailPoints.length > maxTrailPoints) {
      options.gameScene.trailPoints.shift();
    }
    options.gameScene.trail.geometry.dispose();
    options.gameScene.trail.geometry = new THREE.BufferGeometry().setFromPoints(options.gameScene.trailPoints);
  }
};

const applyTargetRelativePredictionLine = (
  gameScene: GameSceneRefs,
  relativePoints: Vec2[],
  geometryKey: "predictionGeometry" | "assistedPredictionGeometry",
  lineKey: "predictionLine" | "assistedPredictionLine",
  lift: number,
  target: Body,
) => {
  const line = gameScene[lineKey];

  if (relativePoints.length === 0) {
    line.visible = false;
    return;
  }

  const positions: number[] = [];

  for (const point of relativePoints) {
    const renderedPoint = renderPosition(target.position.x + point.x, target.position.y + point.y, lift);
    positions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
  }

  gameScene[geometryKey] = updateLine2Geometry(line, gameScene[geometryKey], positions, {
    replaceGeometryOnUpdate: gameScene.replacePredictionLineGeometryOnUpdate,
  });
};

export const updateTargetRelativePredictionVisuals = (options: {
  debugModeEnabled: boolean;
  gameScene: GameSceneRefs;
  predictedImpact: PredictedImpact | null;
  target: Body;
  targetRelativeAssistedPoints: Vec2[];
  targetRelativePredictionEnd: Vec2 | null;
  targetRelativePredictionPoints: Vec2[];
  viewportHeight: number;
  viewportSize: number;
}) => {
  const gradientPointCount = Math.min(18, options.targetRelativePredictionPoints.length);
  const hasImpactGradient = Boolean(options.predictedImpact) && options.targetRelativePredictionPoints.length >= 3;

  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativePredictionPoints,
    "predictionGeometry",
    "predictionLine",
    0.18,
    options.target,
  );
  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativeAssistedPoints,
    "assistedPredictionGeometry",
    "assistedPredictionLine",
    0.2,
    options.target,
  );

  if (!options.targetRelativePredictionEnd) {
    options.gameScene.predictionEndMarker.visible = false;
    options.gameScene.impactGradientLine.visible = false;
    return;
  }

  options.gameScene.predictionEndMarker.position.copy(
    renderPosition(
      options.target.position.x + options.targetRelativePredictionEnd.x,
      options.target.position.y + options.targetRelativePredictionEnd.y,
      0.18,
    ),
  );
  options.gameScene.predictionEndMarker.quaternion.copy(options.gameScene.camera.quaternion);
  const markerRadius = Math.max(
    options.gameScene.predictionEndMarkerRadius,
    options.gameScene.predictionEndMarkerMinScreenRadius * (options.viewportSize / options.viewportHeight),
  );
  options.gameScene.predictionEndMarker.scale.setScalar(markerRadius);
  options.gameScene.predictionEndMarkerFill.material.color.set(options.predictedImpact ? "#ef4444" : "#67e8f9");
  options.gameScene.predictionEndMarker.visible = options.debugModeEnabled || Boolean(options.predictedImpact);

  if (!hasImpactGradient) {
    options.gameScene.impactGradientLine.visible = false;
    return;
  }

  const gradientPoints = options.targetRelativePredictionPoints.slice(-gradientPointCount);
  const gradientPositions: number[] = [];
  const gradientColors: number[] = [];
  const startColor = new THREE.Color("#67e8f9");
  const endColor = new THREE.Color("#ef4444");

  for (let index = 0; index < gradientPoints.length; index += 1) {
    const point = gradientPoints[index];
    const renderedPoint = renderPosition(options.target.position.x + point.x, options.target.position.y + point.y, 0.19);
    const blend = index / Math.max(gradientPoints.length - 1, 1);
    const color = startColor.clone().lerp(endColor, blend);

    gradientPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z);
    gradientColors.push(color.r, color.g, color.b);
  }

  options.gameScene.impactGradientGeometry = updateColoredLine2Geometry(
    options.gameScene.impactGradientLine,
    options.gameScene.impactGradientGeometry,
    gradientPositions,
    gradientColors,
    {
      replaceGeometryOnUpdate: options.gameScene.replacePredictionLineGeometryOnUpdate,
    },
  );
};

export const updateCircularizationVisuals = (options: {
  circularizePlan: CircularizePlan | null;
  gameScene: GameSceneRefs;
  spacecraftPosition: Vec2;
  target: Body | null;
  viewportSize: number;
}) => {
  if (!options.circularizePlan || !options.target) {
    options.gameScene.circularOrbitLine.visible = false;
    options.gameScene.desiredVelocityLine.visible = false;
    return;
  }

  const targetPosition = renderPosition(options.target.position.x, options.target.position.y, 0.11);
  const orbitRadius = options.circularizePlan.distance * RENDER_SCALE;
  const orbitPoints: number[] = [];
  const segments = 128;

  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    orbitPoints.push(targetPosition.x + Math.cos(angle) * orbitRadius, 0.11, targetPosition.z + Math.sin(angle) * orbitRadius);
  }

  options.gameScene.circularOrbitGeometry.setPositions(orbitPoints);
  options.gameScene.circularOrbitLine.computeLineDistances();
  options.gameScene.circularOrbitLine.visible = true;

  const spacecraftPosition = renderPosition(options.spacecraftPosition.x, options.spacecraftPosition.y, 0.16);
  const arrowLength = THREE.MathUtils.clamp(orbitRadius * 0.2, 1.5, options.viewportSize * 0.16);
  const desiredDirection = fromAngle(options.circularizePlan.desiredVelocityHeading);
  const desiredEnd = {
    x: spacecraftPosition.x + desiredDirection.x * arrowLength,
    z: spacecraftPosition.z + desiredDirection.y * arrowLength,
  };

  options.gameScene.desiredVelocityGeometry.setPositions([spacecraftPosition.x, 0.16, spacecraftPosition.z, desiredEnd.x, 0.16, desiredEnd.z]);
  options.gameScene.desiredVelocityLine.computeLineDistances();
  options.gameScene.desiredVelocityLine.visible = true;
};

export const updateInertialPredictionVisual = (options: {
  enabled: boolean;
  gameScene: GameSceneRefs;
  predictionSeconds: number;
  spacecraftPosition: Vec2;
  spacecraftVelocity: Vec2;
}) => {
  if (!options.enabled) {
    options.gameScene.inertialPredictionLine.visible = false;
    return;
  }

  const steps = 64;
  const points: number[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const t = (options.predictionSeconds * step) / steps;
    const x = options.spacecraftPosition.x + options.spacecraftVelocity.x * t;
    const y = options.spacecraftPosition.y + options.spacecraftVelocity.y * t;
    const point = renderPosition(x, y, 0.14);
    points.push(point.x, point.y, point.z);
  }

  options.gameScene.inertialPredictionGeometry.setPositions(points);
  options.gameScene.inertialPredictionLine.computeLineDistances();
  options.gameScene.inertialPredictionLine.visible = true;
};

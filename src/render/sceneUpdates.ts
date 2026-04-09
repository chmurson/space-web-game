import * as THREE from "three";

import { RENDER_SCALE } from "../simulation/constants";
import type { Body, Spacecraft } from "../simulation/types";
import type { Vec2 } from "../simulation/vector";
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

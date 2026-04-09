import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import type { GameConfig } from "../config/types";
import { RENDER_SCALE } from "../simulation/constants";
import type { Body } from "../simulation/types";

export type GameSceneRefs = {
  assistedPredictionGeometry: LineGeometry;
  assistedPredictionLine: Line2;
  assistedPredictionMaterial: LineMaterial;
  bodyMeshes: Map<string, THREE.Mesh>;
  camera: THREE.OrthographicCamera;
  cameraTarget: THREE.Vector3;
  circularOrbitGeometry: LineGeometry;
  circularOrbitLine: Line2;
  circularOrbitMaterial: LineMaterial;
  desiredVelocityGeometry: LineGeometry;
  desiredVelocityLine: Line2;
  desiredVelocityMaterial: LineMaterial;
  engineGlow: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  impactGradientGeometry: LineGeometry;
  impactGradientLine: Line2;
  impactGradientMaterial: LineMaterial;
  inertialPredictionGeometry: LineGeometry;
  inertialPredictionLine: Line2;
  inertialPredictionMaterial: LineMaterial;
  predictionDashPixels: number;
  predictionEndMarker: THREE.Group;
  predictionEndMarkerFill: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  predictionEndMarkerMinScreenRadius: number;
  predictionEndMarkerRadius: number;
  predictionGapPixels: number;
  predictionGeometry: LineGeometry;
  predictionLine: Line2;
  predictionMaterial: LineMaterial;
  replacePredictionLineGeometryOnUpdate: boolean;
  scene: THREE.Scene;
  spacecraftMarker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  spacecraftMesh: THREE.Group;
  trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  trailPoints: THREE.Vector3[];
};

export const createGameScene = (
  bodies: Body[],
  trajectoryRenderingConfig: GameConfig["trajectory"]["rendering"],
): GameSceneRefs => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5_000);
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0x7f8fa6, 1.5);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  sunLight.position.set(-1, 2, 1);
  scene.add(sunLight);

  const grid = new THREE.GridHelper(900, 36, 0x1d4ed8, 0x18253a);
  grid.position.y = -0.05;
  scene.add(grid);

  const bodyMeshes = new Map<string, THREE.Mesh>();

  for (const body of bodies) {
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
    new THREE.MeshStandardMaterial({ color: "#e8eef8", roughness: 0.5 }),
  );
  shipBody.rotation.x = Math.PI / 2;
  spacecraftMesh.add(shipBody);

  const engineGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 12),
    new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0 }),
  );
  engineGlow.position.z = -0.24;
  engineGlow.rotation.x = -Math.PI / 2;
  spacecraftMesh.add(engineGlow);
  scene.add(spacecraftMesh);

  const spacecraftMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.015, 8, 32),
    new THREE.MeshBasicMaterial({ color: "#67e8f9", transparent: true, opacity: 0.9 }),
  );
  spacecraftMarker.rotation.x = Math.PI / 2;
  scene.add(spacecraftMarker);

  const trailPoints: THREE.Vector3[] = [];
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.LineBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.84 });
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  scene.add(trail);

  const predictionDashPixels = trajectoryRenderingConfig.dashPixels;
  const predictionGapPixels = trajectoryRenderingConfig.gapPixels;
  const replacePredictionLineGeometryOnUpdate = trajectoryRenderingConfig.replaceLineGeometryOnUpdate;

  const predictionGeometry = new LineGeometry();
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

  const impactGradientGeometry = new LineGeometry();
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

  const assistedPredictionGeometry = new LineGeometry();
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

  const predictionEndMarkerRadius = trajectoryRenderingConfig.endMarkerRadius;
  const predictionEndMarkerMinScreenRadius = trajectoryRenderingConfig.endMarkerMinScreenRadius;
  const predictionEndMarker = new THREE.Group();
  const predictionEndMarkerBacking = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({
      color: "#05070d",
      depthTest: false,
      depthWrite: false,
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

  return {
    assistedPredictionGeometry,
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
    impactGradientGeometry,
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
    predictionGeometry,
    predictionLine,
    predictionMaterial,
    replacePredictionLineGeometryOnUpdate,
    scene,
    spacecraftMarker,
    spacecraftMesh,
    trail,
    trailPoints,
  };
};

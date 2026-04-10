import * as THREE from "three";

import { renderPosition } from "../render/sceneUpdates";
import { RENDER_SCALE } from "../simulation/constants";
import type { Body } from "../simulation/types";
import type { Vec2 } from "../simulation/vector";
import { formatDistance } from "../ui/formatters";
import type { OverlayUiRefs } from "../ui/createOverlayUi";
import type { GameSceneRefs } from "../scene/createGameScene";

const updateBodyWorldVisuals = (gameScene: GameSceneRefs, bodies: Body[]) => {
  const visibleBodyIds = new Set(bodies.map((body) => body.id));

  for (const [bodyId, mesh] of gameScene.bodyMeshes.entries()) {
    mesh.visible = visibleBodyIds.has(bodyId);
  }

  for (const body of bodies) {
    const mesh = gameScene.bodyMeshes.get(body.id);
    if (mesh) {
      mesh.visible = true;
      mesh.position.copy(renderPosition(body.position.x, body.position.y));
    }
  }
};

const updateOffscreenIndicators = (options: {
  bodies: Body[];
  gameScene: GameSceneRefs;
  overlayUi: OverlayUiRefs;
  spacecraftPosition: Vec2;
}) => {
  const edgePadding = 28;
  const screenCenterX = window.innerWidth * 0.5;
  const screenCenterY = window.innerHeight * 0.5;

  for (const body of options.bodies) {
    const indicator = options.overlayUi.offscreenIndicators.get(body.id);
    if (!indicator) {
      continue;
    }

    const position = renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(options.gameScene.camera);

    const isVisible = position.x >= -1 && position.x <= 1 && position.y >= -1 && position.y <= 1 && position.z > -1 && position.z < 1;

    if (isVisible) {
      indicator.style.display = "none";
      continue;
    }

    const projectedX = (position.x * 0.5 + 0.5) * window.innerWidth;
    const projectedY = (-position.y * 0.5 + 0.5) * window.innerHeight;
    const direction = Math.atan2(projectedY - screenCenterY, projectedX - screenCenterX);
    const distance = Math.max(
      0,
      Math.hypot(body.position.x - options.spacecraftPosition.x, body.position.y - options.spacecraftPosition.y) - body.radius,
    );
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

  for (const [bodyId, indicator] of options.overlayUi.offscreenIndicators.entries()) {
    if (!options.bodies.some((body) => body.id === bodyId)) {
      indicator.style.display = "none";
    }
  }
};

const updateBodyLabels = (options: {
  bodies: Body[];
  gameScene: GameSceneRefs;
  overlayUi: OverlayUiRefs;
  viewportSize: number;
}) => {
  const labelRadiusThreshold = 24;
  const pixelsPerRenderUnit = window.innerHeight / options.viewportSize;

  for (const body of options.bodies) {
    const label = options.overlayUi.bodyLabels.get(body.id);
    if (!label) {
      continue;
    }

    const apparentRadius = body.radius * RENDER_SCALE * pixelsPerRenderUnit;
    const position = renderPosition(body.position.x, body.position.y, body.radius * RENDER_SCALE);
    position.project(options.gameScene.camera);
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

  for (const [bodyId, label] of options.overlayUi.bodyLabels.entries()) {
    if (!options.bodies.some((body) => body.id === bodyId)) {
      label.style.display = "none";
    }
  }
};

export const createBodyPresentation = (options: {
  gameScene: GameSceneRefs;
  overlayUi: OverlayUiRefs;
}) => ({
  updateVisuals: (state: {
    bodies: Body[];
    hiddenBodyIds: string[];
    spacecraftPosition: Vec2;
    viewportSize: number;
  }) => {
    const visibleBodies = state.bodies.filter((body) => !state.hiddenBodyIds.includes(body.id));

    updateBodyWorldVisuals(options.gameScene, visibleBodies);
    updateOffscreenIndicators({
      bodies: visibleBodies,
      gameScene: options.gameScene,
      overlayUi: options.overlayUi,
      spacecraftPosition: state.spacecraftPosition,
    });
    updateBodyLabels({
      bodies: visibleBodies,
      gameScene: options.gameScene,
      overlayUi: options.overlayUi,
      viewportSize: state.viewportSize,
    });
  },
});

export type BodyPresentation = ReturnType<typeof createBodyPresentation>;

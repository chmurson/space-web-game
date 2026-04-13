import * as THREE from "three";

import type { Vec2 } from "../simulation/vector";

export type PointerScreenPosition = {
  x: number;
  y: number;
};

export type PointerCameraInput = {
  pointerScreenPosition: PointerScreenPosition;
};

export type PointerCameraInputOptions = {
  camera: THREE.Camera;
  getInteractionsEnabled: () => boolean;
  getSpacecraftPosition: () => Vec2;
  onResize: () => void;
  onTargetHeadingSelected: (heading: number, screenPosition: PointerScreenPosition) => void;
  onZoom: (zoomFactor: number) => void;
  renderScale: number;
  rendererElement: HTMLCanvasElement;
  windowTarget: Window;
};

const wheelZoomSensitivity = 0.0015;
const minWheelZoomFactor = 0.75;
const maxWheelZoomFactor = 1.35;
const wheelLineModePixels = 16;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getWheelModeScale = (deltaMode: number, viewportHeight: number) => {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return wheelLineModePixels;
  }

  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return viewportHeight;
  }

  return 1;
};

export const getWheelZoomFactor = (event: Pick<WheelEvent, "deltaMode" | "deltaY">, viewportHeight: number) => {
  const normalizedDelta = event.deltaY * getWheelModeScale(event.deltaMode, viewportHeight);
  return clamp(Math.exp(normalizedDelta * wheelZoomSensitivity), minWheelZoomFactor, maxWheelZoomFactor);
};

export const createScreenPointHeadingPicker = (
  camera: THREE.Camera,
  rendererElement: HTMLCanvasElement,
  renderScale: number,
) => {
  const raycaster = new THREE.Raycaster();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerNdc = new THREE.Vector2();
  const pointerWorld = new THREE.Vector3();

  return (clientX: number, clientY: number, spacecraftPosition: Vec2): number | null => {
    const bounds = rendererElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerNdc.y = -(((clientY - bounds.top) / bounds.height) * 2 - 1);

    raycaster.setFromCamera(pointerNdc, camera);
    const intersection = raycaster.ray.intersectPlane(pointerPlane, pointerWorld);

    if (!intersection) {
      return null;
    }

    const targetX = pointerWorld.x / renderScale;
    const targetY = pointerWorld.z / renderScale;
    return Math.atan2(targetY - spacecraftPosition.y, targetX - spacecraftPosition.x);
  };
};

export const bindPointerCameraInput = (options: PointerCameraInputOptions): PointerCameraInput => {
  const pointerScreenPosition: PointerScreenPosition = { x: 0, y: 0 };
  const pickHeadingFromScreenPoint = createScreenPointHeadingPicker(options.camera, options.rendererElement, options.renderScale);
  let lastTouchTap:
    | {
        time: number;
        x: number;
        y: number;
      }
    | null = null;

  options.windowTarget.addEventListener("resize", () => {
    options.onResize();
  });

  const updatePointerPosition = (clientX: number, clientY: number) => {
    pointerScreenPosition.x = clientX;
    pointerScreenPosition.y = clientY;
  };

  options.windowTarget.addEventListener("mousemove", (event) => {
    updatePointerPosition(event.clientX, event.clientY);
  });

  options.windowTarget.addEventListener("pointermove", (event) => {
    updatePointerPosition(event.clientX, event.clientY);
  });

  options.windowTarget.addEventListener(
    "wheel",
    (event) => {
      if (!options.getInteractionsEnabled()) {
        return;
      }

      event.preventDefault();
      options.onZoom(getWheelZoomFactor(event, options.windowTarget.innerHeight));
    },
    { passive: false },
  );

  options.rendererElement.addEventListener("dblclick", (event) => {
    if (!options.getInteractionsEnabled()) {
      return;
    }

    const heading = pickHeadingFromScreenPoint(event.clientX, event.clientY, options.getSpacecraftPosition());

    if (heading === null) {
      return;
    }

    options.onTargetHeadingSelected(heading, { x: event.clientX, y: event.clientY });
  });

  options.rendererElement.addEventListener(
    "touchend",
    (event) => {
      if (!options.getInteractionsEnabled()) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      updatePointerPosition(touch.clientX, touch.clientY);
      const now = performance.now();
      const isDoubleTap =
        lastTouchTap &&
        now - lastTouchTap.time <= 320 &&
        Math.hypot(touch.clientX - lastTouchTap.x, touch.clientY - lastTouchTap.y) <= 32;

      if (!isDoubleTap) {
        lastTouchTap = { time: now, x: touch.clientX, y: touch.clientY };
        return;
      }

      event.preventDefault();
      lastTouchTap = null;
      const heading = pickHeadingFromScreenPoint(touch.clientX, touch.clientY, options.getSpacecraftPosition());

      if (heading === null) {
        return;
      }

      options.onTargetHeadingSelected(heading, { x: touch.clientX, y: touch.clientY });
    },
    { passive: false },
  );

  return { pointerScreenPosition };
};

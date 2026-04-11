import * as THREE from "three";

import type { KeyboardShortcutAction } from "../input/keyboardShortcuts";
import { updateCameraView } from "../render/sceneUpdates";
import type { ScenarioDirectiveLimits } from "../scenario/scenarioDirectiveTypes";
import { getConstrainedTimeWarpIndex, syncRuntimeScenarioDirectives } from "../scenario/scenarioDirectives";
import { createRequestedRuntimeScenario, createRuntimeScenarioState, loadDebugRuntimeScenario, saveRuntimeDebugSnapshot, type RuntimeScenarioOptions } from "../scenario/runtimeScenario";
import type { GameSceneRefs } from "../scene/createGameScene";
import type { AppRuntimeState } from "./appRuntimeState";
import { restoreRuntimeFromScenarioCheckpoint } from "./scenarioRecovery";
import type { Ripple } from "../ui/overlayUpdates";

type RippleCreator = (parent: HTMLElement, ripples: Ripple[], screenX: number, screenY: number) => void;

export type RuntimeActionsResult = {
  refreshTrajectoryPrediction: boolean;
};

export const createRuntimeActions = (options: {
  app: HTMLDivElement;
  cameraDistance: number;
  cameraElevation: number;
  createRipple: RippleCreator;
  gameScene: GameSceneRefs;
  maxCoastPredictionHorizonHours: number;
  maxViewport: number;
  minCoastPredictionHorizonHours: number;
  minViewport: number;
  renderer: Pick<THREE.WebGLRenderer, "setSize">;
  requestedScenario: string;
  ripples: Ripple[];
  runtime: AppRuntimeState;
  scenarioDirectiveLimits: ScenarioDirectiveLimits;
  runtimeScenarioOptions: RuntimeScenarioOptions;
  timeWarps: number[];
  updateUserSettings: (settings: { debugModeEnabled: boolean }) => void;
}) => {
  const clearTransientScenarioState = () => {
    options.gameScene.trailPoints.length = 0;
    options.runtime.targetHeading = null;
    options.runtime.assistMode = "off";
    options.runtime.crashedBodyName = null;
    options.runtime.spacecraftLabelIntroUntil = performance.now() + 5_000;
  };

  const resetScenario = () => {
    const freshRuntimeScenarioState = createRuntimeScenarioState(
      createRequestedRuntimeScenario(options.requestedScenario),
      options.runtimeScenarioOptions,
    );
    options.runtime.timeWarpIndex = 0;
    options.runtime.state = freshRuntimeScenarioState.state;
    options.runtime.viewportSize = freshRuntimeScenarioState.viewportSize;
    options.runtime.coastPredictionHorizonHours = freshRuntimeScenarioState.coastPredictionHorizonHours;
    options.runtime.scenarioSession = freshRuntimeScenarioState.scenarioSession;
    clearTransientScenarioState();
    syncRuntimeScenarioDirectives(options.runtime, options.scenarioDirectiveLimits);
  };

  const saveDebugScenarioSnapshot = () => {
    options.runtime.debugSnapshotStatus = saveRuntimeDebugSnapshot(options.runtime.state, {
      coastPredictionHorizonHours: options.runtime.coastPredictionHorizonHours,
      scenarioSession: options.runtime.scenarioSession,
      viewportSize: options.runtime.viewportSize,
    })
      ? "snapshot saved; use [7] load or ?scenario=debug-snapshot"
      : "snapshot save failed";
  };

  const loadDebugScenarioSnapshot = () => {
    const loadedDebugScenario = loadDebugRuntimeScenario(options.runtimeScenarioOptions);
    if (!loadedDebugScenario) {
      options.runtime.debugSnapshotStatus = "no debug snapshot saved";
      return;
    }

    options.runtime.state = loadedDebugScenario.runtimeState.state;
    options.runtime.viewportSize = loadedDebugScenario.runtimeState.viewportSize;
    options.runtime.coastPredictionHorizonHours = loadedDebugScenario.runtimeState.coastPredictionHorizonHours;
    options.runtime.scenarioSession = loadedDebugScenario.runtimeState.scenarioSession;
    clearTransientScenarioState();
    syncRuntimeScenarioDirectives(options.runtime, options.scenarioDirectiveLimits);
    options.runtime.assistTargetIndex = Math.min(
      options.runtime.assistTargetIndex,
      Math.max(0, options.runtime.state.bodies.length - 1),
    );
    options.runtime.debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`;
  };

  const updateCamera = () =>
    updateCameraView({
      cameraDistance: options.cameraDistance,
      cameraElevation: options.cameraElevation,
      gameScene: options.gameScene,
      spacecraftPosition: options.runtime.state.spacecraft.position,
      viewportHeight: window.innerHeight,
      viewportSize: options.runtime.viewportSize,
      viewportWidth: window.innerWidth,
    });

  const zoomCamera = (factor: number) => {
    options.runtime.viewportSize = THREE.MathUtils.clamp(
      options.runtime.viewportSize * factor,
      options.runtime.scenarioDirectives.minViewportSize ?? options.minViewport,
      options.runtime.scenarioDirectives.maxViewportSize ?? options.maxViewport,
    );
    updateCamera();
  };

  const recoverScenarioAfterCrash = () => {
    const recoveredFromCheckpoint = restoreRuntimeFromScenarioCheckpoint(options.runtime);
    if (!recoveredFromCheckpoint) {
      resetScenario();
      return;
    }

    clearTransientScenarioState();
    syncRuntimeScenarioDirectives(options.runtime, options.scenarioDirectiveLimits);
  };

  return {
    handleKeyboardShortcutAction: (action: KeyboardShortcutAction): RuntimeActionsResult => {
      if (action === "increaseTimeWarp") {
        options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
          options.runtime.timeWarpIndex + 1,
          options.timeWarps,
          options.runtime.scenarioDirectives.maxTimeWarp,
        );
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "decreaseTimeWarp") {
        options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
          Math.max(options.runtime.timeWarpIndex - 1, 0),
          options.timeWarps,
          options.runtime.scenarioDirectives.maxTimeWarp,
        );
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "resetScenario") {
        resetScenario();
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "cycleAssistTarget") {
        options.runtime.assistTargetIndex = (options.runtime.assistTargetIndex + 1) % options.runtime.state.bodies.length;
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "cycleAssistMode") {
        options.runtime.assistMode =
          options.runtime.assistMode === "off" ? "capture" : options.runtime.assistMode === "capture" ? "circularize" : "off";
        options.runtime.targetHeading = null;
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "toggleDebugMode") {
        options.runtime.debugModeEnabled = !options.runtime.debugModeEnabled;
        options.updateUserSettings({ debugModeEnabled: options.runtime.debugModeEnabled });
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "toggleNoGravityDebug") {
        options.runtime.debugNoGravityEnabled = !options.runtime.debugNoGravityEnabled;
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "toggleFpsIndicator") {
        options.runtime.fpsIndicatorEnabled = !options.runtime.fpsIndicatorEnabled;
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "togglePerformanceDebug") {
        options.runtime.performanceDebugEnabled = !options.runtime.performanceDebugEnabled;
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "decreaseCoastHorizon") {
        options.runtime.coastPredictionHorizonHours = Math.max(
          options.minCoastPredictionHorizonHours,
          options.runtime.coastPredictionHorizonHours / 2,
        );
        return { refreshTrajectoryPrediction: true };
      }
      if (action === "increaseCoastHorizon") {
        options.runtime.coastPredictionHorizonHours = Math.min(
          options.runtime.scenarioDirectives.maxCoastPredictionHorizonHours ?? options.maxCoastPredictionHorizonHours,
          options.runtime.coastPredictionHorizonHours * 2,
        );
        return { refreshTrajectoryPrediction: true };
      }
      if (action === "saveDebugSnapshot") {
        saveDebugScenarioSnapshot();
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "loadDebugSnapshot") {
        loadDebugScenarioSnapshot();
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "zoomIn") {
        zoomCamera(0.82);
        return { refreshTrajectoryPrediction: false };
      }
      if (action === "zoomOut") {
        zoomCamera(1.22);
      }

      return { refreshTrajectoryPrediction: false };
    },
    handleResize: () => {
      options.renderer.setSize(window.innerWidth, window.innerHeight);
      updateCamera();
    },
    setTargetHeading: (heading: number, clientX: number, clientY: number) => {
      options.runtime.targetHeading = heading;
      options.runtime.assistMode = "off";
      options.createRipple(options.app, options.ripples, clientX, clientY);
    },
    recoverScenarioAfterCrash,
    updateCamera,
    zoomCamera,
  };
};

export type RuntimeActions = ReturnType<typeof createRuntimeActions>;

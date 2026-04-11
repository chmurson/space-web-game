import { describe, expect, it } from "vitest";

import { createDefaultScenarioDirectives } from "../scenario/scenarioDirectiveTypes";
import { createRuntimeScenarioSession } from "../scenario/scenarioSession";
import type { AppRuntimeState } from "./appRuntimeState";
import { createRuntimeActions } from "./runtimeActions";

const createRuntime = (): AppRuntimeState => ({
  assistMode: "capture",
  assistTargetIndex: 1,
  coastPredictionHorizonHours: 24,
  crashedBodyName: "Earth",
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: "",
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  scenarioDirectives: createDefaultScenarioDirectives(),
  scenarioSession: createRuntimeScenarioSession("tutorial", { phase: "reach-moon" }),
  spacecraftLabelIntroUntil: 0,
  state: {
    elapsed: 100,
    bodies: [
      {
        id: "earth",
        name: "Earth",
        mass: 1,
        radius: 1,
        position: { x: 10, y: 20 },
        velocity: { x: 30, y: 40 },
        color: "#2f80ed",
      },
      {
        id: "moon",
        name: "Moon",
        mass: 1,
        radius: 1,
        position: { x: 50, y: 60 },
        velocity: { x: 70, y: 80 },
        color: "#9aa0a6",
      },
    ],
    controls: { main: 1, reverse: 0, strafe: 0, turn: 1 },
    spacecraft: {
      position: { x: 50, y: 60 },
      velocity: { x: 70, y: 80 },
      heading: 0.4,
      fuel: 1,
      fuelUsed: 2,
      dryMass: 3,
      fuelMass: 4,
      fuelCapacity: 5,
    },
  },
  targetHeading: 1,
  timeWarpIndex: 4,
  viewportSize: 600,
});

describe("createRuntimeActions", () => {
  it("resets time warp to the initial index when resetting the scenario", () => {
    const runtime = createRuntime();
    const runtimeActions = createRuntimeActions({
      app: {} as HTMLDivElement,
      cameraDistance: 700,
      cameraElevation: 1,
      createRipple: () => {},
      gameScene: { trailPoints: [] } as never,
      maxCoastPredictionHorizonHours: 48,
      maxViewport: 2500,
      minCoastPredictionHorizonHours: 0.5,
      minViewport: 50,
      renderer: { setSize: () => {} },
      requestedScenario: "tutorial",
      ripples: [],
      runtime,
      scenarioDirectiveLimits: {
        defaultViewportSize: 520,
        maxCoastPredictionHorizonHours: 48,
        maxViewportSize: 2500,
        minViewportSize: 50,
        timeWarps: [1, 10, 50, 100, 500, 2000],
      },
      runtimeScenarioOptions: {
        defaultCoastPredictionHorizonHours: 1,
        defaultViewportSize: 520,
        maxCoastPredictionHorizonHours: 48,
        maxViewportSize: 2500,
        minCoastPredictionHorizonHours: 0.5,
        minViewportSize: 50,
      },
      timeWarps: [1, 10, 50, 100, 500, 2000],
      updateUserSettings: () => {},
    });

    runtimeActions.handleKeyboardShortcutAction("resetScenario");

    expect(runtime.timeWarpIndex).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import type { AppRuntimeState } from "./appRuntimeState";
import { createGameQueries } from "./gameQueries";

const createBody = (overrides: Partial<AppRuntimeState["state"]["bodies"][number]> = {}) => ({
  id: "body",
  name: "Body",
  mass: 1,
  radius: 1,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: "#fff",
  ...overrides,
});

const createRuntime = (bodies: AppRuntimeState["state"]["bodies"], coastPredictionHorizonHours: number): AppRuntimeState => ({
  assistMode: "off",
  assistTargetIndex: 0,
  coastPredictionHorizonHours,
  crashedBodyName: null,
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: "",
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  spacecraftLabelIntroUntil: 0,
  state: {
    elapsed: 0,
    bodies,
    controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
    spacecraft: {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      fuel: 0,
      fuelUsed: 0,
      dryMass: 1,
      fuelMass: 0,
      fuelCapacity: 0,
    },
  },
  targetHeading: null,
  timeWarpIndex: 0,
  viewportSize: 100,
});

describe("createGameQueries", () => {
  it("selects the strongest influence body when auto-discovery is enabled", () => {
    const runtime = createRuntime(
      [
        createBody({ id: "earth", name: "Earth", mass: 5.97e24, position: { x: 10_000_000, y: 0 } }),
        createBody({ id: "moon", name: "Moon", mass: 7.35e22, position: { x: 500_000, y: 0 } }),
      ],
      2,
    );
    const queries = createGameQueries({
      autoDiscoverStrongestInfluence: true,
      autopilotRotationRate: 0.1,
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    });

    expect(queries.getAssistTarget().id).toBe("moon");
  });

  it("wraps the selected assist target index when auto-discovery is disabled", () => {
    const runtime = createRuntime(
      [
        createBody({ id: "earth", name: "Earth" }),
        createBody({ id: "moon", name: "Moon" }),
        createBody({ id: "mars", name: "Mars" }),
      ],
      2,
    );
    runtime.assistTargetIndex = -1;

    const queries = createGameQueries({
      autoDiscoverStrongestInfluence: false,
      autopilotRotationRate: 0.1,
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    });

    expect(queries.getAssistTarget().id).toBe("mars");
  });

  it("derives prediction horizon seconds and step size from runtime horizon hours", () => {
    const runtime = createRuntime([createBody({ id: "earth", name: "Earth" })], 6);
    const queries = createGameQueries({
      autoDiscoverStrongestInfluence: false,
      autopilotRotationRate: 0.1,
      maxPredictionLoopRevolutions: 3,
      predictionSampling: {
        refreshInterval: 0.5,
        stepOptionsSeconds: [10, 60, 300, 1800],
        targetMaxSteps: 100,
      },
      runtime,
    });

    expect(queries.getCoastPredictionHorizonSeconds()).toBe(21_600);
    expect(queries.getPredictionConfig()).toEqual({
      horizonSeconds: 21_600,
      maxLoopRevolutions: 3,
      refreshInterval: 0.5,
      stepSeconds: 300,
    });
  });
});

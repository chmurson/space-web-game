import { describe, expect, it } from "vitest";

import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { createRuntimeScenarioSession } from "./scenarioSession";
import { applyRuntimeScenarioDirectiveConstraints, getConstrainedTimeWarpIndex, resolveRuntimeScenarioDirectives } from "./scenarioDirectives";
import { getRuntimeScenarioDefinition } from "./scenarioRegistry";

const createRuntime = (): AppRuntimeState => ({
  assistMode: "off",
  assistTargetIndex: 0,
  coastPredictionHorizonHours: 24,
  crashedBodyName: null,
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: "",
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  scenarioDirectives: {
    forcedAssistTargetId: null,
    hiddenBodyIds: [],
    maxCoastPredictionHorizonHours: null,
    maxTimeWarp: null,
    maxViewportSize: null,
    minViewportSize: null,
  },
  scenarioSession: createRuntimeScenarioSession("tutorial", {
    forcedAssistTargetId: "moon",
    hiddenBodyIds: ["moon"],
  }),
  spacecraftLabelIntroUntil: 0,
  state: {
    elapsed: 0,
    bodies: [],
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
  timeWarpIndex: 3,
  viewportSize: 900,
});

describe("scenarioDirectives", () => {
  it("resolves generic forced target and hidden body directives from scenario state", () => {
    const runtime = createRuntime();
    runtime.scenarioSession = createRuntimeScenarioSession("custom", {
      forcedAssistTargetId: "moon",
      hiddenBodyIds: ["moon"],
    });

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: 50,
      timeWarps: [1, 10, 100, 1000],
    });

    expect(directives.forcedAssistTargetId).toBe("moon");
    expect(directives.hiddenBodyIds).toEqual(["moon"]);
  });

  it("constrains runtime state to directive caps", () => {
    const runtime = createRuntime();
    runtime.scenarioDirectives = {
      forcedAssistTargetId: null,
      hiddenBodyIds: [],
      maxCoastPredictionHorizonHours: 12,
      maxTimeWarp: 100,
      maxViewportSize: 400,
      minViewportSize: 80,
    };

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: 50,
      timeWarps: [1, 10, 100, 1000],
    });

    expect(runtime.coastPredictionHorizonHours).toBe(12);
    expect(runtime.timeWarpIndex).toBe(2);
    expect(runtime.viewportSize).toBe(400);
  });

  it("keeps time warp index within the configured max warp cap", () => {
    expect(getConstrainedTimeWarpIndex(3, [1, 10, 100, 1000], 100)).toBe(2);
    expect(getConstrainedTimeWarpIndex(1, [1, 10, 100, 1000], null)).toBe(1);
  });

  it("derives tutorial phase-1 directives from tutorial scenario state", () => {
    const runtime = createRuntime();
    runtime.scenarioSession = getRuntimeScenarioDefinition("tutorial")?.createScenario().scenarioSession ?? runtime.scenarioSession;

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: 50,
      timeWarps: [1, 10, 50, 100, 500, 2000],
    });

    expect(directives).toEqual({
      forcedAssistTargetId: "earth",
      hiddenBodyIds: ["moon"],
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 500,
      maxViewportSize: 104,
      minViewportSize: null,
    });
  });
});

import { describe, expect, it } from "vitest";

import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { EARTH_MOON_DISTANCE } from "../simulation/constants";
import { createDefaultScenarioDirectives } from "./scenarioDirectiveTypes";
import { createRuntimeScenarioSession } from "./scenarioSession";
import { registerTutorialScenario } from "./tutorialScenario";

const createRuntime = (): AppRuntimeState => ({
  assistMode: "off",
  assistTargetIndex: 0,
  coastPredictionHorizonHours: 2,
  crashedBodyName: null,
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: "",
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  scenarioDirectives: createDefaultScenarioDirectives(),
  scenarioSession: createRuntimeScenarioSession("tutorial", { phase: "escape-earth", pendingPrompt: null }),
  spacecraftLabelIntroUntil: 0,
  state: {
    elapsed: 0,
    bodies: [
      {
        id: "earth",
        name: "Earth",
        mass: 5.9722e24,
        radius: 6_371_000,
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        color: "#2f80ed",
      },
      {
        id: "moon",
        name: "Moon",
        mass: 7.342e22,
        radius: 1_737_400,
        position: { x: 384_400_000, y: 0 },
        velocity: { x: 0, y: 1022 },
        color: "#9aa0a6",
      },
    ],
    controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
    spacecraft: {
      position: { x: 6_371_000 * 5.2, y: 0 },
      velocity: { x: 0, y: 500 },
      heading: 0,
      fuel: 1,
      fuelUsed: 0,
      dryMass: 10_000,
      fuelMass: 8_000,
      fuelCapacity: 32_000,
    },
  },
  targetHeading: null,
  timeWarpIndex: 0,
  viewportSize: 104,
});

describe("tutorialScenario", () => {
  it("creates a tutorial runtime scenario with phase-1 session state", () => {
    const tutorialScenario = registerTutorialScenario();
    const scenario = tutorialScenario.createScenario();

    expect(scenario.id).toBe("tutorial");
    expect(scenario.coastPredictionHorizonHours).toBe(2);
    expect(scenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      scenarioId: "tutorial",
      state: { phase: "escape-earth", pendingPrompt: "phase-one-intro" },
    });
  });

  it("registers tutorial state validation and phase-1 directives", () => {
    const tutorialScenario = registerTutorialScenario();

    expect(tutorialScenario.isState?.({ phase: "escape-earth" })).toBe(true);
    expect(tutorialScenario.isState?.({ phase: "unknown" })).toBe(false);
    expect(tutorialScenario.isState?.(null)).toBe(false);
    expect(
      tutorialScenario.getDirectives?.(
        { phase: "escape-earth", pendingPrompt: "phase-one-intro" },
        {
          maxCoastPredictionHorizonHours: 48,
          defaultViewportSize: 520,
          maxViewportSize: 800,
          minViewportSize: 50,
          timeWarps: [1, 10, 50, 100, 500, 2000],
        },
      ),
    ).toEqual({
      forcedAssistTargetId: "earth",
      hiddenBodyIds: ["moon"],
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 500,
      maxViewportSize: 104,
      minViewportSize: null,
    });
    expect(tutorialScenario.getHudContent?.({ phase: "escape-earth", pendingPrompt: "phase-one-intro" })).toEqual({
      title: "Tutorial: Escape Earth",
      description: "Build an outbound path and get at least five Earth radii away from the planet.",
    });
    expect(tutorialScenario.getPromptContent?.({ phase: "escape-earth", pendingPrompt: "phase-one-intro" })).toEqual({
      title: "Leave Earth Orbit",
      description: "Use thrust, turning, double-click heading, and the projected path. Fly far enough away from Earth to move on.",
      confirmLabel: "Start",
    });
  });

  it("advances from phase 1 to phase 2 and captures a checkpoint", () => {
    const tutorialScenario = registerTutorialScenario();
    const runtime = createRuntime();

    tutorialScenario.advance?.(runtime);

    expect(runtime.scenarioSession.state).toEqual({ phase: "reach-moon", pendingPrompt: "phase-two-intro" });
    expect(runtime.scenarioSession.checkpoint).not.toBeNull();
    expect(runtime.scenarioSession.checkpoint?.world).not.toBe(runtime.state);
    expect(runtime.scenarioSession.checkpoint?.world.spacecraft.position.x).toBe(runtime.state.spacecraft.position.x);
    expect(runtime.state.bodies.find((body) => body.id === "moon")?.position.x).toBeCloseTo(0, 6);
    expect(runtime.state.bodies.find((body) => body.id === "moon")?.position.y).toBeCloseTo(EARTH_MOON_DISTANCE, 6);
    expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(true);
    if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
      throw new Error("Expected tutorial scenario state.");
    }
    expect(
      tutorialScenario.getDirectives?.(runtime.scenarioSession.state, {
        maxCoastPredictionHorizonHours: 48,
        defaultViewportSize: 520,
        maxViewportSize: 800,
        minViewportSize: 50,
        timeWarps: [1, 10, 50, 100, 500, 2000],
      }),
    ).toEqual({
      forcedAssistTargetId: "moon",
      hiddenBodyIds: [],
      maxCoastPredictionHorizonHours: 24,
      maxTimeWarp: 2000,
      maxViewportSize: 1040,
      minViewportSize: null,
    });
    expect(tutorialScenario.getHudContent?.(runtime.scenarioSession.state)).toEqual({
      title: "Tutorial: Reach the Moon",
      description: "Use your outbound trajectory to intercept the Moon and begin working toward lunar orbit.",
    });
    expect(tutorialScenario.getPromptContent?.(runtime.scenarioSession.state)).toEqual({
      title: "Reach the Moon",
      description: "The Moon is now your target. You can zoom out more and look farther ahead. Use that to line up an approach.",
      confirmLabel: "Continue",
    });
    expect(tutorialScenario.acknowledgePrompt?.(runtime)).toBe(true);
    expect(runtime.scenarioSession.state).toEqual({ phase: "reach-moon", pendingPrompt: null });
  });
});

import { createEarthMoonScenario } from "../simulation/scenarios/earthMoon";
import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { EARTH_MOON_DISTANCE, EARTH_RADIUS, G } from "../simulation/constants";
import { add, length, normalize, scale, sub, vec } from "../simulation/vector";
import { createRuntimeScenarioCheckpoint, createRuntimeScenarioSession } from "./scenarioSession";
import { createDefaultScenarioDirectives, type RuntimeScenarioDirectives, type ScenarioDirectiveLimits } from "./scenarioDirectiveTypes";
import type { RuntimeScenarioDefinition, ScenarioPromptContent } from "./scenarioRegistry";

type TutorialScenarioPhase = "escape-earth" | "reach-moon" | "return-earth" | "complete";

type TutorialScenarioState = {
  phase: TutorialScenarioPhase;
  pendingPrompt: "phase-one-intro" | "phase-two-intro" | null;
};

const createTutorialScenarioSession = (state: TutorialScenarioState = { phase: "escape-earth", pendingPrompt: "phase-one-intro" }) =>
  createRuntimeScenarioSession("tutorial", state);

const isTutorialScenarioState = (value: unknown): value is TutorialScenarioState =>
  typeof value === "object" &&
  value !== null &&
  "phase" in value &&
  (value.phase === "escape-earth" || value.phase === "reach-moon" || value.phase === "return-earth" || value.phase === "complete");

const createTutorialScenario = (): RuntimeScenario => {
  const scenario = createEarthMoonScenario();

  return {
    ...scenario,
    id: "tutorial",
    name: "Tutorial: Escape Earth",
    description: "Leave low Earth orbit and break free from Earth's pull.",
    coastPredictionHorizonHours: 2,
    scenarioSession: createTutorialScenarioSession(),
  };
};

const getTutorialScenarioDirectives = (
  state: TutorialScenarioState,
  limits: ScenarioDirectiveLimits,
): RuntimeScenarioDirectives => {
  if (state.phase === "escape-earth") {
    return {
      ...createDefaultScenarioDirectives(),
      forcedAssistTargetId: "earth",
      hiddenBodyIds: ["moon"],
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 500,
      maxViewportSize: limits.defaultViewportSize / 5,
    };
  }

  if (state.phase === "reach-moon") {
    return {
      ...createDefaultScenarioDirectives(),
      forcedAssistTargetId: "moon",
      maxCoastPredictionHorizonHours: 24,
      maxTimeWarp: 2000,
      maxViewportSize: limits.defaultViewportSize / 0.5,
    };
  }

  return createDefaultScenarioDirectives();
};

const getTutorialHudContent = (state: TutorialScenarioState) => {
  if (state.phase === "escape-earth") {
    return {
      title: "Tutorial: Escape Earth",
      description: "Build an outbound path and get at least five Earth radii away from the planet.",
    };
  }

  if (state.phase === "reach-moon") {
    return {
      title: "Tutorial: Reach the Moon",
      description: "Use your outbound trajectory to intercept the Moon and begin working toward lunar orbit.",
    };
  }

  if (state.phase === "return-earth") {
    return {
      title: "Tutorial: Return to Earth",
      description: "Leave the Moon behind and shape a return trajectory back toward Earth.",
    };
  }

  return {
    title: "Tutorial Complete",
    description: "You reached the end of the current tutorial flow.",
  };
};

const getTutorialPromptContent = (state: TutorialScenarioState): ScenarioPromptContent | null => {
  if (state.pendingPrompt === "phase-one-intro") {
    return {
      title: "Leave Earth Orbit",
      description: "Use thrust, rotation, double-click heading, and the projected path. Get at least five Earth radii away from Earth to continue.",
      confirmLabel: "Start",
    };
  }

  if (state.pendingPrompt === "phase-two-intro") {
    return {
      title: "Reach the Moon",
      description: "The Moon is now your target. Use the longer horizon and wider zoom range to shape an intercept toward lunar orbit.",
      confirmLabel: "Continue",
    };
  }

  return null;
};

const positionMoonForPhaseTwo = (runtime: AppRuntimeState) => {
  const earth = runtime.state.bodies.find((body) => body.id === "earth");
  const moon = runtime.state.bodies.find((body) => body.id === "moon");
  if (!earth || !moon) {
    return;
  }

  const spacecraftRelativeVelocity = sub(runtime.state.spacecraft.velocity, earth.velocity);
  const outboundReference = length(spacecraftRelativeVelocity) > 1 ? spacecraftRelativeVelocity : sub(runtime.state.spacecraft.position, earth.position);
  const outboundDirection = normalize(outboundReference);
  const moonDirection = length(outboundDirection) > 0 ? outboundDirection : vec(1, 0);
  const tangentialDirection = {
    x: -moonDirection.y,
    y: moonDirection.x,
  };
  const moonOrbitSpeed = Math.sqrt((G * earth.mass) / EARTH_MOON_DISTANCE);

  moon.position = add(earth.position, scale(moonDirection, EARTH_MOON_DISTANCE));
  moon.velocity = add(earth.velocity, scale(tangentialDirection, moonOrbitSpeed));
};

const advanceTutorialScenario = (runtime: AppRuntimeState) => {
  if (!isTutorialScenarioState(runtime.scenarioSession.state)) {
    return;
  }

  if (runtime.scenarioSession.state.phase !== "escape-earth") {
    return;
  }

  const earth = runtime.state.bodies.find((body) => body.id === "earth");
  if (!earth) {
    return;
  }

  const distanceFromEarth = length(sub(runtime.state.spacecraft.position, earth.position));
  if (distanceFromEarth < EARTH_RADIUS * 5) {
    return;
  }

  positionMoonForPhaseTwo(runtime);

  runtime.scenarioSession = {
    ...runtime.scenarioSession,
    checkpoint: createRuntimeScenarioCheckpoint({
      assistMode: runtime.assistMode,
      assistTargetIndex: runtime.assistTargetIndex,
      coastPredictionHorizonHours: runtime.coastPredictionHorizonHours,
      targetHeading: runtime.targetHeading,
      viewportSize: runtime.viewportSize,
      world: runtime.state,
    }),
    state: { phase: "reach-moon", pendingPrompt: "phase-two-intro" },
  };
};

const acknowledgeTutorialPrompt = (runtime: AppRuntimeState) => {
  if (!isTutorialScenarioState(runtime.scenarioSession.state) || runtime.scenarioSession.state.pendingPrompt === null) {
    return false;
  }

  runtime.scenarioSession = {
    ...runtime.scenarioSession,
    state: {
      ...runtime.scenarioSession.state,
      pendingPrompt: null,
    },
  };
  return true;
};

export const registerTutorialScenario = (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
  acknowledgePrompt: acknowledgeTutorialPrompt,
  advance: advanceTutorialScenario,
  id: "tutorial",
  createScenario: createTutorialScenario,
  getDirectives: getTutorialScenarioDirectives,
  getHudContent: getTutorialHudContent,
  getPromptContent: getTutorialPromptContent,
  isState: isTutorialScenarioState,
  shouldAutoRestartOnCrash: () => true,
});

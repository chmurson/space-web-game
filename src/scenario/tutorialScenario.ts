import { createEarthMoonScenario } from "../simulation/scenarios/earthMoon";
import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import { EARTH_MOON_DISTANCE, EARTH_RADIUS, G } from "../simulation/constants";
import { add, length, normalize, scale, sub, vec } from "../simulation/vector";
import { createRuntimeScenarioCheckpoint, createRuntimeScenarioSession } from "./scenarioSession";
import { createDefaultScenarioDirectives, type RuntimeScenarioDirectives, type ScenarioDirectiveLimits } from "./scenarioDirectiveTypes";
import type { RuntimeScenarioDefinition } from "./scenarioRegistry";

type TutorialScenarioPhase = "escape-earth" | "reach-moon" | "return-earth" | "complete";

type TutorialScenarioState = {
  phase: TutorialScenarioPhase;
};

const createTutorialScenarioSession = (state: TutorialScenarioState = { phase: "escape-earth" }) =>
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
    state: { phase: "reach-moon" },
  };
};

export const registerTutorialScenario = (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
  advance: advanceTutorialScenario,
  id: "tutorial",
  createScenario: createTutorialScenario,
  getDirectives: getTutorialScenarioDirectives,
  isState: isTutorialScenarioState,
});

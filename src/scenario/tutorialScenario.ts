import { createEarthMoonScenario } from "../simulation/scenarios/earthMoon";
import type { RuntimeScenario } from "../debugScenarioSnapshot";
import { createRuntimeScenarioSession, type RuntimeScenarioSession } from "./scenarioSession";
import { createDefaultScenarioDirectives, type RuntimeScenarioDirectives, type ScenarioDirectiveLimits } from "./scenarioDirectives";

export type TutorialScenarioPhase = "escape-earth" | "reach-moon" | "return-earth" | "complete";

export type TutorialScenarioState = {
  phase: TutorialScenarioPhase;
};

export const createTutorialScenarioSession = (
  state: TutorialScenarioState = { phase: "escape-earth" },
): RuntimeScenarioSession<TutorialScenarioState> => createRuntimeScenarioSession("tutorial", state);

export const isTutorialScenarioState = (value: unknown): value is TutorialScenarioState =>
  typeof value === "object" &&
  value !== null &&
  "phase" in value &&
  (value.phase === "escape-earth" || value.phase === "reach-moon" || value.phase === "return-earth" || value.phase === "complete");

export const createTutorialScenario = (): RuntimeScenario => {
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

export const getTutorialScenarioDirectives = (
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

  return createDefaultScenarioDirectives();
};

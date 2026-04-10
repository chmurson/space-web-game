import { createEarthMoonScenario } from "../simulation/scenarios/earthMoon";
import type { RuntimeScenario } from "../debugScenarioSnapshot";
import { createRuntimeScenarioSession } from "./scenarioSession";
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

  return createDefaultScenarioDirectives();
};

export const registerTutorialScenario = (): RuntimeScenarioDefinition<TutorialScenarioState> => ({
  id: "tutorial",
  createScenario: createTutorialScenario,
  getDirectives: getTutorialScenarioDirectives,
  isState: isTutorialScenarioState,
});

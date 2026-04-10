import { describe, expect, it } from "vitest";

import { createTutorialScenario, isTutorialScenarioState } from "./tutorialScenario";

describe("tutorialScenario", () => {
  it("creates a tutorial runtime scenario with phase-1 session state", () => {
    const scenario = createTutorialScenario();

    expect(scenario.id).toBe("tutorial");
    expect(scenario.coastPredictionHorizonHours).toBe(2);
    expect(scenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      scenarioId: "tutorial",
      state: { phase: "escape-earth" },
    });
  });

  it("recognizes valid tutorial scenario state values", () => {
    expect(isTutorialScenarioState({ phase: "escape-earth" })).toBe(true);
    expect(isTutorialScenarioState({ phase: "unknown" })).toBe(false);
    expect(isTutorialScenarioState(null)).toBe(false);
  });
});

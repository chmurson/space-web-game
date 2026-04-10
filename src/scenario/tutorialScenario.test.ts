import { describe, expect, it } from "vitest";

import { createTutorialScenario, getTutorialScenarioDirectives, isTutorialScenarioState } from "./tutorialScenario";

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

  it("derives phase-1 directives from tutorial state", () => {
    expect(
      getTutorialScenarioDirectives(
        { phase: "escape-earth" },
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
  });
});

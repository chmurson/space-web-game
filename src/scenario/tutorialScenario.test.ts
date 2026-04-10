import { describe, expect, it } from "vitest";

import { registerTutorialScenario } from "./tutorialScenario";

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
      state: { phase: "escape-earth" },
    });
  });

  it("registers tutorial state validation and phase-1 directives", () => {
    const tutorialScenario = registerTutorialScenario();

    expect(tutorialScenario.isState?.({ phase: "escape-earth" })).toBe(true);
    expect(tutorialScenario.isState?.({ phase: "unknown" })).toBe(false);
    expect(tutorialScenario.isState?.(null)).toBe(false);
    expect(
      tutorialScenario.getDirectives?.(
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

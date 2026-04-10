import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { RuntimeScenarioDirectives, ScenarioDirectiveLimits } from "./scenarioDirectiveTypes";
import type { ScenarioSessionValue } from "./scenarioSession";
import { registerTutorialScenario } from "./tutorialScenario";
import { createEarthMoonScenario, createMoonCaptureDebugScenario } from "../simulation/scenarios/earthMoon";

export type RuntimeScenarioDefinition<TState extends ScenarioSessionValue = ScenarioSessionValue> = {
  createScenario(): RuntimeScenario;
  getDirectives?(state: TState, limits: ScenarioDirectiveLimits): RuntimeScenarioDirectives;
  id: string;
  isState?(value: unknown): value is TState;
};

const runtimeScenarioDefinitions = {
  "earth-moon": {
    id: "earth-moon",
    createScenario: createEarthMoonScenario,
  },
  "moon-capture-debug": {
    id: "moon-capture-debug",
    createScenario: createMoonCaptureDebugScenario,
  },
  tutorial: registerTutorialScenario(),
} satisfies Record<string, RuntimeScenarioDefinition>;

export const getRuntimeScenarioDefinition = (scenarioId: string): RuntimeScenarioDefinition | null =>
  runtimeScenarioDefinitions[scenarioId as keyof typeof runtimeScenarioDefinitions] ?? null;

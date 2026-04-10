import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { RuntimeScenarioDirectives, ScenarioDirectiveLimits } from "./scenarioDirectives";
import type { ScenarioSessionValue } from "./scenarioSession";
import {
  createTutorialScenario,
  getTutorialScenarioDirectives,
  isTutorialScenarioState,
  type TutorialScenarioState,
} from "./tutorialScenario";
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
  tutorial: {
    id: "tutorial",
    createScenario: createTutorialScenario,
    getDirectives: (state: TutorialScenarioState, limits: ScenarioDirectiveLimits) => getTutorialScenarioDirectives(state, limits),
    isState: isTutorialScenarioState,
  },
} satisfies Record<string, RuntimeScenarioDefinition>;

export const getRuntimeScenarioDefinition = (scenarioId: string): RuntimeScenarioDefinition | null =>
  runtimeScenarioDefinitions[scenarioId as keyof typeof runtimeScenarioDefinitions] ?? null;

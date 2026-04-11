import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { RuntimeScenarioDirectives, ScenarioDirectiveLimits } from "./scenarioDirectiveTypes";
import type { ScenarioSessionValue } from "./scenarioSession";
import { registerTutorialScenario } from "./tutorialScenario";
import { createEarthMoonScenario, createMoonCaptureDebugScenario } from "../simulation/scenarios/earthMoon";

export type RuntimeScenarioDefinition<TState extends ScenarioSessionValue = ScenarioSessionValue> = {
  advance?(runtime: AppRuntimeState): void;
  createScenario(): RuntimeScenario;
  getDirectives?(state: TState, limits: ScenarioDirectiveLimits): RuntimeScenarioDirectives;
  getHudContent?(state: TState): { description: string; title: string };
  id: string;
  isState?(value: unknown): value is TState;
  shouldAutoRestartOnCrash?(runtime: AppRuntimeState): boolean;
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

export const advanceRuntimeScenario = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  definition?.advance?.(runtime);
};

export const shouldAutoRestartRuntimeScenarioOnCrash = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  return definition?.shouldAutoRestartOnCrash?.(runtime) ?? false;
};

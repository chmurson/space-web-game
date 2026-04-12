import type { RuntimeScenario } from "../debugScenarioSnapshot";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { RuntimeScenarioDirectives, ScenarioDirectiveLimits } from "./scenarioDirectiveTypes";
import type { ScenarioSessionValue } from "./scenarioSession";
import { registerTutorialScenario } from "./tutorialScenario";
import { createEarthMoonScenario, createMoonCaptureDebugScenario } from "../simulation/scenarios/earthMoon";

export type ScenarioPromptAction = "exit-tutorial";

export type ScenarioPromptContent = {
  confirmLabel: string;
  description: string;
  secondaryAction?: ScenarioPromptAction;
  secondaryLabel?: string;
  title: string;
};

export type RuntimeScenarioDefinition<TState extends ScenarioSessionValue = ScenarioSessionValue> = {
  acknowledgePrompt?(runtime: AppRuntimeState): boolean;
  advance?(runtime: AppRuntimeState): void;
  createScenario(): RuntimeScenario;
  getDirectives?(state: TState, limits: ScenarioDirectiveLimits): RuntimeScenarioDirectives;
  getHudContent?(state: TState): { description: string; title: string };
  getPromptContent?(state: TState): ScenarioPromptContent | null;
  getReplayPromptContent?(state: TState): ScenarioPromptContent | null;
  id: string;
  isState?(value: unknown): value is TState;
  reopenPrompt?(runtime: AppRuntimeState): boolean;
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

export const getRuntimeScenarioPromptContent = (runtime: AppRuntimeState): ScenarioPromptContent | null => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  if (!definition?.getPromptContent) {
    return null;
  }

  if (definition.isState && !definition.isState(runtime.scenarioSession.state)) {
    return null;
  }

  return definition.getPromptContent(runtime.scenarioSession.state);
};

export const acknowledgeRuntimeScenarioPrompt = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  return definition?.acknowledgePrompt?.(runtime) ?? false;
};

export const getRuntimeScenarioReplayPromptContent = (runtime: AppRuntimeState): ScenarioPromptContent | null => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  if (!definition?.getReplayPromptContent) {
    return null;
  }

  if (definition.isState && !definition.isState(runtime.scenarioSession.state)) {
    return null;
  }

  return definition.getReplayPromptContent(runtime.scenarioSession.state);
};

export const reopenRuntimeScenarioPrompt = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  return definition?.reopenPrompt?.(runtime) ?? false;
};

export const shouldAutoRestartRuntimeScenarioOnCrash = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(runtime.scenarioSession.scenarioId);
  return definition?.shouldAutoRestartOnCrash?.(runtime) ?? false;
};

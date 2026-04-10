import {
  createScenarioFromSnapshot,
  createSnapshotFromState,
  readDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
  type DebugScenarioSnapshot,
  type RuntimeScenario,
} from "../debugScenarioSnapshot";
import { cloneRuntimeScenarioSession, createRuntimeScenarioSession } from "./scenarioSession";
import { createEarthMoonScenario, createMoonCaptureDebugScenario } from "../simulation/scenarios/earthMoon";
import { idleControls } from "../simulation/state";
import type { SimulationState } from "../simulation/types";

export type RuntimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: number;
  defaultViewportSize: number;
  maxCoastPredictionHorizonHours: number;
  maxViewportSize: number;
  minCoastPredictionHorizonHours: number;
  minViewportSize: number;
};

export type RuntimeScenarioState = {
  coastPredictionHorizonHours: number;
  scenarioSession: ReturnType<typeof createRuntimeScenarioSession>;
  state: SimulationState;
  viewportSize: number;
};

export type LoadedDebugRuntimeScenario = {
  runtimeState: RuntimeScenarioState;
  snapshot: DebugScenarioSnapshot;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createRequestedRuntimeScenario = (requestedScenario: string): RuntimeScenario => {
  if (requestedScenario === "moon-capture-debug") {
    return createMoonCaptureDebugScenario();
  }

  if (requestedScenario === "debug-snapshot") {
    const snapshot = readDebugScenarioSnapshot();
    if (snapshot) {
      return createScenarioFromSnapshot(snapshot);
    }
  }

  return createEarthMoonScenario();
};

export const createRuntimeScenarioState = (
  scenario: RuntimeScenario,
  options: RuntimeScenarioOptions,
): RuntimeScenarioState => ({
  coastPredictionHorizonHours: clamp(
    scenario.coastPredictionHorizonHours ?? options.defaultCoastPredictionHorizonHours,
    options.minCoastPredictionHorizonHours,
    options.maxCoastPredictionHorizonHours,
  ),
  scenarioSession: scenario.scenarioSession ? cloneRuntimeScenarioSession(scenario.scenarioSession) : createRuntimeScenarioSession(scenario.id),
  state: {
    elapsed: scenario.elapsed ?? 0,
    bodies: scenario.bodies,
    spacecraft: scenario.spacecraft,
    controls: idleControls(),
  },
  viewportSize: clamp(scenario.viewportSize ?? options.defaultViewportSize, options.minViewportSize, options.maxViewportSize),
});

export const saveRuntimeDebugSnapshot = (
  state: SimulationState,
  options: {
    coastPredictionHorizonHours: number;
    scenarioSession: RuntimeScenarioState["scenarioSession"];
    viewportSize: number;
  },
) => {
  try {
    writeDebugScenarioSnapshot(createSnapshotFromState(state, options));
    return true;
  } catch {
    return false;
  }
};

export const loadDebugRuntimeScenario = (options: RuntimeScenarioOptions): LoadedDebugRuntimeScenario | null => {
  const snapshot = readDebugScenarioSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    runtimeState: createRuntimeScenarioState(createScenarioFromSnapshot(snapshot), options),
    snapshot,
  };
};

import { cloneBodies, cloneSpacecraft } from "./simulation/state";
import type { Body, Scenario, SimulationState, Spacecraft } from "./simulation/types";

const debugSnapshotStorageKey = "space-web-game.debugScenarioSnapshot.v1";

export type DebugScenarioSnapshot = {
  version: 1;
  savedAt: string;
  elapsed: number;
  viewportSize?: number;
  coastPredictionHorizonHours?: number;
  coastPredictionHorizonMultiplier?: number;
  bodies: Body[];
  spacecraft: Spacecraft;
};

export type RuntimeScenario = Scenario & { elapsed?: number; viewportSize?: number; coastPredictionHorizonHours?: number };

const getSnapshotCoastPredictionHorizonHours = (snapshot: DebugScenarioSnapshot) =>
  snapshot.coastPredictionHorizonHours ?? (snapshot.coastPredictionHorizonMultiplier ? snapshot.coastPredictionHorizonMultiplier * 4 : undefined);

export const createScenarioFromSnapshot = (snapshot: DebugScenarioSnapshot): RuntimeScenario => ({
  id: "debug-snapshot",
  name: "Debug snapshot",
  description: `Frozen debug state from ${new Date(snapshot.savedAt).toLocaleString()}.`,
  elapsed: snapshot.elapsed,
  viewportSize: snapshot.viewportSize,
  coastPredictionHorizonHours: getSnapshotCoastPredictionHorizonHours(snapshot),
  bodies: cloneBodies(snapshot.bodies),
  spacecraft: cloneSpacecraft(snapshot.spacecraft),
});

export const createSnapshotFromState = (
  state: SimulationState,
  options: { viewportSize?: number; coastPredictionHorizonHours?: number } = {},
): DebugScenarioSnapshot => ({
  version: 1,
  savedAt: new Date().toISOString(),
  elapsed: state.elapsed,
  viewportSize: options.viewportSize,
  coastPredictionHorizonHours: options.coastPredictionHorizonHours,
  bodies: cloneBodies(state.bodies),
  spacecraft: cloneSpacecraft(state.spacecraft),
});

export const readDebugScenarioSnapshot = (): DebugScenarioSnapshot | null => {
  try {
    const rawSnapshot = window.localStorage.getItem(debugSnapshotStorageKey);
    if (!rawSnapshot) {
      return null;
    }

    const snapshot = JSON.parse(rawSnapshot) as DebugScenarioSnapshot;
    return snapshot.version === 1 && Array.isArray(snapshot.bodies) && snapshot.spacecraft ? snapshot : null;
  } catch {
    return null;
  }
};

export const writeDebugScenarioSnapshot = (snapshot: DebugScenarioSnapshot) => {
  window.localStorage.setItem(debugSnapshotStorageKey, JSON.stringify(snapshot));
};

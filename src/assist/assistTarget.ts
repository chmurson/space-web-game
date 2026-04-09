import { getStrongestInfluenceBody } from "../simulation/bodyInfluence";
import type { Body, SimulationState } from "../simulation/types";

export type AssistTargetSelection = {
  autoDiscoverStrongestInfluence: boolean;
  selectedIndex: number;
};

export const getAssistTargetForState = (simulationState: SimulationState, selection: AssistTargetSelection): Body => {
  if (simulationState.bodies.length === 0) {
    throw new Error("Cannot select an assist target without bodies.");
  }

  if (selection.autoDiscoverStrongestInfluence) {
    return getStrongestInfluenceBody(simulationState);
  }

  const selectedIndex = ((selection.selectedIndex % simulationState.bodies.length) + simulationState.bodies.length) % simulationState.bodies.length;
  return simulationState.bodies[selectedIndex] ?? simulationState.bodies[0];
};

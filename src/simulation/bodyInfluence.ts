import { G } from "./constants";
import type { Body, SimulationState } from "./types";
import { lengthSq, sub } from "./vector";

export type BodyInfluence = {
  acceleration: number;
  body: Body;
  share: number;
};

export const getBodyInfluences = (simulationState: SimulationState): BodyInfluence[] => {
  const influences = simulationState.bodies.map((body) => {
    const distanceSquared = Math.max(lengthSq(sub(body.position, simulationState.spacecraft.position)), 1);
    return {
      body,
      acceleration: (G * body.mass) / distanceSquared,
    };
  });
  const totalAcceleration = influences.reduce((sum, influence) => sum + influence.acceleration, 0);

  return influences
    .map((influence) => ({
      ...influence,
      share: totalAcceleration > 0 ? influence.acceleration / totalAcceleration : 0,
    }))
    .sort((a, b) => b.acceleration - a.acceleration);
};

export const getStrongestInfluenceBody = (simulationState: SimulationState) => getBodyInfluences(simulationState)[0]?.body ?? simulationState.bodies[0];

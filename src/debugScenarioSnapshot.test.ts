import { describe, expect, it } from "vitest";

import { createScenarioFromSnapshot } from "./debugScenarioSnapshot";

const snapshotBase = {
  version: 1 as const,
  savedAt: "2026-04-10T10:00:00.000Z",
  elapsed: 42,
  viewportSize: 320,
  bodies: [
    {
      id: "earth",
      name: "Earth",
      mass: 5.97e24,
      radius: 6_371_000,
      position: { x: 1, y: 2 },
      velocity: { x: 3, y: 4 },
      color: "#4f86f7",
    },
  ],
  spacecraft: {
    position: { x: 5, y: 6 },
    velocity: { x: 7, y: 8 },
    heading: 0.1,
    fuel: 9,
    fuelUsed: 10,
    dryMass: 11,
    fuelMass: 12,
    fuelCapacity: 13,
  },
};

describe("createScenarioFromSnapshot", () => {
  it("prefers explicit horizon hours from the snapshot", () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonHours: 12,
      coastPredictionHorizonMultiplier: 3,
    });

    expect(scenario.coastPredictionHorizonHours).toBe(12);
    expect(scenario.viewportSize).toBe(320);
    expect(scenario.elapsed).toBe(42);
  });

  it("falls back to legacy horizon multiplier snapshots", () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonMultiplier: 3,
    });

    expect(scenario.coastPredictionHorizonHours).toBe(12);
  });

  it("clones bodies and spacecraft so snapshot data stays immutable", () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonHours: 12,
    });

    expect(scenario.bodies).not.toBe(snapshotBase.bodies);
    expect(scenario.bodies[0]).not.toBe(snapshotBase.bodies[0]);
    expect(scenario.spacecraft).not.toBe(snapshotBase.spacecraft);

    scenario.bodies[0].position.x = 999;
    scenario.spacecraft.position.y = 999;

    expect(snapshotBase.bodies[0].position.x).toBe(1);
    expect(snapshotBase.spacecraft.position.y).toBe(6);
  });
});

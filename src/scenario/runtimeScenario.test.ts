import { describe, expect, it } from "vitest";

import {
	createRuntimeScenarioState,
	type RuntimeScenarioOptions,
} from "./runtimeScenario";

const options: RuntimeScenarioOptions = {
	defaultCoastPredictionHorizonHours: 1,
	defaultViewportSize: 200,
	maxCoastPredictionHorizonHours: 48,
	maxViewportSize: 800,
	minCoastPredictionHorizonHours: 0.5,
	minViewportSize: 50,
};

describe("createRuntimeScenarioState", () => {
	it("clamps horizon and viewport to configured bounds", () => {
		const runtimeScenario = createRuntimeScenarioState(
			{
				id: "test",
				name: "Test",
				description: "Test scenario",
				elapsed: 123,
				coastPredictionHorizonHours: 100,
				viewportSize: 10,
				bodies: [],
				spacecraft: {
					position: { x: 1, y: 2 },
					velocity: { x: 3, y: 4 },
					heading: 0.2,
					fuel: 10,
					fuelUsed: 1,
					dryMass: 2,
					fuelMass: 3,
					fuelCapacity: 4,
				},
			},
			options,
		);

		expect(runtimeScenario.coastPredictionHorizonHours).toBe(48);
		expect(runtimeScenario.scenarioSession).toEqual({
			checkpoint: null,
			completed: false,
			scenarioId: "test",
			state: null,
		});
		expect(runtimeScenario.viewportSize).toBe(50);
		expect(runtimeScenario.state.elapsed).toBe(123);
		expect(runtimeScenario.state.controls).toEqual({
			main: 0,
			reverse: 0,
			strafe: 0,
			turn: 0,
		});
	});

	it("falls back to default horizon and viewport when the scenario does not define them", () => {
		const runtimeScenario = createRuntimeScenarioState(
			{
				id: "test",
				name: "Test",
				description: "Test scenario",
				bodies: [],
				spacecraft: {
					position: { x: 0, y: 0 },
					velocity: { x: 0, y: 0 },
					heading: 0,
					fuel: 0,
					fuelUsed: 0,
					dryMass: 1,
					fuelMass: 0,
					fuelCapacity: 0,
				},
			},
			options,
		);

		expect(runtimeScenario.coastPredictionHorizonHours).toBe(1);
		expect(runtimeScenario.viewportSize).toBe(200);
		expect(runtimeScenario.state.elapsed).toBe(0);
	});

	it("preserves provided scenario session metadata", () => {
		const runtimeScenario = createRuntimeScenarioState(
			{
				id: "debug-snapshot",
				name: "Debug snapshot",
				description: "Debug snapshot",
				scenarioSession: {
					checkpoint: null,
					completed: false,
					scenarioId: "tutorial",
					state: { phase: "return-earth" },
				},
				bodies: [],
				spacecraft: {
					position: { x: 0, y: 0 },
					velocity: { x: 0, y: 0 },
					heading: 0,
					fuel: 0,
					fuelUsed: 0,
					dryMass: 1,
					fuelMass: 0,
					fuelCapacity: 0,
				},
			},
			options,
		);

		expect(runtimeScenario.scenarioSession).toEqual({
			checkpoint: null,
			completed: false,
			scenarioId: "tutorial",
			state: { phase: "return-earth" },
		});
	});
});

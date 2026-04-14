import {
	createRuntimeScenarioSession,
	type ScenarioSessionValue,
} from "./scenarioSession";
import type { RuntimeScenarioDefinition } from "./scenarioRegistry";
import { createEarthMoonScenario } from "../simulation/scenarios/earthMoon";
import { G } from "../simulation/constants";

type MenuBackgroundScenarioState = ScenarioSessionValue & {
	cameraFollowBodyId: "earth";
	cameraFollowOffsetX: number;
	cameraFollowOffsetY: number;
	hiddenBodyIds: ["moon"];
};

export const registerMenuBackgroundScenario =
	(): RuntimeScenarioDefinition<MenuBackgroundScenarioState> => ({
		id: "menu-background",
		createScenario: () => {
			const scenario = createEarthMoonScenario();
			const earth = scenario.bodies.find((body) => body.id === "earth");

			if (!earth) {
				return {
					...scenario,
					id: "menu-background",
					name: "Menu background",
					scenarioSession: createRuntimeScenarioSession("menu-background"),
				};
			}

			const orbitRadius = earth.radius + 1_000_000;
			const orbitSpeed = Math.sqrt((G * earth.mass) / orbitRadius) * 1.01;

			return {
				...scenario,
				id: "menu-background",
				name: "Menu background",
				viewportSize: 50,
				scenarioSession: createRuntimeScenarioSession("menu-background", {
					cameraFollowBodyId: "earth",
					cameraFollowOffsetX: 4_000_000,
					cameraFollowOffsetY: 4_000_000,
					hiddenBodyIds: ["moon"],
				}),
				spacecraft: {
					...scenario.spacecraft,
					heading: Math.PI / 2,
					position: {
						x: earth.position.x + orbitRadius,
						y: earth.position.y,
					},
					velocity: {
						x: earth.velocity.x,
						y: earth.velocity.y + orbitSpeed,
					},
				},
			};
		},
	});

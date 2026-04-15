import { describe, expect, it } from "vitest";

import type { AppRuntimeState } from "../../../runtime/appRuntimeState";
import { EARTH_MOON_DISTANCE, G } from "../../../simulation/constants";
import { createDefaultScenarioDirectives } from "../../scenarioDirectiveTypes";
import { createRuntimeScenarioSession } from "../../scenarioSession";
import { registerTutorialScenario } from "./tutorialScenario";

const createRuntime = (): AppRuntimeState => ({
	assistMode: "off",
	assistTargetIndex: 0,
	coastPredictionHorizonHours: 2,
	crashedBodyName: null,
	debugModeEnabled: false,
	debugNoGravityEnabled: false,
	debugSnapshotStatus: "",
	fpsIndicatorEnabled: false,
	performanceDebugEnabled: false,
	scenarioDirectives: createDefaultScenarioDirectives(),
	scenarioSession: createRuntimeScenarioSession("tutorial", {
		phase: "escape-earth",
		pendingPrompt: null,
	}),
	spacecraftLabelIntroUntil: 0,
	targetHeadingSelectionEpoch: 0,
	uiEffectEpoch: 0,
	state: {
		elapsed: 0,
		bodies: [
			{
				id: "earth",
				name: "Earth",
				mass: 5.9722e24,
				radius: 6_371_000,
				position: { x: 0, y: 0 },
				velocity: { x: 0, y: 0 },
				color: "#2f80ed",
			},
			{
				id: "moon",
				name: "Moon",
				mass: 7.342e22,
				radius: 1_737_400,
				position: { x: 384_400_000, y: 0 },
				velocity: { x: 0, y: 1022 },
				color: "#9aa0a6",
			},
		],
		controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
		spacecraft: {
			position: { x: 6_371_000 * 5.2, y: 0 },
			velocity: { x: 0, y: 500 },
			heading: 0,
			fuel: 1,
			fuelUsed: 0,
			dryMass: 10_000,
			fuelMass: 8_000,
			fuelCapacity: 32_000,
		},
	},
	targetHeading: null,
	timeWarpIndex: 0,
	viewportSize: 104,
});

const setMoonOrbitState = (runtime: AppRuntimeState, angle: number) => {
	const moon = runtime.state.bodies.find((body) => body.id === "moon");
	if (!moon) {
		throw new Error("Expected moon body in runtime.");
	}

	const orbitalRadius = moon.radius + 2_000_000;
	const orbitalSpeed = Math.sqrt((G * moon.mass) / orbitalRadius);
	const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };

	runtime.state.spacecraft.position = {
		x: moon.position.x + Math.cos(angle) * orbitalRadius,
		y: moon.position.y + Math.sin(angle) * orbitalRadius,
	};
	runtime.state.spacecraft.velocity = {
		x: moon.velocity.x + tangent.x * orbitalSpeed,
		y: moon.velocity.y + tangent.y * orbitalSpeed,
	};
};

const setEarthOrbitState = (runtime: AppRuntimeState, angle: number) => {
	const earth = runtime.state.bodies.find((body) => body.id === "earth");
	if (!earth) {
		throw new Error("Expected earth body in runtime.");
	}

	const orbitalRadius = earth.radius + 2_000_000;
	const orbitalSpeed = Math.sqrt((G * earth.mass) / orbitalRadius);
	const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };

	runtime.state.spacecraft.position = {
		x: earth.position.x + Math.cos(angle) * orbitalRadius,
		y: earth.position.y + Math.sin(angle) * orbitalRadius,
	};
	runtime.state.spacecraft.velocity = {
		x: earth.velocity.x + tangent.x * orbitalSpeed,
		y: earth.velocity.y + tangent.y * orbitalSpeed,
	};
};

describe("tutorialScenario", () => {
	it("creates a tutorial runtime scenario with phase-1 session state", () => {
		const tutorialScenario = registerTutorialScenario();
		const scenario = tutorialScenario.createScenario();

		expect(scenario.id).toBe("tutorial");
		expect(scenario.coastPredictionHorizonHours).toBe(2);
		expect(scenario.scenarioSession).toEqual({
			checkpoint: null,
			completed: false,
			scenarioId: "tutorial",
			state: { phase: "escape-earth", pendingPrompt: "phase-one-intro" },
		});
	});

	it("registers tutorial state validation and phase-1 directives", () => {
		const tutorialScenario = registerTutorialScenario();

		expect(tutorialScenario.isState?.({ phase: "escape-earth" })).toBe(true);
		expect(tutorialScenario.isState?.({ phase: "orbit-moon" })).toBe(true);
		expect(tutorialScenario.isState?.({ phase: "orbit-earth" })).toBe(true);
		expect(tutorialScenario.isState?.({ phase: "unknown" })).toBe(false);
		expect(tutorialScenario.isState?.(null)).toBe(false);
		expect(
			tutorialScenario.getDirectives?.(
				{ phase: "escape-earth", pendingPrompt: "phase-one-intro" },
				{
					maxCoastPredictionHorizonHours: 48,
					defaultViewportSize: 520,
					maxViewportSize: 800,
					minViewportSize: 50,
					timeWarps: [1, 10, 50, 100, 500, 2000],
				},
			),
		).toEqual({
			cameraFollowBodyId: null,
			cameraFollowOffset: { x: 0, y: 0 },
			forcedAssistTargetId: "earth",
			hiddenBodyIds: ["moon"],
			hiddenUIElements: new Set(),
			maxCoastPredictionHorizonHours: 2,
			maxTimeWarp: 500,
			maxViewportSize: 104,
			minViewportSize: null,
		});
		expect(
			tutorialScenario.getHudContent?.({
				phase: "escape-earth",
				pendingPrompt: "phase-one-intro",
			}),
		).toEqual({
			title: "Tutorial: Escape Earth",
			description:
				"Build an outbound path and get at least five Earth radii away from the planet.",
		});
		expect(
			tutorialScenario.getPromptContent?.({
				phase: "escape-earth",
				pendingPrompt: "phase-one-intro",
			}),
		).toEqual({
			title: "Leave Earth Orbit",
			description:
				"Use thrust, turning, double-click heading, and the projected path. Fly far enough away from Earth to move on.",
			confirmLabel: "Start",
		});
	});

	it("advances from phase 1 to phase 2 and captures a checkpoint", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();

		tutorialScenario.advance?.(runtime);

		expect(runtime.scenarioSession.state).toEqual({
			phase: "reach-moon",
			pendingPrompt: "phase-two-intro",
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
		expect(runtime.scenarioSession.checkpoint).not.toBeNull();
		expect(runtime.scenarioSession.checkpoint?.world).not.toBe(runtime.state);
		expect(
			runtime.scenarioSession.checkpoint?.world.spacecraft.position.x,
		).toBe(runtime.state.spacecraft.position.x);
		expect(
			runtime.state.bodies.find((body) => body.id === "moon")?.position.x,
		).toBeCloseTo(0, 6);
		expect(
			runtime.state.bodies.find((body) => body.id === "moon")?.position.y,
		).toBeCloseTo(EARTH_MOON_DISTANCE, 6);
		expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(
			true,
		);
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getDirectives?.(runtime.scenarioSession.state, {
				maxCoastPredictionHorizonHours: 48,
				defaultViewportSize: 520,
				maxViewportSize: 800,
				minViewportSize: 50,
				timeWarps: [1, 10, 50, 100, 500, 2000],
			}),
		).toEqual({
			cameraFollowBodyId: null,
			cameraFollowOffset: { x: 0, y: 0 },
			forcedAssistTargetId: "moon",
			hiddenBodyIds: [],
			hiddenUIElements: new Set(),
			maxCoastPredictionHorizonHours: 24,
			maxTimeWarp: 2000,
			maxViewportSize: 1040,
			minViewportSize: null,
		});
		expect(
			tutorialScenario.getHudContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial: Reach the Moon",
			description:
				"Approach the Moon and get close enough to begin the orbit phase.",
		});
		expect(
			tutorialScenario.getPromptContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Reach the Moon",
			description:
				"The Moon is now your target. You can zoom out more and look farther ahead. Use that to line up an approach.",
			confirmLabel: "Continue",
		});
		expect(tutorialScenario.acknowledgePrompt?.(runtime)).toEqual({
			acknowledged: true,
			effect: undefined,
		});
		expect(runtime.scenarioSession.state).toEqual({
			phase: "reach-moon",
			lastAcknowledgedPrompt: "phase-two-intro",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
	});

	it("starts onboarding after the phase-1 intro prompt and gates escape-earth progression", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();
		runtime.scenarioSession = createRuntimeScenarioSession("tutorial", {
			phase: "escape-earth",
			pendingPrompt: "phase-one-intro",
		});

		expect(tutorialScenario.acknowledgePrompt?.(runtime)).toEqual({
			acknowledged: true,
			effect: undefined,
		});

		expect(runtime.scenarioSession.state).toMatchObject({
			phase: "escape-earth",
			pendingPrompt: null,
			onboarding: {
				activeStepId: "intro-thrust",
				gateActive: true,
			},
		});
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getDirectives?.(runtime.scenarioSession.state, {
				maxCoastPredictionHorizonHours: 48,
				defaultViewportSize: 520,
				maxViewportSize: 800,
				minViewportSize: 50,
				timeWarps: [1, 10, 50, 100, 500, 2000],
			}).hiddenUIElements,
		).toEqual(new Set(["scenarioInfoButton", "timeWarpPill", "trajectory"]));

		tutorialScenario.advance?.(runtime);

		expect(runtime.scenarioSession.state).toMatchObject({
			phase: "escape-earth",
			onboarding: {
				activeStepId: "intro-thrust",
				gateActive: true,
			},
		});
	});

	it("switches from moon approach to moon orbit when entering the close-range threshold", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();
		runtime.scenarioSession = createRuntimeScenarioSession("tutorial", {
			phase: "reach-moon",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});

		setMoonOrbitState(runtime, 0);

		tutorialScenario.advance?.(runtime);

		expect(runtime.scenarioSession.state).toEqual({
			phase: "orbit-moon",
			pendingPrompt: "orbit-moon-intro",
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
		expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(
			true,
		);
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getHudContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial: Orbit the Moon",
			description: "Stay captured and complete 3 turns around the Moon (0/3).",
		});
		expect(
			tutorialScenario.getPromptContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Approach the Moon",
			description:
				"You are close to the Moon. Orbit around it three times to complete the lunar phase of the tutorial.",
			confirmLabel: "Continue",
		});
		expect(tutorialScenario.acknowledgePrompt?.(runtime)).toEqual({
			acknowledged: true,
			effect: undefined,
		});
		expect(runtime.scenarioSession.state).toEqual({
			phase: "orbit-moon",
			lastAcknowledgedPrompt: "orbit-moon-intro",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
	});

	it("advances from moon orbit to return-earth after three lunar orbits", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();
		runtime.scenarioSession = createRuntimeScenarioSession("tutorial", {
			phase: "orbit-moon",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});

		const orbitAngles = [
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
		];

		for (const angle of orbitAngles) {
			setMoonOrbitState(runtime, angle);
			tutorialScenario.advance?.(runtime);
		}

		expect(runtime.scenarioSession.state).toEqual({
			phase: "return-earth",
			pendingPrompt: "phase-three-intro",
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
		expect(runtime.scenarioSession.checkpoint).not.toBeNull();
		expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(
			true,
		);
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getHudContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial: Return to Earth",
			description:
				"Leave the Moon behind and get close enough to Earth to begin the final orbit phase.",
		});
		expect(
			tutorialScenario.getPromptContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Return to Earth",
			description:
				"You have completed three lunar orbits. The next goal is to head back toward Earth and get close enough to start the final orbit.",
			confirmLabel: "Continue",
		});
	});

	it("switches from earth return to earth orbit when re-entering Earth range", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();
		runtime.scenarioSession = createRuntimeScenarioSession("tutorial", {
			phase: "return-earth",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});

		setEarthOrbitState(runtime, 0);

		tutorialScenario.advance?.(runtime);

		expect(runtime.scenarioSession.state).toEqual({
			phase: "orbit-earth",
			pendingPrompt: "orbit-earth-intro",
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});
		expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(
			true,
		);
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getHudContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial: Orbit Earth",
			description:
				"Stabilize your return and complete 3 turns around Earth (0/3).",
		});
		expect(
			tutorialScenario.getPromptContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Back at Earth",
			description:
				"You are back in Earth range. Stabilize and complete three Earth orbits to finish the tutorial.",
			confirmLabel: "Continue",
		});
	});

	it("advances from earth orbit to complete after three Earth orbits", () => {
		const tutorialScenario = registerTutorialScenario();
		const runtime = createRuntime();
		runtime.scenarioSession = createRuntimeScenarioSession("tutorial", {
			phase: "orbit-earth",
			pendingPrompt: null,
			orbitProgressRadians: 0,
			orbitTurnsCompleted: 0,
		});

		const orbitAngles = [
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
			Math.PI / 2,
			Math.PI,
			-Math.PI / 2,
			0,
		];

		for (const angle of orbitAngles) {
			setEarthOrbitState(runtime, angle);
			tutorialScenario.advance?.(runtime);
		}

		expect(runtime.scenarioSession.completed).toBe(true);
		expect(runtime.scenarioSession.state).toEqual({
			phase: "complete",
			pendingPrompt: "complete-intro",
		});
		expect(tutorialScenario.isState?.(runtime.scenarioSession.state)).toBe(
			true,
		);
		if (!tutorialScenario.isState?.(runtime.scenarioSession.state)) {
			throw new Error("Expected tutorial scenario state.");
		}
		expect(
			tutorialScenario.getHudContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial Complete",
			description: "You reached the end of the current tutorial flow.",
		});
		expect(
			tutorialScenario.getPromptContent?.(runtime.scenarioSession.state),
		).toEqual({
			title: "Tutorial Complete",
			description:
				"You completed the Earth-Moon round trip. Start free roam immediately or return to the main menu.",
			confirmAction: "start-free-roam",
			confirmLabel: "Free roam",
			secondaryAction: "exit-to-menu",
			secondaryLabel: "Exit",
		});
	});
});

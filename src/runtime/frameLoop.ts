import * as THREE from "three";

import type { KeyboardInput } from "../input/keyboardInput";
import type { BodyPresentation } from "../presentation/bodyPresentation";
import type { HudPresentation } from "../presentation/hudPresentation";
import type { SpacecraftPresentation } from "../presentation/spacecraftPresentation";
import type { TrajectoryPresentation } from "../presentation/trajectoryPresentation";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { GameSceneRefs } from "../scene/createGameScene";
import type { ScenarioDirectiveLimits } from "../scenario/scenarioDirectiveTypes";
import {
	advanceRuntimeScenario,
	getRuntimeActivePrompt,
} from "../scenario/scenarioRegistry";
import type { PhysicsEngine } from "../simulation/types";
import { type Ripple, updateRipples } from "../ui/overlayUpdates";
import type { AppRuntimeState } from "./appRuntimeState";
import type { GameQueries } from "./gameQueries";
import type { RuntimeActions } from "./runtimeActions";
import { syncRuntimeScenarioDirectives } from "../scenario/scenarioDirectives";
import { stepSimulationFrame } from "./simulationStep";

export const createFrameLoop = (options: {
	gameScene: GameSceneRefs;
	hudPresentation: HudPresentation;
	keyboardInput: KeyboardInput;
	physicsEngine: PhysicsEngine;
	queries: GameQueries;
	rendererProfiler: RendererProfiler;
	ripples: Ripple[];
	runtime: AppRuntimeState;
	runtimeActions: RuntimeActions;
	scenarioDirectiveLimits: ScenarioDirectiveLimits;
	crashMenu?: {
		syncState(): void;
	};
	topMenu?: {
		syncState(): void;
	};
	bodyPresentation: BodyPresentation;
	spacecraftPresentation: SpacecraftPresentation;
	timeWarps: number[];
	touchControls?: boolean;
	trajectoryPresentation: TrajectoryPresentation;
}) => {
	let lastTime = performance.now();
	let smoothedFps = 60;
	let smoothedCpuMs = 0;

	const refreshTrajectoryPrediction = () => {
		options.trajectoryPresentation.refreshPrediction();
	};

	const animate = (time: number) => {
		const frameStart = performance.now();
		const realDt = Math.min((time - lastTime) / 1000, 0.1);
		lastTime = time;
		smoothedFps = THREE.MathUtils.lerp(
			smoothedFps,
			1 / Math.max(realDt, 1 / 240),
			0.12,
		);
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
		const activePrompt = getRuntimeActivePrompt(
			options.runtime,
			options.touchControls ? "mobile" : "desktop",
		);
		const hasBlockingPrompt = activePrompt?.mode === "blocking";
		const isThrusting =
			options.runtime.state.controls.main > 0 &&
			options.runtime.state.spacecraft.fuel > 0;

		if (!hasBlockingPrompt) {
			const simulationStep = stepSimulationFrame({
				assistMode: options.runtime.assistMode,
				crashedBodyName: options.runtime.crashedBodyName,
				getAssistTarget: options.queries.getAssistTarget,
				getAutopilotTurn: options.queries.getAutopilotTurn,
				getCaptureMetrics: options.queries.getCaptureMetrics,
				getCircularizePlan: options.queries.getCircularizePlan,
				keyboardInput: options.keyboardInput,
				maxControlWarp: 100,
				physicsEngine: options.physicsEngine,
				realDt,
				shouldCaptureBurn: options.queries.shouldCaptureBurn,
				state: options.runtime.state,
				targetHeading: options.runtime.targetHeading,
				timeWarpIndex: options.runtime.timeWarpIndex,
				timeWarps: options.timeWarps,
			});
			options.runtime.assistMode = simulationStep.assistMode;
			options.runtime.crashedBodyName = simulationStep.crashedBodyName;
			options.runtime.state = simulationStep.state;
			options.runtime.targetHeading = simulationStep.targetHeading;
			options.runtime.timeWarpIndex = simulationStep.timeWarpIndex;
			advanceRuntimeScenario(options.runtime);
		}

		updateRipples(options.ripples, realDt);
		options.runtimeActions.updateCamera();
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
		options.trajectoryPresentation.maybeRefreshPrediction(realDt);

		options.bodyPresentation.updateVisuals({
			bodies: options.runtime.state.bodies,
			hiddenBodyIds: options.runtime.scenarioDirectives.hiddenBodyIds,
			spacecraftPosition: options.runtime.state.spacecraft.position,
			viewportSize: options.runtime.viewportSize,
		});
		options.spacecraftPresentation.updateVisuals({
			isThrusting,
			spacecraft: options.runtime.state.spacecraft,
			spacecraftLabelIntroUntil: options.runtime.spacecraftLabelIntroUntil,
			viewportSize: options.runtime.viewportSize,
		});
		options.trajectoryPresentation.updateVisuals();
		options.hudPresentation.update({ smoothedCpuMs, smoothedFps });
		options.crashMenu?.syncState();
		options.topMenu?.syncState();
		options.rendererProfiler.render(
			options.gameScene.scene,
			options.gameScene.camera,
			options.runtime.performanceDebugEnabled,
		);

		smoothedCpuMs = THREE.MathUtils.lerp(
			smoothedCpuMs,
			performance.now() - frameStart,
			0.15,
		);
		requestAnimationFrame(animate);
	};

	return {
		refreshTrajectoryPrediction,
		start: () => {
			syncRuntimeScenarioDirectives(
				options.runtime,
				options.scenarioDirectiveLimits,
			);
			options.runtimeActions.updateCamera();
			options.bodyPresentation.updateVisuals({
				bodies: options.runtime.state.bodies,
				hiddenBodyIds: options.runtime.scenarioDirectives.hiddenBodyIds,
				spacecraftPosition: options.runtime.state.spacecraft.position,
				viewportSize: options.runtime.viewportSize,
			});
			options.spacecraftPresentation.updateVisuals({
				isThrusting:
					options.runtime.state.controls.main > 0 &&
					options.runtime.state.spacecraft.fuel > 0,
				spacecraft: options.runtime.state.spacecraft,
				spacecraftLabelIntroUntil: options.runtime.spacecraftLabelIntroUntil,
				viewportSize: options.runtime.viewportSize,
			});
			options.hudPresentation.update({ smoothedCpuMs, smoothedFps });
			options.crashMenu?.syncState();
			options.topMenu?.syncState();
			requestAnimationFrame(animate);
		},
	};
};

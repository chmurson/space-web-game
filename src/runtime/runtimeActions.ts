import * as THREE from "three";

import { updateCameraView } from "../render/sceneUpdates";
import { add } from "../simulation/vector";
import {
	acknowledgeRuntimeScenarioPrompt,
	reopenRuntimeScenarioPrompt,
} from "../scenario/scenarioRegistry";
import type { ScenarioDirectiveLimits } from "../scenario/scenarioDirectiveTypes";
import {
	getConstrainedTimeWarpIndex,
	syncRuntimeScenarioDirectives,
} from "../scenario/tutorialOnboarding/scenarioDirectives";
import {
	createRequestedRuntimeScenario,
	createRuntimeScenarioState,
	loadDebugRuntimeScenario,
	saveRuntimeDebugSnapshot,
	type RuntimeScenarioOptions,
} from "../scenario/runtimeScenario";
import type { GameSceneRefs } from "../scene/createGameScene";
import type { AppRuntimeState } from "./appRuntimeState";
import { restoreRuntimeFromScenarioCheckpoint } from "./scenarioRecovery";
import type { Ripple } from "../ui/overlayUpdates";
import type { UIUserAction } from "../input/uiUserActions";
import { GameHighLevelActions } from "../app/types";

type RippleCreator = (
	parent: HTMLElement,
	ripples: Ripple[],
	screenX: number,
	screenY: number,
) => void;

export type RuntimeActionsResult = {
	refreshTrajectoryPrediction: boolean;
};

export const createRuntimeActions = (options: {
	app: HTMLDivElement;
	cameraDistance: number;
	cameraElevation: number;
	createRipple: RippleCreator;
	gameScene: GameSceneRefs;
	maxCoastPredictionHorizonHours: number;
	maxViewport: number;
	minCoastPredictionHorizonHours: number;
	minViewport: number;
	renderer: Pick<THREE.WebGLRenderer, "setSize">;
	requestedScenario: string;
	ripples: Ripple[];
	runtime: AppRuntimeState;
	scenarioDirectiveLimits: ScenarioDirectiveLimits;
	runtimeScenarioOptions: RuntimeScenarioOptions;
	timeWarps: number[];
	updateUserSettings: (settings: { debugModeEnabled: boolean }) => void;
	gameHighLevelActions: GameHighLevelActions;
}) => {
	let activeScenarioId = options.requestedScenario;
	const normalizeAngle = (angle: number) => {
		const wrapped = (angle + Math.PI) % (Math.PI * 2);
		return wrapped < 0 ? wrapped + Math.PI : wrapped - Math.PI;
	};

	const clearTransientScenarioState = () => {
		options.gameScene.trailPoints.length = 0;
		options.runtime.targetHeading = null;
		options.runtime.assistMode = "off";
		options.runtime.crashedBodyName = null;
		options.runtime.spacecraftLabelIntroUntil = performance.now() + 5_000;
	};

	const loadScenario = (scenarioId: string) => {
		const freshRuntimeScenarioState = createRuntimeScenarioState(
			createRequestedRuntimeScenario(scenarioId),
			options.runtimeScenarioOptions,
		);
		options.runtime.timeWarpIndex = 0;
		options.runtime.state = freshRuntimeScenarioState.state;
		options.runtime.viewportSize = freshRuntimeScenarioState.viewportSize;
		options.runtime.coastPredictionHorizonHours =
			freshRuntimeScenarioState.coastPredictionHorizonHours;
		options.runtime.scenarioSession = freshRuntimeScenarioState.scenarioSession;
		options.runtime.uiEffectEpoch += 1;
		clearTransientScenarioState();
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
	};

	const setTimeWarp = (warp: number) => {
		const desiredIndex = options.timeWarps.indexOf(warp);
		options.runtime.timeWarpIndex = desiredIndex >= 0 ? desiredIndex : 0;
	};

	const resetScenario = () => {
		loadScenario(activeScenarioId);
	};

	const saveDebugScenarioSnapshot = () => {
		options.runtime.debugSnapshotStatus = saveRuntimeDebugSnapshot(
			options.runtime.state,
			{
				coastPredictionHorizonHours:
					options.runtime.coastPredictionHorizonHours,
				scenarioSession: options.runtime.scenarioSession,
				viewportSize: options.runtime.viewportSize,
			},
		)
			? "snapshot saved; use [7] load or ?scenario=debug-snapshot"
			: "snapshot save failed";
	};

	const loadDebugScenarioSnapshot = () => {
		const loadedDebugScenario = loadDebugRuntimeScenario(
			options.runtimeScenarioOptions,
		);
		if (!loadedDebugScenario) {
			options.runtime.debugSnapshotStatus = "no debug snapshot saved";
			return;
		}

		options.runtime.state = loadedDebugScenario.runtimeState.state;
		options.runtime.viewportSize =
			loadedDebugScenario.runtimeState.viewportSize;
		options.runtime.coastPredictionHorizonHours =
			loadedDebugScenario.runtimeState.coastPredictionHorizonHours;
		options.runtime.scenarioSession =
			loadedDebugScenario.runtimeState.scenarioSession;
		options.runtime.uiEffectEpoch += 1;
		clearTransientScenarioState();
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
		options.runtime.assistTargetIndex = Math.min(
			options.runtime.assistTargetIndex,
			Math.max(0, options.runtime.state.bodies.length - 1),
		);
		options.runtime.debugSnapshotStatus = `loaded snapshot from ${new Date(loadedDebugScenario.snapshot.savedAt).toLocaleString()}`;
	};

	const updateCamera = () =>
		updateCameraView({
			cameraDistance: options.cameraDistance,
			cameraElevation: options.cameraElevation,
			cameraTargetPosition:
				options.runtime.scenarioDirectives.cameraFollowBodyId === null
					? add(
							options.runtime.state.spacecraft.position,
							options.runtime.scenarioDirectives.cameraFollowOffset,
						)
					: add(
							options.runtime.state.bodies.find(
								(body) =>
									body.id ===
									options.runtime.scenarioDirectives.cameraFollowBodyId,
							)?.position ?? options.runtime.state.spacecraft.position,
							options.runtime.scenarioDirectives.cameraFollowOffset,
						),
			gameScene: options.gameScene,
			viewportHeight: window.innerHeight,
			viewportSize: options.runtime.viewportSize,
			viewportWidth: window.innerWidth,
		});

	const zoomCamera = (factor: number) => {
		options.runtime.viewportSize = THREE.MathUtils.clamp(
			options.runtime.viewportSize * factor,
			options.runtime.scenarioDirectives.minViewportSize ?? options.minViewport,
			options.runtime.scenarioDirectives.maxViewportSize ?? options.maxViewport,
		);
		updateCamera();
	};

	const recoverScenarioAfterCrash = () => {
		const recoveredFromCheckpoint = restoreRuntimeFromScenarioCheckpoint(
			options.runtime,
		);
		if (!recoveredFromCheckpoint) {
			resetScenario();
			return;
		}

		clearTransientScenarioState();
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
	};
	const restartFromCheckpoint = () => {
		const recoveredFromCheckpoint = restoreRuntimeFromScenarioCheckpoint(
			options.runtime,
		);
		if (!recoveredFromCheckpoint) {
			return false;
		}

		clearTransientScenarioState();
		syncRuntimeScenarioDirectives(
			options.runtime,
			options.scenarioDirectiveLimits,
		);
		return true;
	};

	const acknowledgeScenarioPrompt = () =>
		acknowledgeRuntimeScenarioPrompt(options.runtime);
	const reopenScenarioPrompt = () =>
		reopenRuntimeScenarioPrompt(options.runtime);
	const startFreeRoam = () => {
		activeScenarioId = "earth-moon";
		loadScenario(activeScenarioId);
	};
	const startTutorial = () => {
		activeScenarioId = "tutorial";
		loadScenario(activeScenarioId);
	};
	const enterMainMenuBackground = () => {
		activeScenarioId = "menu-background";
		loadScenario(activeScenarioId);
		options.runtime.spacecraftLabelIntroUntil = Number.POSITIVE_INFINITY;
		setTimeWarp(500);
	};

	return {
		acknowledgeScenarioPrompt,
		enterMainMenuBackground,
		handleUIUserAction: (action: UIUserAction): RuntimeActionsResult => {
			if (action === "increaseTimeWarp") {
				options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
					options.runtime.timeWarpIndex + 1,
					options.timeWarps,
					options.runtime.scenarioDirectives.maxTimeWarp,
				);
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "decreaseTimeWarp") {
				options.runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
					Math.max(options.runtime.timeWarpIndex - 1, 0),
					options.timeWarps,
					options.runtime.scenarioDirectives.maxTimeWarp,
				);
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "resetScenario") {
				resetScenario();
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "cycleAssistTarget") {
				options.runtime.assistTargetIndex =
					(options.runtime.assistTargetIndex + 1) %
					options.runtime.state.bodies.length;
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "cycleAssistMode") {
				options.runtime.assistMode =
					options.runtime.assistMode === "off"
						? "capture"
						: options.runtime.assistMode === "capture"
							? "circularize"
							: "off";
				options.runtime.targetHeading = null;
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "toggleDebugMode") {
				options.runtime.debugModeEnabled = !options.runtime.debugModeEnabled;
				options.updateUserSettings({
					debugModeEnabled: options.runtime.debugModeEnabled,
				});
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "toggleNoGravityDebug") {
				options.runtime.debugNoGravityEnabled =
					!options.runtime.debugNoGravityEnabled;
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "toggleFpsIndicator") {
				options.runtime.fpsIndicatorEnabled =
					!options.runtime.fpsIndicatorEnabled;
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "togglePerformanceDebug") {
				options.runtime.performanceDebugEnabled =
					!options.runtime.performanceDebugEnabled;
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "decreaseCoastHorizon") {
				options.runtime.coastPredictionHorizonHours = Math.max(
					options.minCoastPredictionHorizonHours,
					options.runtime.coastPredictionHorizonHours / 2,
				);
				return { refreshTrajectoryPrediction: true };
			}
			if (action === "increaseCoastHorizon") {
				options.runtime.coastPredictionHorizonHours = Math.min(
					options.runtime.scenarioDirectives.maxCoastPredictionHorizonHours ??
						options.maxCoastPredictionHorizonHours,
					options.runtime.coastPredictionHorizonHours * 2,
				);
				return { refreshTrajectoryPrediction: true };
			}
			if (action === "saveDebugSnapshot") {
				saveDebugScenarioSnapshot();
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "loadDebugSnapshot") {
				loadDebugScenarioSnapshot();
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "zoomIn") {
				zoomCamera(0.82);
				return { refreshTrajectoryPrediction: false };
			}
			if (action === "zoomOut") {
				zoomCamera(1.22);
			}
      if (action === "promptConfirm") {
        acknowledgeScenarioPrompt();
      }

			//here let's call handlePromptConfirm or something

			return { refreshTrajectoryPrediction: false };
		},
		loadDebugSnapshot: () => {
			const previousStatus = options.runtime.debugSnapshotStatus;
			loadDebugScenarioSnapshot();
			return (
				options.runtime.debugSnapshotStatus !== "no debug snapshot saved" ||
				previousStatus !== options.runtime.debugSnapshotStatus
			);
		},
		handleResize: () => {
			options.renderer.setSize(window.innerWidth, window.innerHeight);
			updateCamera();
		},
		resetScenario,
		restartFromCheckpoint,
		setTargetHeading: (heading: number, clientX: number, clientY: number) => {
			options.runtime.targetHeading = heading;
			options.runtime.targetHeadingSelectionEpoch += 1;
			options.runtime.assistMode = "off";
			options.createRipple(options.app, options.ripples, clientX, clientY);
		},
		nudgeTargetHeading: (deltaRadians: number) => {
			const baseHeading =
				options.runtime.targetHeading ??
				options.runtime.state.spacecraft.heading;
			options.runtime.targetHeading = normalizeAngle(
				baseHeading + deltaRadians,
			);
			options.runtime.assistMode = "off";
		},
		recoverScenarioAfterCrash,
		reopenScenarioPrompt,
		startFreeRoam,
		startTutorial,
		updateCamera,
		zoomCamera,
	};
};

export type RuntimeActions = ReturnType<typeof createRuntimeActions>;

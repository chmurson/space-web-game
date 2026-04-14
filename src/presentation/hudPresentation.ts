import { getBodyInfluences } from "../simulation/bodyInfluence";
import { formatCompactElapsed, formatSpeed } from "../ui/formatters";
import type { OverlayUiRefs } from "../ui/overlayUI/createOverlayUi";
import type { TouchControls } from "../ui/createTouchControls";
import { getDebugPanelLines, getGuidanceText } from "../ui/hudText";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { GameQueries } from "../runtime/gameQueries";
import { getRuntimeScenarioDefinition } from "../scenario/scenarioRegistry";
import type { TrajectoryPresentation } from "./trajectoryPresentation";
import type { RuntimeScenarioSession } from "../scenario/scenarioSession";
import {
	createScenarioPromptUpdater,
	type ScenarioPromptUiRefs,
} from "../ui/scenario-prompts/scenario-prompts";

export const createHudPresentation = (options: {
	defaultScenarioDescription: string;
	defaultScenarioName: string;
	defaultViewport: number;
	overlayUi: OverlayUiRefs;
	physicsEngineName: string;
	queries: GameQueries;
	rendererProfiler: RendererProfiler;
	runtime: AppRuntimeState;
	timeWarps: number[];
	touchControls?: TouchControls;
	trajectoryPresentation: TrajectoryPresentation;
}) => {
	let lastTimeWarpIndex: number | null = null;
	let lastTimeIconUpdateAt: number | null = null;
	let timeIconAngle = 0;
	let lastUiEffectEpoch = options.runtime.uiEffectEpoch;
	let lastWarpIncreaseAt = 0;
	let warpIncreaseStreak = 0;
	let warpFeedbackTimeoutId: number | null = null;
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const inputMode = options.touchControls ? "mobile" : "desktop";

	// Create scenario prompt updater using existing UI elements from overlayUi
	const scenarioPromptRefs: ScenarioPromptUiRefs = {
		backdropElement: options.overlayUi.scenarioPrompt,
		promptElement:
			options.overlayUi.scenarioPrompt.querySelector<HTMLElement>(
				".scenario-prompt",
			)!,
		arrowElement: options.overlayUi.scenarioPrompt.querySelector<HTMLElement>(
			".scenario-prompt-arrow",
		)!,
		titleElement: options.overlayUi.scenarioPromptTitle,
		descriptionElement: options.overlayUi.scenarioPromptDescription,
		confirmButton: options.overlayUi.scenarioPromptConfirmButton,
		secondaryButton: options.overlayUi.scenarioPromptSecondaryButton,
		replayButton: options.overlayUi.scenarioPromptReplayButton,
		replayButtonLabel: options.overlayUi.scenarioPromptReplayButtonLabel,
	};
	const scenarioPromptUpdater = createScenarioPromptUpdater(scenarioPromptRefs);

	const triggerWarpFeedback = (variant: "v2" | "v4", strength = 1.18) => {
		const timePill =
			options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
		if (!timePill) {
			return;
		}

		timePill.dataset.warpFeedbackVariant = variant;
		timePill.style.setProperty("--warp-feedback-scale", strength.toFixed(2));
		timePill.classList.remove("telemetry-pill-warp-bump");
		void timePill.getBoundingClientRect();
		timePill.classList.add("telemetry-pill-warp-bump");
		if (warpFeedbackTimeoutId !== null) {
			window.clearTimeout(warpFeedbackTimeoutId);
		}
		warpFeedbackTimeoutId = window.setTimeout(() => {
			timePill.classList.remove("telemetry-pill-warp-bump");
			warpFeedbackTimeoutId = null;
		}, 1000);
	};

	const resetTransientPillEffects = () => {
		const timePill =
			options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
		timePill?.classList.remove("telemetry-pill-warp-bump");
		if (warpFeedbackTimeoutId !== null) {
			window.clearTimeout(warpFeedbackTimeoutId);
			warpFeedbackTimeoutId = null;
		}
		lastTimeWarpIndex = options.runtime.timeWarpIndex;
		lastTimeIconUpdateAt = performance.now();
		lastWarpIncreaseAt = 0;
		warpIncreaseStreak = 0;
	};

	return {
		update: (metrics: { smoothedCpuMs: number; smoothedFps: number }) => {
			const earth = options.runtime.state.bodies.find(
				(body) => body.id === "earth",
			);
			if (!earth) {
				return;
			}

			if (options.runtime.uiEffectEpoch !== lastUiEffectEpoch) {
				resetTransientPillEffects();
				lastUiEffectEpoch = options.runtime.uiEffectEpoch;
			}

			if (lastTimeWarpIndex !== null) {
				if (options.runtime.timeWarpIndex > lastTimeWarpIndex) {
					const now = performance.now();
					warpIncreaseStreak =
						now - lastWarpIncreaseAt <= 700 ? warpIncreaseStreak + 1 : 1;
					lastWarpIncreaseAt = now;
					const strength = Math.min(
						1.36,
						1.16 + (warpIncreaseStreak - 1) * 0.06,
					);
					triggerWarpFeedback("v2", strength);
				}
				if (options.runtime.timeWarpIndex < lastTimeWarpIndex) {
					warpIncreaseStreak = 0;
					triggerWarpFeedback("v4");
				}
			}
			lastTimeWarpIndex = options.runtime.timeWarpIndex;

			const target = options.queries.getAssistTarget();
			const targetMetrics = options.queries.getCaptureMetrics(target);
			const circularizePlan =
				options.runtime.assistMode === "circularize"
					? options.queries.getCircularizePlan(target)
					: null;
			const predictionState =
				options.trajectoryPresentation.getPredictionState();
			const scenarioDefinition = getRuntimeScenarioDefinition(
				options.runtime.scenarioSession.scenarioId,
			);
			const scenarioHudContent =
				scenarioDefinition?.getHudContent &&
				(!scenarioDefinition.isState ||
					scenarioDefinition.isState(options.runtime.scenarioSession.state))
					? scenarioDefinition.getHudContent(
							options.runtime.scenarioSession.state,
						)
					: null;

			const hiddenUIElements =
				options.runtime.scenarioDirectives.hiddenUIElements;
			const showScenarioInfoButton =
				!hiddenUIElements.has("scenarioInfoButton");
			const showTimePill = !hiddenUIElements.has("timeWarpPill");
			const showSpeedPill = !hiddenUIElements.has("speedPill");
			const showThrustPill = !hiddenUIElements.has("thrustPill");

			if (options.overlayUi.hudTitle) {
				options.overlayUi.hudTitle.textContent =
					scenarioHudContent?.title ?? options.defaultScenarioName;
			}
			if (options.overlayUi.hudDescription) {
				options.overlayUi.hudDescription.textContent =
					scenarioHudContent?.description ?? options.defaultScenarioDescription;
			}

			// Update scenario prompt UI
			scenarioPromptUpdater.update(
				options.runtime,
				inputMode,
				showScenarioInfoButton,
			);
			const timePill =
				options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
			const speedPill =
				options.overlayUi.statSpeed?.closest<HTMLElement>(".telemetry-pill");
			const thrustPill =
				options.overlayUi.statThrust?.closest<HTMLElement>(".telemetry-pill");

			if (timePill) {
				timePill.style.display = showTimePill ? "inline-flex" : "none";
			}

			if (options.overlayUi.statEngine) {
				options.overlayUi.statEngine.textContent = options.physicsEngineName;
			}
			if (options.overlayUi.statTime) {
				options.overlayUi.statTime.textContent = `${formatCompactElapsed(options.runtime.state.elapsed)} · ${
					options.timeWarps[options.runtime.timeWarpIndex] ?? 1
				}x`;
			}
			if (options.overlayUi.timeIcon) {
				const maxWarpIndex = Math.max(0, options.timeWarps.length - 1);
				const stepsFromMax = Math.max(
					0,
					maxWarpIndex - options.runtime.timeWarpIndex,
				);
				const iconDurationSeconds = 0.25 * 2 ** stepsFromMax;
				const now = performance.now();
				if (lastTimeIconUpdateAt === null) {
					lastTimeIconUpdateAt = now;
				}
				const elapsedSeconds = (now - lastTimeIconUpdateAt) / 1000;
				lastTimeIconUpdateAt = now;
				if (!reducedMotion && options.overlayUi.timeIconHand) {
					timeIconAngle =
						(timeIconAngle + (elapsedSeconds / iconDurationSeconds) * 360) %
						360;
					options.overlayUi.timeIconHand.style.transform = `rotate(${timeIconAngle.toFixed(2)}deg)`;
				}
			}
			if (options.overlayUi.statWarp) {
				options.overlayUi.statWarp.textContent = "";
			}
			if (options.overlayUi.statSpeed) {
				options.overlayUi.statSpeed.textContent = formatSpeed(
					targetMetrics.relativeSpeed,
				);
			}
			{
				const crashed = options.runtime.crashedBodyName !== null;
				const thrusting =
					!crashed &&
					options.runtime.state.controls.main > 0 &&
					options.runtime.state.spacecraft.fuel > 0;
				if (options.overlayUi.statThrust) {
					options.overlayUi.statThrust.textContent = crashed ? "Crashed" : "";
				}
				if (speedPill) {
					speedPill.style.display =
						!crashed && showSpeedPill ? "inline-flex" : "none";
				}
				if (thrustPill) {
					thrustPill.style.display =
						crashed && showThrustPill ? "inline-flex" : "none";
				}
				thrustPill?.classList.remove("telemetry-pill-thrust-active");
				thrustPill?.classList.toggle("telemetry-pill-thrust-crashed", crashed);
				speedPill?.classList.toggle("telemetry-pill-thrusting", thrusting);
				if (options.overlayUi.speedIcon) {
					options.overlayUi.speedIcon.classList.toggle(
						"telemetry-speed-icon-thrusting",
						thrusting,
					);
				}
			}
			if (options.overlayUi.statFuel) {
				options.overlayUi.statFuel.textContent = `${options.runtime.state.spacecraft.fuelUsed.toFixed(1)} kg`;
			}
			if (options.overlayUi.statZoom) {
				options.overlayUi.statZoom.textContent = `${(options.defaultViewport / options.runtime.viewportSize).toFixed(1)}x`;
			}
			if (options.overlayUi.statTarget) {
				options.overlayUi.statTarget.textContent = target.name;
			}
			if (options.overlayUi.statAssist) {
				options.overlayUi.statAssist.textContent = options.runtime
					.crashedBodyName
					? "Crashed"
					: options.runtime.assistMode === "capture"
						? "Capture"
						: options.runtime.assistMode === "circularize"
							? "Circularize"
							: "Off";
			}
			options.touchControls?.updateAssistMode(options.runtime.assistMode);
			if (options.overlayUi.statGuidance) {
				options.overlayUi.statGuidance.textContent = getGuidanceText({
					assistMode: options.runtime.assistMode,
					circularizePlan,
					crashedBodyName: options.runtime.crashedBodyName,
					predictedImpact: predictionState.predictedImpact,
					predictedTargetClosestApproach:
						predictionState.predictedTargetClosestApproach,
					targetMetrics,
				});
			}

			options.overlayUi.debugPanel.element.style.display = options.runtime
				.debugModeEnabled
				? "block"
				: "none";
			if (options.runtime.debugModeEnabled) {
				options.overlayUi.debugPanel.setText(
					getDebugPanelLines({
						assistMode: options.runtime.assistMode,
						bodyInfluences: getBodyInfluences(options.runtime.state),
						coastPredictionHorizonSeconds:
							options.queries.getCoastPredictionHorizonSeconds(),
						debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
						debugSnapshotStatus: options.runtime.debugSnapshotStatus,
						fpsIndicatorEnabled: options.runtime.fpsIndicatorEnabled,
						performanceDebugEnabled: options.runtime.performanceDebugEnabled,
						predictionStepSeconds:
							options.queries.getPredictionConfig().stepSeconds,
						predictedImpact: predictionState.predictedImpact,
						predictedTargetClosestApproach:
							predictionState.predictedTargetClosestApproach,
						smoothedCpuMs: metrics.smoothedCpuMs,
						smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
						targetMetrics,
						targetName: target.name,
					}).join("\n"),
				);
				const { scenarioId, state } = options.runtime
					.scenarioSession as RuntimeScenarioSession;
				options.overlayUi.debugPanel.setJson({
					assistTarget: target.id,
					captureMetrics: {
						bound: targetMetrics.specificEnergy < 0,
						circularSpeed: targetMetrics.circularSpeed,
						distance: targetMetrics.distance,
						relativeSpeed: targetMetrics.relativeSpeed,
						specificEnergy: targetMetrics.specificEnergy,
						surfaceDistance: targetMetrics.surfaceDistance,
					},
					scenarioId,
					state,
				});
			}

			const fpsIndicatorVisible =
				options.runtime.debugModeEnabled && options.runtime.fpsIndicatorEnabled;
			options.overlayUi.fpsIndicator.style.display = fpsIndicatorVisible
				? "block"
				: "none";
			options.overlayUi.fpsIndicator.textContent = `FPS ${metrics.smoothedFps.toFixed(1)}`;
		},
	};
};

export type HudPresentation = ReturnType<typeof createHudPresentation>;

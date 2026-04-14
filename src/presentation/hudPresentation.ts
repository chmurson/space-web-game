import { getBodyInfluences } from "../simulation/bodyInfluence";
import { formatCompactElapsed, formatSpeed } from "../ui/formatters";
import type { OverlayUiRefs } from "../ui/overlayUI/createOverlayUi";
import type { TouchControls } from "../ui/createTouchControls";
import { getDebugPanelLines, getGuidanceText } from "../ui/hudText";
import type { RendererProfiler } from "../render/rendererProfiler";
import type { AppRuntimeState } from "../runtime/appRuntimeState";
import type { GameQueries } from "../runtime/gameQueries";
import { getRuntimeScenarioDefinition, getRuntimeActivePrompt, getRuntimeScenarioReplayPromptContent } from "../scenario/scenarioRegistry";
import type { TrajectoryPresentation } from "./trajectoryPresentation";
import { RuntimeScenarioSession } from "../scenario/scenarioSession";

type AnchorKey = "thrust-pill" | "time-warp-pill" | "trajectory";

const getAnchorElement = (anchor: AnchorKey): HTMLElement | null => {
  if (anchor === "thrust-pill") {
    // Find the thrust pill element
    const statThrust = document.querySelector<HTMLElement>('[data-stat="thrust"]');
    return statThrust?.closest<HTMLElement>(".telemetry-pill") ?? null;
  }
  if (anchor === "time-warp-pill") {
    const statTime = document.querySelector<HTMLElement>('[data-stat="time"]');
    return statTime?.closest<HTMLElement>(".telemetry-pill") ?? null;
  }
  return null;
};

const positionPromptNearAnchor = (
  promptElement: HTMLElement,
  anchorElement: HTMLElement,
): void => {
  const anchorRect = anchorElement.getBoundingClientRect();
  const promptRect = promptElement.getBoundingClientRect();

  const padding = 12;
  const arrowSize = 8;

  // Preferred position: below and to the right of anchor
  let top = anchorRect.bottom + padding + arrowSize;
  let left = anchorRect.right + padding;

  // If it goes off-screen to the right, move to the left of anchor
  if (left + promptRect.width > window.innerWidth - padding) {
    left = anchorRect.left - promptRect.width - padding;
  }

  // If it goes off-screen to the bottom, move above anchor
  if (top + promptRect.height > window.innerHeight - padding) {
    top = anchorRect.top - promptRect.height - padding - arrowSize;
  }

  // Clamp to viewport bounds
  left = Math.max(padding, Math.min(left, window.innerWidth - promptRect.width - padding));
  top = Math.max(padding, Math.min(top, window.innerHeight - promptRect.height - padding));

  // Store the arrow position relative to the prompt for CSS to use
  const arrowLeft = anchorRect.left + anchorRect.width / 2 - left;
  const arrowTop = anchorRect.top + anchorRect.height / 2 - top;

  promptElement.style.position = "fixed";
  promptElement.style.left = `${left}px`;
  promptElement.style.top = `${top}px`;
  promptElement.style.setProperty("--arrow-x", `${arrowLeft}px`);
  promptElement.style.setProperty("--arrow-y", `${arrowTop}px`);
};

const resetPromptPosition = (promptElement: HTMLElement): void => {
  promptElement.style.position = "";
  promptElement.style.left = "";
  promptElement.style.top = "";
  promptElement.style.removeProperty("--arrow-x");
  promptElement.style.removeProperty("--arrow-y");
};

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
  let anchorResizeObserver: ResizeObserver | null = null;
  let windowResizeTimeoutId: number | null = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inputMode = options.touchControls ? "mobile" : "desktop";

  const setupAnchorObserver = (anchorElement: HTMLElement): void => {
    if (anchorResizeObserver) {
      anchorResizeObserver.disconnect();
    }

    anchorResizeObserver = new ResizeObserver(() => {
      const anchorKey = options.overlayUi.scenarioPrompt.dataset.anchor as AnchorKey | undefined;
      if (anchorKey) {
        const anchor = getAnchorElement(anchorKey);
        if (anchor) {
          positionPromptNearAnchor(options.overlayUi.scenarioPrompt, anchor);
        }
      }
    });

    anchorResizeObserver.observe(anchorElement);
  };

  const updateAnchorPosition = (): void => {
    const anchorKey = options.overlayUi.scenarioPrompt.dataset.anchor as AnchorKey | undefined;
    if (!anchorKey) {
      resetPromptPosition(options.overlayUi.scenarioPrompt);
      if (anchorResizeObserver) {
        anchorResizeObserver.disconnect();
        anchorResizeObserver = null;
      }
      return;
    }

    const anchorElement = getAnchorElement(anchorKey);
    if (anchorElement) {
      positionPromptNearAnchor(options.overlayUi.scenarioPrompt, anchorElement);
      setupAnchorObserver(anchorElement);
    }
  };

  const triggerWarpFeedback = (variant: "v2" | "v4", strength = 1.18) => {
    const timePill = options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
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
    const timePill = options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
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

  // Setup window resize listener for prompt repositioning
  const handleWindowResize = () => {
    if (windowResizeTimeoutId !== null) {
      window.clearTimeout(windowResizeTimeoutId);
    }
    windowResizeTimeoutId = window.setTimeout(() => {
      updateAnchorPosition();
      windowResizeTimeoutId = null;
    }, 100);
  };

  window.addEventListener("resize", handleWindowResize);

  return {
    update: (metrics: { smoothedCpuMs: number; smoothedFps: number }) => {
      const earth = options.runtime.state.bodies.find((body) => body.id === "earth");
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
          warpIncreaseStreak = now - lastWarpIncreaseAt <= 700 ? warpIncreaseStreak + 1 : 1;
          lastWarpIncreaseAt = now;
          const strength = Math.min(1.36, 1.16 + (warpIncreaseStreak - 1) * 0.06);
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
      const circularizePlan = options.runtime.assistMode === "circularize" ? options.queries.getCircularizePlan(target) : null;
      const predictionState = options.trajectoryPresentation.getPredictionState();
      const scenarioDefinition = getRuntimeScenarioDefinition(options.runtime.scenarioSession.scenarioId);
      const scenarioHudContent =
        scenarioDefinition?.getHudContent && (!scenarioDefinition.isState || scenarioDefinition.isState(options.runtime.scenarioSession.state))
          ? scenarioDefinition.getHudContent(options.runtime.scenarioSession.state)
          : null;

      const activePrompt = getRuntimeActivePrompt(options.runtime, inputMode);
      const replayPromptContent = getRuntimeScenarioReplayPromptContent(options.runtime);
      const hiddenUIElements = options.runtime.scenarioDirectives.hiddenUIElements;
      const showScenarioInfoButton = !hiddenUIElements.has("scenarioInfoButton");
      const showTimePill = !hiddenUIElements.has("timeWarpPill");
      const showSpeedPill = !hiddenUIElements.has("speedPill");
      const showThrustPill = !hiddenUIElements.has("thrustPill");

      if (options.overlayUi.hudTitle) {
        options.overlayUi.hudTitle.textContent = scenarioHudContent?.title ?? options.defaultScenarioName;
      }
      if (options.overlayUi.hudDescription) {
        options.overlayUi.hudDescription.textContent = scenarioHudContent?.description ?? options.defaultScenarioDescription;
      }
      options.overlayUi.scenarioPrompt.style.display = activePrompt ? "grid" : "none";
      options.overlayUi.scenarioPrompt.dataset.promptMode = activePrompt?.mode === "coach" ? "coach" : "modal";
      if (activePrompt?.anchor) {
        options.overlayUi.scenarioPrompt.dataset.anchor = activePrompt.anchor;
      } else {
        delete options.overlayUi.scenarioPrompt.dataset.anchor;
      }

      // Update anchor positioning for coach prompts
      if (activePrompt?.mode === "coach") {
        updateAnchorPosition();
      }
      if (options.overlayUi.scenarioPromptTitle) {
        options.overlayUi.scenarioPromptTitle.textContent = activePrompt?.title ?? "";
      }
      if (options.overlayUi.scenarioPromptDescription) {
        options.overlayUi.scenarioPromptDescription.textContent = activePrompt?.description ?? "";
      }
      if (options.overlayUi.scenarioPromptConfirmButton) {
        options.overlayUi.scenarioPromptConfirmButton.style.display = activePrompt?.confirmButton ? "inline-flex" : "none";
        options.overlayUi.scenarioPromptConfirmButton.textContent = activePrompt?.confirmButton?.label ?? "";
        options.overlayUi.scenarioPromptConfirmButton.dataset.promptAction = activePrompt?.confirmButton?.action ?? "";
      }
      if (options.overlayUi.scenarioPromptSecondaryButton) {
        options.overlayUi.scenarioPromptSecondaryButton.style.display = activePrompt?.secondaryButton ? "inline-flex" : "none";
        options.overlayUi.scenarioPromptSecondaryButton.textContent = activePrompt?.secondaryButton?.label ?? "";
        options.overlayUi.scenarioPromptSecondaryButton.dataset.promptAction = activePrompt?.secondaryButton?.action ?? "";
      }
      options.overlayUi.scenarioPromptReplayButton.style.display =
        showScenarioInfoButton && !activePrompt && replayPromptContent ? "inline-flex" : "none";
      if (options.overlayUi.scenarioPromptReplayButtonLabel) {
        options.overlayUi.scenarioPromptReplayButtonLabel.textContent = replayPromptContent?.title ?? "";
      }
      const timePill = options.overlayUi.statTime?.closest<HTMLElement>(".telemetry-pill");
      const speedPill = options.overlayUi.statSpeed?.closest<HTMLElement>(".telemetry-pill");
      const thrustPill = options.overlayUi.statThrust?.closest<HTMLElement>(".telemetry-pill");

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
        const stepsFromMax = Math.max(0, maxWarpIndex - options.runtime.timeWarpIndex);
        const iconDurationSeconds = 0.25 * 2 ** stepsFromMax;
        const now = performance.now();
        if (lastTimeIconUpdateAt === null) {
          lastTimeIconUpdateAt = now;
        }
        const elapsedSeconds = (now - lastTimeIconUpdateAt) / 1000;
        lastTimeIconUpdateAt = now;
        if (!reducedMotion && options.overlayUi.timeIconHand) {
          timeIconAngle = (timeIconAngle + (elapsedSeconds / iconDurationSeconds) * 360) % 360;
          options.overlayUi.timeIconHand.style.transform = `rotate(${timeIconAngle.toFixed(2)}deg)`;
        }
      }
      if (options.overlayUi.statWarp) {
        options.overlayUi.statWarp.textContent = "";
      }
      if (options.overlayUi.statSpeed) {
        options.overlayUi.statSpeed.textContent = formatSpeed(targetMetrics.relativeSpeed);
      }
      {
        const crashed = options.runtime.crashedBodyName !== null;
        const thrusting = !crashed && options.runtime.state.controls.main > 0 && options.runtime.state.spacecraft.fuel > 0;
        if (options.overlayUi.statThrust) {
          options.overlayUi.statThrust.textContent = crashed ? "Crashed" : "";
        }
        if (speedPill) {
          speedPill.style.display = !crashed && showSpeedPill ? "inline-flex" : "none";
        }
        if (thrustPill) {
          thrustPill.style.display = crashed && showThrustPill ? "inline-flex" : "none";
        }
        thrustPill?.classList.remove("telemetry-pill-thrust-active");
        thrustPill?.classList.toggle("telemetry-pill-thrust-crashed", crashed);
        speedPill?.classList.toggle("telemetry-pill-thrusting", thrusting);
        if (options.overlayUi.speedIcon) {
          options.overlayUi.speedIcon.classList.toggle("telemetry-speed-icon-thrusting", thrusting);
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
        options.overlayUi.statAssist.textContent =
          options.runtime.crashedBodyName
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
          predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
          targetMetrics,
        });
      }

      options.overlayUi.debugPanel.element.style.display = options.runtime.debugModeEnabled ? "block" : "none";
      if (options.runtime.debugModeEnabled) {
        options.overlayUi.debugPanel.setText(
          getDebugPanelLines({
            assistMode: options.runtime.assistMode,
            bodyInfluences: getBodyInfluences(options.runtime.state),
            coastPredictionHorizonSeconds: options.queries.getCoastPredictionHorizonSeconds(),
            debugNoGravityEnabled: options.runtime.debugNoGravityEnabled,
            debugSnapshotStatus: options.runtime.debugSnapshotStatus,
            fpsIndicatorEnabled: options.runtime.fpsIndicatorEnabled,
            performanceDebugEnabled: options.runtime.performanceDebugEnabled,
            predictionStepSeconds: options.queries.getPredictionConfig().stepSeconds,
            predictedImpact: predictionState.predictedImpact,
            predictedTargetClosestApproach: predictionState.predictedTargetClosestApproach,
            smoothedCpuMs: metrics.smoothedCpuMs,
            smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
            targetMetrics,
            targetName: target.name,
          }).join("\n"),
        );
        const { scenarioId, state } = options.runtime.scenarioSession as RuntimeScenarioSession;
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

      const fpsIndicatorVisible = options.runtime.debugModeEnabled && options.runtime.fpsIndicatorEnabled;
      options.overlayUi.fpsIndicator.style.display = fpsIndicatorVisible ? "block" : "none";
      options.overlayUi.fpsIndicator.textContent = `FPS ${metrics.smoothedFps.toFixed(1)}`;
    },
  };
};

export type HudPresentation = ReturnType<typeof createHudPresentation>;

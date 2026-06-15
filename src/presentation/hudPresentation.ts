import type { RendererProfiler } from '../render/rendererProfiler'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type {
  AssistTargetSelectionSource,
  AssistTargetUiState,
  GameQueries,
} from '../runtime/gameQueries'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import { getBodyInfluences } from '../simulation/bodyInfluence'
import type { Body } from '../simulation/types'
import {
  formatCompactElapsed,
  formatSpeed,
  formatTimeWarpLabel,
} from '../ui/formatters'
import {
  getDebugPanelLines,
  getFpsMeterStatus,
  getFpsMeterText,
  getGuidanceText,
} from '../ui/hudText'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'
import {
  createScenarioPromptUpdater,
  type ScenarioPromptUiRefs,
} from '../ui/scenario-prompts/scenario-prompts'
import type { TouchControls } from '../ui/touchControls/createTouchControls'
import type { TrajectoryPresentation } from './trajectoryPresentation'

const targetStatusLabels: Record<AssistTargetSelectionSource, string> = {
  auto: 'tracking target',
  forced: 'locked target',
  manual: 'pinned target',
}

const syncTargetSphere = (element: HTMLElement, body: Pick<Body, 'color'>) => {
  element.className = 'target-body-sphere'
  element.style.setProperty('--target-body-color', body.color)
}

export const createHudPresentation = (options: {
  defaultViewport: number
  overlayUi: OverlayUiRefs
  physicsEngineName: string
  queries: GameQueries
  rendererProfiler: RendererProfiler
  runtime: AppRuntimeState
  timeWarps: number[]
  touchControls?: TouchControls
  trajectoryPresentation: TrajectoryPresentation
}) => {
  let lastTimeWarpIndex: number | null = null
  let lastTimeIconUpdateAt: number | null = null
  let timeIconAngle = 0
  let lastUiEffectEpoch = options.runtime.ui.uiEffectEpoch
  let lastWarpIncreaseAt = 0
  let warpIncreaseStreak = 0
  let warpFeedbackTimeoutId: number | null = null
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const inputMode = options.touchControls ? 'mobile' : 'desktop'

  const syncTargetPill = (targetUiState: AssistTargetUiState) => {
    const target = targetUiState.activeTarget
    const targetLabel = `${target.name}, ${targetStatusLabels[targetUiState.mode]}`

    if (options.overlayUi.targetPill) {
      options.overlayUi.targetPill.setAttribute('aria-label', targetLabel)
      options.overlayUi.targetPill.title = targetLabel
    }
    if (
      options.overlayUi.statTarget &&
      options.overlayUi.statTarget.textContent !== target.name
    ) {
      options.overlayUi.statTarget.textContent = target.name
    }
    if (options.overlayUi.targetSphere) {
      syncTargetSphere(options.overlayUi.targetSphere, target)
    }
    if (options.overlayUi.targetStatus) {
      options.overlayUi.targetStatus.hidden = false
      options.overlayUi.targetStatus.style.visibility =
        targetUiState.mode === 'forced' ? 'hidden' : ''
      options.overlayUi.targetStatus.className = `target-status-mark target-status-mark-${targetUiState.mode}`
    }
  }

  // Create scenario prompt updater using existing UI elements from overlayUi
  const scenarioPromptRefs: ScenarioPromptUiRefs = {
    backdropElement: options.overlayUi.scenarioPrompt,
    promptElement:
      // biome-ignore lint/style/noNonNullAssertion: Element is guaranteed to exist in DOM
      options.overlayUi.scenarioPrompt.querySelector<HTMLElement>(
        '.scenario-prompt',
      )!,
    arrowElement:
      // biome-ignore lint/style/noNonNullAssertion: Element is guaranteed to exist in DOM
      options.overlayUi.scenarioPrompt.querySelector<HTMLElement>(
        '.scenario-prompt-arrow',
      )!,
    titleElement: options.overlayUi.scenarioPromptTitle,
    descriptionElement: options.overlayUi.scenarioPromptDescription,
    closeButton: options.overlayUi.scenarioPromptCloseButton,
    confirmButton: options.overlayUi.scenarioPromptConfirmButton,
    restartButton: options.overlayUi.scenarioPromptRestartButton,
    secondaryButton: options.overlayUi.scenarioPromptSecondaryButton,
    replayButton: options.overlayUi.scenarioPromptReplayButton,
    replayButtonLabel: options.overlayUi.scenarioPromptReplayButtonLabel,
  }
  const scenarioPromptUpdater = createScenarioPromptUpdater(scenarioPromptRefs)

  const triggerWarpFeedback = (variant: 'v2' | 'v4', strength = 1.18) => {
    const timePill =
      options.overlayUi.statTime?.closest<HTMLElement>('.telemetry-pill')
    if (!timePill) {
      return
    }

    timePill.dataset.warpFeedbackVariant = variant
    timePill.style.setProperty('--warp-feedback-scale', strength.toFixed(2))
    timePill.classList.remove('telemetry-pill-warp-bump')
    void timePill.getBoundingClientRect()
    timePill.classList.add('telemetry-pill-warp-bump')
    if (warpFeedbackTimeoutId !== null) {
      window.clearTimeout(warpFeedbackTimeoutId)
    }
    warpFeedbackTimeoutId = window.setTimeout(() => {
      timePill.classList.remove('telemetry-pill-warp-bump')
      warpFeedbackTimeoutId = null
    }, 1000)
  }

  const resetTransientPillEffects = () => {
    const timePill =
      options.overlayUi.statTime?.closest<HTMLElement>('.telemetry-pill')
    timePill?.classList.remove('telemetry-pill-warp-bump')
    if (warpFeedbackTimeoutId !== null) {
      window.clearTimeout(warpFeedbackTimeoutId)
      warpFeedbackTimeoutId = null
    }
    lastTimeWarpIndex = options.runtime.simulation.timeWarpIndex
    lastTimeIconUpdateAt = performance.now()
    lastWarpIncreaseAt = 0
    warpIncreaseStreak = 0
  }

  return {
    update: (metrics: { smoothedCpuMs: number; smoothedFps: number }) => {
      const earth = options.runtime.simulation.state.bodies.find(
        (body) => body.id === 'earth',
      )
      if (!earth) {
        return
      }

      if (options.runtime.ui.uiEffectEpoch !== lastUiEffectEpoch) {
        resetTransientPillEffects()
        lastUiEffectEpoch = options.runtime.ui.uiEffectEpoch
      }

      if (lastTimeWarpIndex !== null) {
        if (options.runtime.simulation.timeWarpIndex > lastTimeWarpIndex) {
          const now = performance.now()
          warpIncreaseStreak =
            now - lastWarpIncreaseAt <= 700 ? warpIncreaseStreak + 1 : 1
          lastWarpIncreaseAt = now
          const strength = Math.min(
            1.36,
            1.16 + (warpIncreaseStreak - 1) * 0.06,
          )
          triggerWarpFeedback('v2', strength)
        }
        if (options.runtime.simulation.timeWarpIndex < lastTimeWarpIndex) {
          warpIncreaseStreak = 0
          triggerWarpFeedback('v4')
        }
      }
      lastTimeWarpIndex = options.runtime.simulation.timeWarpIndex

      const targetUiState = options.queries.getAssistTargetUiState()
      const target = targetUiState.activeTarget
      const targetMetrics = options.queries.getCaptureMetrics(target)
      const circularizePlan =
        options.runtime.simulation.assistMode === 'circularize'
          ? options.queries.getCircularizePlan(target)
          : null
      const predictionState =
        options.trajectoryPresentation.getPredictionState()
      const prompts = resolveScenarioPrompts(options.runtime, inputMode)

      const hiddenUIElements =
        options.runtime.scenario.directives.hiddenUIElements
      const showScenarioInfoButton = !hiddenUIElements.has('scenarioInfoButton')
      const showTimePill = !hiddenUIElements.has('timeWarpPill')
      const showSpeedPill = !hiddenUIElements.has('speedPill')
      const showTargetPill = !hiddenUIElements.has('targetPill')
      const showThrustPill = !hiddenUIElements.has('thrustPill')
      const showTargetControl = !hiddenUIElements.has('targetControl')
      const showTrajectoryControl = !hiddenUIElements.has('trajectory')

      // Update scenario prompt UI
      scenarioPromptUpdater.update(
        options.runtime,
        inputMode,
        showScenarioInfoButton,
      )
      const timePill =
        options.overlayUi.statTime?.closest<HTMLElement>('.telemetry-pill')
      const speedPill =
        options.overlayUi.statSpeed?.closest<HTMLElement>('.telemetry-pill')
      const thrustPill =
        options.overlayUi.statThrust?.closest<HTMLElement>('.telemetry-pill')
      const targetPill = options.overlayUi.targetPill

      if (timePill) {
        timePill.style.display = showTimePill ? 'inline-flex' : 'none'
      }
      options.touchControls?.setTimeWarpControlVisible(showTimePill)
      options.touchControls?.setTargetControlVisible(showTargetControl)
      options.touchControls?.setTrajectoryControlVisible(showTrajectoryControl)

      if (options.overlayUi.statEngine) {
        options.overlayUi.statEngine.textContent = options.physicsEngineName
      }
      if (options.overlayUi.statTime) {
        options.overlayUi.statTime.textContent = `${formatCompactElapsed(options.runtime.simulation.state.elapsed)} · ${formatTimeWarpLabel(
          options.timeWarps[options.runtime.simulation.timeWarpIndex] ?? 1,
        )}`
      }
      if (options.overlayUi.timeIcon) {
        const maxWarpIndex = Math.max(0, options.timeWarps.length - 1)
        const stepsFromMax = Math.max(
          0,
          maxWarpIndex - options.runtime.simulation.timeWarpIndex,
        )
        const iconDurationSeconds = 0.25 * 2 ** stepsFromMax
        const now = performance.now()
        if (lastTimeIconUpdateAt === null) {
          lastTimeIconUpdateAt = now
        }
        const elapsedSeconds = (now - lastTimeIconUpdateAt) / 1000
        lastTimeIconUpdateAt = now
        if (!reducedMotion && options.overlayUi.timeIconHand) {
          timeIconAngle =
            (timeIconAngle + (elapsedSeconds / iconDurationSeconds) * 360) % 360
          options.overlayUi.timeIconHand.style.transform = `rotate(${timeIconAngle.toFixed(2)}deg)`
        }
      }
      if (options.overlayUi.statWarp) {
        options.overlayUi.statWarp.textContent = ''
      }
      if (options.overlayUi.statSpeed) {
        options.overlayUi.statSpeed.textContent = formatSpeed(
          targetMetrics.relativeSpeed,
        )
      }
      {
        const crashed = options.runtime.simulation.crashedBodyName !== null
        const thrusting =
          !crashed &&
          options.runtime.simulation.state.controls.main > 0 &&
          options.runtime.simulation.state.spacecraft.fuel > 0
        if (options.overlayUi.statThrust) {
          options.overlayUi.statThrust.textContent = crashed ? 'Crashed' : ''
        }
        if (speedPill) {
          speedPill.style.display =
            !crashed && showSpeedPill ? 'inline-flex' : 'none'
        }
        if (targetPill) {
          targetPill.style.display =
            !crashed && showTargetPill ? 'inline-flex' : 'none'
        }
        if (thrustPill) {
          thrustPill.style.display =
            crashed && showThrustPill ? 'inline-flex' : 'none'
        }
        thrustPill?.classList.remove('telemetry-pill-thrust-active')
        thrustPill?.classList.toggle('telemetry-pill-thrust-crashed', crashed)
        speedPill?.classList.toggle('telemetry-pill-thrusting', thrusting)
        if (options.overlayUi.speedIcon) {
          options.overlayUi.speedIcon.classList.toggle(
            'telemetry-speed-icon-thrusting',
            thrusting,
          )
        }
      }
      if (options.overlayUi.statFuel) {
        options.overlayUi.statFuel.textContent = `${options.runtime.simulation.state.spacecraft.fuelUsed.toFixed(1)} kg`
      }
      if (options.overlayUi.statZoom) {
        options.overlayUi.statZoom.textContent = `${(options.defaultViewport / options.runtime.simulation.viewportSize).toFixed(1)}x`
      }
      if (options.overlayUi.statTarget) {
        syncTargetPill(targetUiState)
      }
      if (options.overlayUi.statAssist) {
        options.overlayUi.statAssist.textContent = options.runtime.simulation
          .crashedBodyName
          ? 'Crashed'
          : options.runtime.simulation.assistMode === 'capture'
            ? 'Capture'
            : options.runtime.simulation.assistMode === 'circularize'
              ? 'Circularize'
              : 'Off'
      }
      options.touchControls?.updateAssistMode(
        options.runtime.simulation.assistMode,
      )
      options.touchControls?.syncUi()
      options.touchControls?.setTutorialHintTarget(
        prompts.active?.kind === 'coach' && prompts.active.layout === 'anchored'
          ? (prompts.active.touchHintTarget ?? null)
          : null,
      )
      options.touchControls?.setTutorialFocusedControl(
        prompts.active?.kind === 'coach' && prompts.active.layout === 'anchored'
          ? (prompts.active.focusedTouchControl ?? null)
          : null,
      )
      if (options.overlayUi.statGuidance) {
        options.overlayUi.statGuidance.textContent = getGuidanceText({
          assistMode: options.runtime.simulation.assistMode,
          circularizePlan,
          crashedBodyName: options.runtime.simulation.crashedBodyName,
          predictedImpact: predictionState.predictedImpact,
          predictedTargetClosestApproach:
            predictionState.predictedTargetClosestApproach,
          targetMetrics,
        })
      }

      options.overlayUi.debugPanel.element.style.display = options.runtime.debug
        .debugModeEnabled
        ? 'block'
        : 'none'
      if (options.runtime.debug.debugModeEnabled) {
        options.overlayUi.debugPanel.setText(
          getDebugPanelLines({
            assistMode: options.runtime.simulation.assistMode,
            bodyInfluences: getBodyInfluences(options.runtime.simulation.state),
            coastPredictionHorizonSeconds:
              options.queries.getCoastPredictionHorizonSeconds(),
            debugNoGravityEnabled: options.runtime.debug.debugNoGravityEnabled,
            debugSnapshotStatus: options.runtime.debug.debugSnapshotStatus,
            fpsIndicatorEnabled: options.runtime.debug.fpsIndicatorEnabled,
            performanceDebugEnabled:
              options.runtime.debug.performanceDebugEnabled,
            predictionStepSeconds:
              options.queries.getPredictionConfig().stepSeconds,
            predictedImpact: predictionState.predictedImpact,
            predictedTargetClosestApproach:
              predictionState.predictedTargetClosestApproach,
            smoothedCpuMs: metrics.smoothedCpuMs,
            smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
            targetMetrics,
            targetName: target.name,
          }).join('\n'),
        )
        const { scenarioId, state } = options.runtime.scenario
          .session as RuntimeScenarioSession
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
        })
      }

      const fpsIndicatorVisible = options.runtime.debug.fpsIndicatorEnabled
      options.overlayUi.fpsIndicator.style.display = fpsIndicatorVisible
        ? 'block'
        : 'none'
      const fpsMeterInput = {
        smoothedCpuMs: metrics.smoothedCpuMs,
        smoothedFps: metrics.smoothedFps,
        smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
      }
      options.overlayUi.fpsIndicator.textContent =
        getFpsMeterText(fpsMeterInput)
      options.overlayUi.fpsIndicator.dataset.status =
        getFpsMeterStatus(fpsMeterInput)
    },
  }
}

export type HudPresentation = ReturnType<typeof createHudPresentation>

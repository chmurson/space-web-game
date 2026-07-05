import type { RendererProfiler } from '../render/rendererProfiler'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { BrowserGcProbeStats } from '../runtime/browserGcProbe'
import type {
  AssistTargetSelectionSource,
  AssistTargetUiState,
  GameQueries,
} from '../runtime/gameQueries'
import { emptyTrajectoryPredictionDiagnostics } from '../runtime/trajectoryPredictionRuntime'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { RuntimeScenarioSession } from '../scenario/scenarioSession'
import { getBodyInfluences } from '../simulation/bodyInfluence'
import type { Body } from '../simulation/types'
import type { InGameControlsMenu } from '../ui/createInGameControlsMenu'
import {
  formatCompactElapsed,
  formatSpeed,
  formatTimeWarpLabel,
} from '../ui/formatters'
import {
  type FpsMeterFrameSample,
  getDebugPanelLines,
  getFpsMeterGraphModel,
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
import { createBodyDistanceContext } from './bodyDistanceContext'
import { getSpacecraftTrailDetail } from './spacecraftTrail'
import type { TrajectoryPresentation } from './trajectoryPresentation'

const targetStatusLabels: Record<AssistTargetSelectionSource, string> = {
  auto: 'tracking target',
  forced: 'locked target',
  manual: 'pinned target',
}

const getFuelPercent = (fuel: number) => {
  const clampedFuel = Math.max(0, Math.min(1, fuel))
  return clampedFuel <= 0
    ? 0
    : Math.max(1, Math.min(100, Math.round(clampedFuel * 100)))
}

const getFuelState = (fuel: number, fuelPercent: number) =>
  fuel <= 0 ? 'depleted' : fuelPercent <= 15 ? 'low' : 'available'

const syncTargetSphere = (element: HTMLElement, body: Pick<Body, 'color'>) => {
  element.className = 'target-body-sphere'
  element.style.setProperty('--target-body-color', body.color)
}

const debugPanelUpdateIntervalMs = 500
const fpsIndicatorUpdateFrameCycleInterval = 4
const fpsIndicatorSlowFrameMs = 1000 / 15

const createDebugStateCopyPayload = (options: {
  capturedAtMs: number
  physicsEngineName: string
  predictionState: ReturnType<TrajectoryPresentation['getPredictionState']>
  runtime: AppRuntimeState
  target: Body
  targetMetrics: ReturnType<GameQueries['getCaptureMetrics']>
  timeWarp: number
  trail: {
    captureSampleDistanceMeters: number
    detailLabel: string
    detailLevel: number
    detailLevelCount: number
    renderFrame: 'inertial' | 'target-relative'
    renderedSliceCount: number
    renderTargetId: string | null
    renderSampleDistanceMeters: number
    targetBound: boolean
  }
  viewport: {
    size: number
    zoom: number
  }
}) => ({
  capturedAtMs: options.capturedAtMs,
  debug: { ...options.runtime.debug },
  physicsEngineName: options.physicsEngineName,
  scenario: {
    directives: {
      ...options.runtime.scenario.directives,
      hiddenBodyIds: [...options.runtime.scenario.directives.hiddenBodyIds],
      hiddenUIElements: [
        ...options.runtime.scenario.directives.hiddenUIElements.values(),
      ],
    },
    metadata: { ...options.runtime.scenario.metadata },
    session: options.runtime.scenario.session,
  },
  simulation: {
    assistMode: options.runtime.simulation.assistMode,
    assistTarget: {
      id: options.target.id,
      name: options.target.name,
    },
    assistTargetIndex: options.runtime.simulation.assistTargetIndex,
    assistTargetSelectionMode:
      options.runtime.simulation.assistTargetSelectionMode,
    captureMetrics: {
      bound: options.trail.targetBound,
      circularSpeed: options.targetMetrics.circularSpeed,
      distance: options.targetMetrics.distance,
      insideRange: options.targetMetrics.insideRange,
      relativeSpeed: options.targetMetrics.relativeSpeed,
      roughAssistRange: options.targetMetrics.roughAssistRange,
      specificEnergy: options.targetMetrics.specificEnergy,
      surfaceDistance: options.targetMetrics.surfaceDistance,
    },
    coastPredictionHorizonHours:
      options.runtime.simulation.coastPredictionHorizonHours,
    crashedBodyName: options.runtime.simulation.crashedBodyName,
    state: options.runtime.simulation.state,
    targetHeading: options.runtime.simulation.targetHeading,
    targetHeadingTurn: options.runtime.simulation.targetHeadingTurn,
    timeWarp: options.timeWarp,
    timeWarpIndex: options.runtime.simulation.timeWarpIndex,
    viewportSize: options.runtime.simulation.viewportSize,
  },
  trajectoryPrediction: options.predictionState,
  trail: options.trail,
  ui: {
    camera: options.runtime.ui.camera,
    targetHeadingScreenPosition: options.runtime.ui.targetHeadingScreenPosition,
    targetHeadingSelectionEpoch: options.runtime.ui.targetHeadingSelectionEpoch,
    targetHeadingWorldPosition: options.runtime.ui.targetHeadingWorldPosition,
    touchThrustControl: options.runtime.ui.touchThrustControl,
    uiEffectEpoch: options.runtime.ui.uiEffectEpoch,
  },
  viewport: options.viewport,
})

export const createHudPresentation = (options: {
  defaultViewport: number
  inGameControlsMenu?: InGameControlsMenu
  overlayUi: OverlayUiRefs
  physicsEngineName: string
  getTrailRenderedSliceCount?: () => number
  queries: GameQueries
  rendererProfiler: RendererProfiler
  runtime: AppRuntimeState
  targetRecommendationNotice?: {
    sync(targetUiState: AssistTargetUiState): void
  }
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
  let debugPanelWasVisible = false
  let lastDebugPanelContentUpdateAt = Number.NEGATIVE_INFINITY
  let fpsIndicatorWasVisible = false
  let fpsIndicatorFrameCyclesSinceUpdate = 0
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const inputMode = options.touchControls ? 'mobile' : 'desktop'

  const syncTargetPill = (targetUiState: AssistTargetUiState) => {
    const target = targetUiState.activeTarget
    const targetMetrics = options.queries.getCaptureMetrics(target)
    const distanceContext = createBodyDistanceContext({
      target,
      targetMetrics,
    })
    const targetLabel = `${target.name}, ${targetStatusLabels[targetUiState.mode]}, ${distanceContext.detailAccessibleLabel}`

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
    if (
      options.overlayUi.statTargetAltitude &&
      options.overlayUi.statTargetAltitude.textContent !==
        distanceContext.altitudeLabel
    ) {
      options.overlayUi.statTargetAltitude.textContent =
        distanceContext.altitudeLabel
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
    trajectoryAnchorElement: options.overlayUi.trajectoryCoachAnchor,
    trajectoryGuideElement: options.overlayUi.scenarioPromptTrajectoryGuide,
    trajectoryGuideLineElement:
      options.overlayUi.scenarioPromptTrajectoryGuideLine,
    replayButton: options.overlayUi.scenarioPromptReplayButton,
    replayButtonLabel: options.overlayUi.scenarioPromptReplayButtonLabel,
    renderSurface: options.overlayUi.renderScenarioPromptSurface,
  }
  const scenarioPromptUpdater = createScenarioPromptUpdater(scenarioPromptRefs)

  const syncTrajectoryCoachAnchor = () => {
    const screenPoint =
      options.trajectoryPresentation.getCoachAnchorScreenPoint()
    if (!screenPoint) {
      options.overlayUi.trajectoryCoachAnchor.style.display = 'none'
      return
    }

    options.overlayUi.trajectoryCoachAnchor.style.display = 'block'
    options.overlayUi.trajectoryCoachAnchor.style.left = `${screenPoint.x}px`
    options.overlayUi.trajectoryCoachAnchor.style.top = `${screenPoint.y}px`
  }

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

  const syncFuelDepletedNotice = (visible: boolean) => {
    options.overlayUi.fuelDepletedNotice.hidden = !visible
    options.overlayUi.fuelDepletedNotice.dataset.visible = visible
      ? 'true'
      : 'false'
    options.overlayUi.fuelDepletedNotice.setAttribute(
      'aria-hidden',
      visible ? 'false' : 'true',
    )
  }

  return {
    update: (metrics: {
      browserGcStats: BrowserGcProbeStats
      frameIntervalMs: number
      fpsFrameSamples: readonly FpsMeterFrameSample[]
      fpsGraphNowMs: number
      fpsMeterVisible: boolean
      nowMs: number
      smoothedCpuMs: number
      smoothedFps: number
    }) => {
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
      options.targetRecommendationNotice?.sync(targetUiState)
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
      const showThrustControl = !hiddenUIElements.has('thrustControl')
      const showThrustPill = !hiddenUIElements.has('thrustPill')
      const showTargetControl = !hiddenUIElements.has('targetControl')
      const showTrajectoryControl = !hiddenUIElements.has('trajectory')
      const crashed = options.runtime.simulation.crashedBodyName !== null
      const spacecraft = options.runtime.simulation.state.spacecraft
      const finiteFuel = spacecraft.fuelCapacity > 0
      const fuelPercent = getFuelPercent(spacecraft.fuel)

      syncTrajectoryCoachAnchor()

      // Update scenario prompt UI
      scenarioPromptUpdater.update(
        options.runtime,
        inputMode,
        showScenarioInfoButton,
      )
      options.inGameControlsMenu?.syncState()
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
      if (options.overlayUi.fuelPill) {
        options.overlayUi.fuelPill.style.display = finiteFuel
          ? 'inline-flex'
          : 'none'
        options.overlayUi.fuelPill.dataset.fuelState = getFuelState(
          spacecraft.fuel,
          fuelPercent,
        )
        options.overlayUi.fuelPill.setAttribute(
          'aria-label',
          `Fuel remaining ${fuelPercent}%`,
        )
        options.overlayUi.fuelPill.title = `Fuel remaining ${fuelPercent}%`
      }
      syncFuelDepletedNotice(finiteFuel && spacecraft.fuel <= 0 && !crashed)
      options.touchControls?.setBurnControlVisible(showThrustControl)
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
        const elapsedSeconds = crashed ? 0 : (now - lastTimeIconUpdateAt) / 1000
        lastTimeIconUpdateAt = now
        if (!crashed && !reducedMotion && options.overlayUi.timeIconHand) {
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
        options.overlayUi.statFuel.textContent = `${fuelPercent}%`
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

      const debugPanelVisible = options.runtime.debug.debugModeEnabled
      options.overlayUi.debugPanel.element.style.display = debugPanelVisible
        ? 'block'
        : 'none'
      options.overlayUi.debugPanel.element.parentElement?.classList.toggle(
        'app-debug-panel-open',
        debugPanelVisible,
      )
      if (!debugPanelVisible) {
        debugPanelWasVisible = false
      } else if (
        !debugPanelWasVisible ||
        metrics.nowMs - lastDebugPanelContentUpdateAt >=
          debugPanelUpdateIntervalMs
      ) {
        debugPanelWasVisible = true
        lastDebugPanelContentUpdateAt = metrics.nowMs
        const { completed, scenarioId, state } = options.runtime.scenario
          .session as RuntimeScenarioSession
        const viewportSize = options.runtime.simulation.viewportSize
        const zoom = options.defaultViewport / viewportSize
        const trailDetail = getSpacecraftTrailDetail(viewportSize)
        const trailRenderedSliceCount =
          options.getTrailRenderedSliceCount?.() ?? 0
        const targetBound = targetMetrics.specificEnergy < 0
        const trailRenderFrame: 'inertial' | 'target-relative' = targetBound
          ? 'target-relative'
          : 'inertial'
        const trailDebugState = {
          captureSampleDistanceMeters: trailDetail.captureSampleDistanceMeters,
          detailLabel: trailDetail.label,
          detailLevel: trailDetail.level,
          detailLevelCount: trailDetail.levelCount,
          renderFrame: trailRenderFrame,
          renderedSliceCount: trailRenderedSliceCount,
          renderTargetId: targetBound ? target.id : null,
          renderSampleDistanceMeters: trailDetail.renderSampleDistanceMeters,
          targetBound,
        }
        options.overlayUi.debugPanel.setText(
          getDebugPanelLines({
            assistMode: options.runtime.simulation.assistMode,
            bodyInfluences: getBodyInfluences(options.runtime.simulation.state),
            coastPredictionHorizonSeconds:
              options.queries.getCoastPredictionHorizonSeconds(),
            scenarioCompleted: completed,
            scenarioId,
            scenarioState: state,
            debugNoGravityEnabled: options.runtime.debug.debugNoGravityEnabled,
            debugSnapshotStatus: options.runtime.debug.debugSnapshotStatus,
            fpsIndicatorEnabled: options.runtime.debug.fpsIndicatorEnabled,
            predictionDiagnostics:
              options.trajectoryPresentation.getPredictionDiagnostics?.() ??
              emptyTrajectoryPredictionDiagnostics(),
            predictionStepSeconds:
              options.queries.getPredictionConfig().stepSeconds,
            predictedImpact: predictionState.predictedImpact,
            predictedTargetClosestApproach:
              predictionState.predictedTargetClosestApproach,
            targetMetrics,
            targetName: target.name,
            trailDetail: {
              ...trailDetail,
              renderFrame: trailDebugState.renderFrame,
              renderedSliceCount: trailRenderedSliceCount,
            },
            viewportSize,
            zoom,
          }).join('\n'),
        )
        options.overlayUi.debugPanel.setCopyJson(
          createDebugStateCopyPayload({
            capturedAtMs: metrics.nowMs,
            physicsEngineName: options.physicsEngineName,
            predictionState,
            runtime: options.runtime,
            target,
            targetMetrics,
            timeWarp:
              options.timeWarps[options.runtime.simulation.timeWarpIndex] ?? 1,
            trail: trailDebugState,
            viewport: {
              size: viewportSize,
              zoom,
            },
          }),
        )
        options.overlayUi.debugPanel.setJson({
          assistTarget: target.id,
          captureMetrics: {
            bound: targetBound,
            circularSpeed: targetMetrics.circularSpeed,
            distance: targetMetrics.distance,
            relativeSpeed: targetMetrics.relativeSpeed,
            specificEnergy: targetMetrics.specificEnergy,
            surfaceDistance: targetMetrics.surfaceDistance,
          },
          debugModeEnabled: options.runtime.debug.debugModeEnabled,
          scenarioId,
          state,
          trail: {
            ...trailDebugState,
          },
          viewport: {
            size: viewportSize,
            zoom,
          },
        })
      }

      if (!metrics.fpsMeterVisible) {
        if (fpsIndicatorWasVisible || !options.overlayUi.fpsIndicator.hidden) {
          options.overlayUi.renderFpsIndicator(null)
        }
        fpsIndicatorWasVisible = false
        fpsIndicatorFrameCyclesSinceUpdate = 0
        return
      }

      fpsIndicatorFrameCyclesSinceUpdate += 1
      const shouldUpdateFpsIndicator =
        !fpsIndicatorWasVisible ||
        fpsIndicatorFrameCyclesSinceUpdate >=
          fpsIndicatorUpdateFrameCycleInterval ||
        metrics.frameIntervalMs > fpsIndicatorSlowFrameMs

      fpsIndicatorWasVisible = true

      if (shouldUpdateFpsIndicator) {
        fpsIndicatorFrameCyclesSinceUpdate = 0
        const graph = getFpsMeterGraphModel({
          browserGcStats: metrics.browserGcStats,
          frameSamples: metrics.fpsFrameSamples,
          nowMs: metrics.fpsGraphNowMs,
        })
        const fpsMeterInput = {
          browserGcStats: metrics.browserGcStats,
          graphMaxCpuMs: graph.maxCpuMs,
          smoothedCpuMs: metrics.smoothedCpuMs,
          smoothedFps: metrics.smoothedFps,
          smoothedGpuMs: options.rendererProfiler.getSmoothedGpuMs(),
        }
        options.overlayUi.renderFpsIndicator({
          graph,
          status: getFpsMeterStatus(fpsMeterInput),
          text: getFpsMeterText(fpsMeterInput),
        })
      }
    },
  }
}

export type HudPresentation = ReturnType<typeof createHudPresentation>

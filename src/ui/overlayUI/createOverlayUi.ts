import { h, render } from 'preact'
import type { TrajectoryPredictionEventMarkerKind } from '../../prediction/trajectoryPrediction'
import type { Body } from '../../simulation/types'
import {
  FpsIndicatorSurface,
  type FpsIndicatorView,
  type TelemetryStripRefs,
  TelemetryStripSurface,
} from '../components/HudTelemetrySurface'
import { createPreactUiSurface } from '../createPreactUiSurface'
import { createDebugPanel, type DebugPanel } from '../debugPanel'
import {
  createScenarioPromptUI,
  type ScenarioPromptSurfaceRenderer,
} from '../scenario-prompts/scenario-prompts'
import '../targetBodyGlyphs.css'
import { createBottomHudNoticesSurface } from './createBottomHudNoticesSurface'
import './overlayUIStyles.css'

export const spacecraftOffscreenIndicatorId = '__spacecraft__'

export type OverlayUiRefs = {
  bodyLabels: Map<string, HTMLElement>
  bottomPillArea: HTMLElement
  transientNotice: HTMLElement
  transientNoticeBody: HTMLSpanElement | null
  transientNoticeTitle: HTMLSpanElement | null
  debugPanel: DebugPanel
  desktopInfoContainer: HTMLElement
  fpsIndicator: HTMLElement
  fuelDepletedNotice: HTMLElement
  fuelIconLevel: SVGRectElement | null
  fuelPill: HTMLElement | null
  offscreenIndicators: Map<string, HTMLElement>
  rcsActualTurnOverlay: SVGSVGElement
  rcsActualTurnSlices: SVGPathElement[]
  renderScenarioPromptSurface: ScenarioPromptSurfaceRenderer
  renderFpsIndicator(view: FpsIndicatorView | null): void
  scenarioPrompt: HTMLElement
  scenarioPromptCloseButton: HTMLButtonElement | null
  scenarioPromptConfirmButton: HTMLButtonElement | null
  scenarioPromptDescription: HTMLParagraphElement | null
  scenarioPromptReplayButton: HTMLButtonElement
  scenarioPromptReplayButtonLabel: HTMLSpanElement | null
  scenarioPromptRestartButton: HTMLButtonElement | null
  scenarioPromptSecondaryButton: HTMLButtonElement | null
  scenarioPromptTitle: HTMLHeadingElement | null
  scenarioPromptTrajectoryGuide: SVGSVGElement | null
  scenarioPromptTrajectoryGuideLine: SVGPolylineElement | null
  spacecraftCallout: HTMLElement
  spacecraftCalloutLabel: HTMLSpanElement | null
  spacecraftIconThrust: HTMLElement
  trajectoryCoachAnchor: HTMLElement
  statAssist: HTMLElement | null
  statEngine: HTMLElement | null
  statFuel: HTMLElement | null
  statGuidance: HTMLElement | null
  statSpeed: HTMLElement | null
  targetRecommendationNotice: HTMLElement
  targetRecommendationNoticeDismissButton: HTMLButtonElement | null
  targetRecommendationNoticeMessage: HTMLSpanElement | null
  targetRecommendationNoticeOpenButton: HTMLButtonElement | null
  statThrust: HTMLElement | null
  speedIcon: SVGSVGElement | null
  statTarget: HTMLElement | null
  statTargetAltitude: HTMLElement | null
  targetCluster: HTMLElement | null
  targetPill: HTMLElement | null
  targetSelectorButton: HTMLButtonElement | null
  targetSelectorButtonStatus: HTMLElement | null
  targetSelectorPopover: HTMLElement | null
  targetSphere: HTMLElement | null
  targetStatus: HTMLElement | null
  statTargetSpeed: HTMLElement | null
  statTime: HTMLElement | null
  statTimeElapsed: HTMLElement | null
  statTimeWarp: HTMLElement | null
  timeIcon: SVGSVGElement | null
  timeIconHand: SVGLineElement | null
  trajectoryEventMarkerLabels: Record<
    TrajectoryPredictionEventMarkerKind,
    HTMLElement
  >
  statWarp: HTMLElement | null
  statZoom: HTMLElement | null
}

export type OverlayUiOptions = {
  app: HTMLElement
  bodies: Body[]
  showCycleTargetHint: boolean
}

const createEmptyTelemetryRefs = (): TelemetryStripRefs => ({
  fuelIconLevel: null,
  fuelPill: null,
  speedIcon: null,
  statFuel: null,
  statSpeed: null,
  statTarget: null,
  statTargetAltitude: null,
  statThrust: null,
  statTime: null,
  statTimeElapsed: null,
  statTimeWarp: null,
  targetCluster: null,
  targetPill: null,
  targetSelectorButton: null,
  targetSelectorButtonStatus: null,
  targetSelectorPopover: null,
  targetSphere: null,
  targetStatus: null,
  timeIcon: null,
  timeIconHand: null,
})

const createHudTelemetryShells = (options: {
  app: HTMLElement
  topBar: HTMLElement
}) => {
  const telemetryHost = document.createElement('div')
  const telemetryRefs = createEmptyTelemetryRefs()
  options.topBar.appendChild(telemetryHost)
  render(h(TelemetryStripSurface, { refs: telemetryRefs }), telemetryHost)
  telemetryHost.style.display = 'contents'

  const fpsSurface = createPreactUiSurface<{
    view: FpsIndicatorView | null
  }>({
    app: options.app,
    component: FpsIndicatorSurface,
    missingRootError: 'Failed to create FPS indicator',
  })
  fpsSurface.render({ view: null })

  const fpsHost = fpsSurface.element.parentElement
  if (!fpsHost) {
    throw new Error('Failed to create FPS indicator')
  }
  fpsHost.className = 'fps-indicator-host'
  fpsHost.style.display = 'contents'

  return {
    fpsIndicator: fpsSurface.element,
    renderFpsIndicator: (view: FpsIndicatorView | null) =>
      fpsSurface.render({ view }),
    telemetryRefs,
  }
}

const createTrajectoryEventMarkerLabel = (
  app: HTMLElement,
  kind: TrajectoryPredictionEventMarkerKind,
) => {
  const label = document.createElement('button')
  label.type = 'button'
  label.className = `trajectory-event-label trajectory-event-label-${kind}`
  label.dataset.trajectoryEventMarker = kind
  label.dataset.infoPin = kind
  label.style.display = 'none'
  label.setAttribute('aria-hidden', 'true')
  app.appendChild(label)
  return label
}

export const createOverlayUi = (options: OverlayUiOptions): OverlayUiRefs => {
  const topBar = document.createElement('div')
  topBar.className = 'top-bar'
  options.app.appendChild(topBar)

  const bottomHudNotices = createBottomHudNoticesSurface(options.app)
  const { bottomPillArea } = bottomHudNotices

  const debugPanel = createDebugPanel(options.app)

  const hudTelemetry = createHudTelemetryShells({
    app: options.app,
    topBar,
  })
  const desktopInfoContainer = document.createElement('div')
  desktopInfoContainer.className = 'desktop-info-hud-host'
  topBar.appendChild(desktopInfoContainer)

  const scenarioPromptUi = createScenarioPromptUI(options.app, bottomPillArea)

  const spacecraftCallout = document.createElement('div')
  spacecraftCallout.className = 'spacecraft-callout'
  spacecraftCallout.innerHTML = '<span>Spacecraft</span>'
  options.app.appendChild(spacecraftCallout)
  const spacecraftCalloutLabel =
    spacecraftCallout.querySelector<HTMLSpanElement>('span')

  const spacecraftIconThrust = document.createElement('div')
  spacecraftIconThrust.className = 'spacecraft-icon-thrust'
  spacecraftIconThrust.style.display = 'none'
  options.app.appendChild(spacecraftIconThrust)

  const rcsActualTurnOverlay = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  )
  rcsActualTurnOverlay.classList.add('rcs-actual-turn-overlay')
  rcsActualTurnOverlay.setAttribute('aria-hidden', 'true')
  rcsActualTurnOverlay.setAttribute(
    'viewBox',
    `0 0 ${window.innerWidth} ${window.innerHeight}`,
  )
  rcsActualTurnOverlay.style.display = 'none'

  const rcsActualTurnSlicesGroup = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'g',
  )
  rcsActualTurnSlicesGroup.classList.add('rcs-actual-turn-slices')
  rcsActualTurnOverlay.appendChild(rcsActualTurnSlicesGroup)

  const rcsActualTurnSlices = Array.from({ length: 40 }, () => {
    const slice = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    slice.classList.add('rcs-actual-turn-slice')
    slice.style.display = 'none'
    rcsActualTurnSlicesGroup.appendChild(slice)
    return slice
  })
  options.app.appendChild(rcsActualTurnOverlay)

  const offscreenIndicators = new Map<string, HTMLElement>()
  const bodyLabels = new Map<string, HTMLElement>()
  const trajectoryEventMarkerLabels = {
    apoapsis: createTrajectoryEventMarkerLabel(options.app, 'apoapsis'),
    periapsis: createTrajectoryEventMarkerLabel(options.app, 'periapsis'),
  } satisfies Record<TrajectoryPredictionEventMarkerKind, HTMLElement>
  const createOffscreenIndicator = () => {
    const indicator = document.createElement('div')
    indicator.className = 'offscreen-indicator'
    indicator.innerHTML =
      '<svg class="pointer" viewBox="0 0 12 12" aria-hidden="true"><path d="M 1 10 L 6 1 L 11 10 Z"></path></svg><div class="label"></div>'
    indicator.style.display = 'none'
    options.app.appendChild(indicator)
    return indicator
  }

  for (const body of options.bodies) {
    const indicator = createOffscreenIndicator()
    indicator.dataset.offscreenTarget = body.id
    offscreenIndicators.set(body.id, indicator)

    const label = document.createElement('button')
    label.type = 'button'
    label.className = 'body-label'
    label.dataset.infoPin = `body:${body.id}`
    label.textContent = body.name
    label.style.display = 'none'
    options.app.appendChild(label)
    bodyLabels.set(body.id, label)
  }

  const spacecraftOffscreenIndicator = createOffscreenIndicator()
  spacecraftOffscreenIndicator.dataset.offscreenTarget =
    spacecraftOffscreenIndicatorId
  offscreenIndicators.set(
    spacecraftOffscreenIndicatorId,
    spacecraftOffscreenIndicator,
  )

  return {
    bodyLabels,
    bottomPillArea,
    debugPanel,
    desktopInfoContainer,
    fpsIndicator: hudTelemetry.fpsIndicator,
    fuelDepletedNotice: bottomHudNotices.fuelDepletedNotice,
    fuelIconLevel: hudTelemetry.telemetryRefs.fuelIconLevel,
    fuelPill: hudTelemetry.telemetryRefs.fuelPill,
    offscreenIndicators,
    rcsActualTurnOverlay,
    rcsActualTurnSlices,
    renderScenarioPromptSurface: scenarioPromptUi.renderSurface,
    renderFpsIndicator: hudTelemetry.renderFpsIndicator,
    scenarioPrompt: scenarioPromptUi.backdropElement,
    scenarioPromptCloseButton: scenarioPromptUi.closeButton,
    scenarioPromptConfirmButton: scenarioPromptUi.confirmButton,
    scenarioPromptDescription: scenarioPromptUi.descriptionElement,
    scenarioPromptReplayButton: scenarioPromptUi.replayButton,
    scenarioPromptReplayButtonLabel: scenarioPromptUi.replayButtonLabel,
    scenarioPromptRestartButton: scenarioPromptUi.restartButton,
    scenarioPromptSecondaryButton: scenarioPromptUi.secondaryButton,
    scenarioPromptTitle: scenarioPromptUi.titleElement,
    scenarioPromptTrajectoryGuide: scenarioPromptUi.trajectoryGuideElement,
    scenarioPromptTrajectoryGuideLine:
      scenarioPromptUi.trajectoryGuideLineElement,
    spacecraftCallout,
    spacecraftCalloutLabel,
    spacecraftIconThrust,
    trajectoryCoachAnchor: scenarioPromptUi.trajectoryAnchorElement,
    statAssist: null,
    statEngine: null,
    statFuel: hudTelemetry.telemetryRefs.statFuel,
    statGuidance: null,
    statSpeed: hudTelemetry.telemetryRefs.statSpeed,
    targetRecommendationNotice: bottomHudNotices.targetRecommendationNotice,
    targetRecommendationNoticeDismissButton:
      bottomHudNotices.targetRecommendationNoticeDismissButton,
    targetRecommendationNoticeMessage:
      bottomHudNotices.targetRecommendationNoticeMessage,
    targetRecommendationNoticeOpenButton:
      bottomHudNotices.targetRecommendationNoticeOpenButton,
    statThrust: hudTelemetry.telemetryRefs.statThrust,
    speedIcon: hudTelemetry.telemetryRefs.speedIcon,
    statTarget: hudTelemetry.telemetryRefs.statTarget,
    statTargetAltitude: hudTelemetry.telemetryRefs.statTargetAltitude,
    targetCluster: hudTelemetry.telemetryRefs.targetCluster,
    targetPill: hudTelemetry.telemetryRefs.targetPill,
    targetSelectorButton: hudTelemetry.telemetryRefs.targetSelectorButton,
    targetSelectorButtonStatus:
      hudTelemetry.telemetryRefs.targetSelectorButtonStatus,
    targetSelectorPopover: hudTelemetry.telemetryRefs.targetSelectorPopover,
    targetSphere: hudTelemetry.telemetryRefs.targetSphere,
    targetStatus: hudTelemetry.telemetryRefs.targetStatus,
    statTargetSpeed: null,
    statTime: hudTelemetry.telemetryRefs.statTime,
    statTimeElapsed: hudTelemetry.telemetryRefs.statTimeElapsed,
    statTimeWarp: hudTelemetry.telemetryRefs.statTimeWarp,
    timeIcon: hudTelemetry.telemetryRefs.timeIcon,
    timeIconHand: hudTelemetry.telemetryRefs.timeIconHand,
    trajectoryEventMarkerLabels,
    statWarp: null,
    statZoom: null,
    transientNotice: bottomHudNotices.transientNotice,
    transientNoticeBody: bottomHudNotices.transientNoticeBody,
    transientNoticeTitle: bottomHudNotices.transientNoticeTitle,
  }
}

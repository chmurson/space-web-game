import { h, render } from 'preact'
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
import './overlayUIStyles.css'

export const spacecraftOffscreenIndicatorId = '__spacecraft__'

export type OverlayUiRefs = {
  bodyLabels: Map<string, HTMLElement>
  bottomPillArea: HTMLElement
  cameraUnlockNotice: HTMLElement
  cameraUnlockNoticeBody: HTMLSpanElement | null
  cameraUnlockNoticeTitle: HTMLSpanElement | null
  debugPanel: DebugPanel
  fpsIndicator: HTMLElement
  fuelDepletedNotice: HTMLElement
  fuelPill: HTMLElement | null
  headingTargetDot: HTMLElement
  headingTargetLine: SVGLineElement
  headingTargetOverlay: SVGSVGElement
  headingTargetTurnSlice: SVGPathElement
  offscreenIndicators: Map<string, HTMLElement>
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
  targetPill: HTMLElement | null
  targetSphere: HTMLElement | null
  targetStatus: HTMLElement | null
  statTargetSpeed: HTMLElement | null
  statTime: HTMLElement | null
  timeIcon: SVGSVGElement | null
  timeIconHand: SVGLineElement | null
  statWarp: HTMLElement | null
  statZoom: HTMLElement | null
}

export type OverlayUiOptions = {
  app: HTMLElement
  bodies: Body[]
  showCycleTargetHint: boolean
}

const createEmptyTelemetryRefs = (): TelemetryStripRefs => ({
  fuelPill: null,
  speedIcon: null,
  statFuel: null,
  statSpeed: null,
  statTarget: null,
  statThrust: null,
  statTime: null,
  targetPill: null,
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

export const createOverlayUi = (options: OverlayUiOptions): OverlayUiRefs => {
  const topBar = document.createElement('div')
  topBar.className = 'top-bar'
  options.app.appendChild(topBar)

  const bottomPillArea = document.createElement('div')
  bottomPillArea.className = 'bottom-pill-area'
  options.app.appendChild(bottomPillArea)

  const debugPanel = createDebugPanel(options.app)

  const hudTelemetry = createHudTelemetryShells({
    app: options.app,
    topBar,
  })

  const fuelDepletedNotice = document.createElement('div')
  fuelDepletedNotice.className =
    'hud-notice hud-notice-durable fuel-depleted-notice'
  fuelDepletedNotice.dataset.visible = 'false'
  fuelDepletedNotice.setAttribute('role', 'status')
  fuelDepletedNotice.setAttribute('aria-live', 'polite')
  fuelDepletedNotice.setAttribute('aria-atomic', 'true')
  fuelDepletedNotice.setAttribute('aria-hidden', 'true')
  fuelDepletedNotice.hidden = true
  fuelDepletedNotice.innerHTML = `
    <span class="hud-notice-title">Fuel depleted</span>
    <span class="hud-notice-body">Thrusters disabled</span>
  `
  bottomPillArea.appendChild(fuelDepletedNotice)

  const scenarioPromptUi = createScenarioPromptUI(options.app, bottomPillArea)

  const cameraUnlockNotice = document.createElement('div')
  cameraUnlockNotice.className = 'hud-notice hud-notice-transient'
  cameraUnlockNotice.dataset.visible = 'false'
  cameraUnlockNotice.setAttribute('role', 'status')
  cameraUnlockNotice.setAttribute('aria-live', 'polite')
  cameraUnlockNotice.setAttribute('aria-atomic', 'true')
  cameraUnlockNotice.setAttribute('aria-hidden', 'true')
  cameraUnlockNotice.hidden = true
  cameraUnlockNotice.innerHTML = `
    <span class="hud-notice-title"></span>
    <span class="hud-notice-body"></span>
  `
  bottomPillArea.appendChild(cameraUnlockNotice)

  const targetRecommendationNotice = document.createElement('div')
  targetRecommendationNotice.className =
    'hud-notice target-recommendation-notice'
  targetRecommendationNotice.dataset.visible = 'false'
  targetRecommendationNotice.setAttribute('aria-live', 'polite')
  targetRecommendationNotice.setAttribute('aria-atomic', 'true')
  targetRecommendationNotice.setAttribute('aria-hidden', 'true')
  targetRecommendationNotice.hidden = true
  targetRecommendationNotice.innerHTML = `
    <button type="button" class="target-recommendation-notice-open">
      <span class="target-recommendation-notice-message"></span>
    </button>
    <button type="button" class="target-recommendation-notice-dismiss" aria-label="Dismiss target recommendation">
      <span aria-hidden="true">&times;</span>
    </button>
  `
  bottomPillArea.appendChild(targetRecommendationNotice)

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

  const headingTargetOverlay = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  )
  headingTargetOverlay.classList.add('heading-target-overlay')
  headingTargetOverlay.setAttribute('aria-hidden', 'true')
  headingTargetOverlay.setAttribute(
    'viewBox',
    `0 0 ${window.innerWidth} ${window.innerHeight}`,
  )
  headingTargetOverlay.style.display = 'none'

  const headingTargetLine = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'line',
  )
  headingTargetLine.classList.add('heading-target-line')
  headingTargetOverlay.appendChild(headingTargetLine)

  const headingTargetTurnSlice = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'path',
  )
  headingTargetTurnSlice.classList.add('heading-target-turn-slice')
  headingTargetOverlay.appendChild(headingTargetTurnSlice)
  options.app.appendChild(headingTargetOverlay)

  const headingTargetDot = document.createElement('div')
  headingTargetDot.className = 'heading-target-dot'
  headingTargetDot.style.display = 'none'
  options.app.appendChild(headingTargetDot)

  const offscreenIndicators = new Map<string, HTMLElement>()
  const bodyLabels = new Map<string, HTMLElement>()
  const createOffscreenIndicator = () => {
    const indicator = document.createElement('div')
    indicator.className = 'offscreen-indicator'
    indicator.innerHTML = '<div class="pointer"></div><div class="label"></div>'
    indicator.style.display = 'none'
    options.app.appendChild(indicator)
    return indicator
  }

  for (const body of options.bodies) {
    const indicator = createOffscreenIndicator()
    offscreenIndicators.set(body.id, indicator)

    const label = document.createElement('div')
    label.className = 'body-label'
    label.textContent = body.name
    label.style.display = 'none'
    options.app.appendChild(label)
    bodyLabels.set(body.id, label)
  }

  offscreenIndicators.set(
    spacecraftOffscreenIndicatorId,
    createOffscreenIndicator(),
  )

  return {
    bodyLabels,
    bottomPillArea,
    cameraUnlockNotice,
    cameraUnlockNoticeBody:
      cameraUnlockNotice.querySelector<HTMLSpanElement>('.hud-notice-body'),
    cameraUnlockNoticeTitle:
      cameraUnlockNotice.querySelector<HTMLSpanElement>('.hud-notice-title'),
    debugPanel,
    fpsIndicator: hudTelemetry.fpsIndicator,
    fuelDepletedNotice,
    fuelPill: hudTelemetry.telemetryRefs.fuelPill,
    headingTargetDot,
    headingTargetLine,
    headingTargetOverlay,
    headingTargetTurnSlice,
    offscreenIndicators,
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
    targetRecommendationNotice,
    targetRecommendationNoticeDismissButton:
      targetRecommendationNotice.querySelector<HTMLButtonElement>(
        '.target-recommendation-notice-dismiss',
      ),
    targetRecommendationNoticeMessage:
      targetRecommendationNotice.querySelector<HTMLSpanElement>(
        '.target-recommendation-notice-message',
      ),
    targetRecommendationNoticeOpenButton:
      targetRecommendationNotice.querySelector<HTMLButtonElement>(
        '.target-recommendation-notice-open',
      ),
    statThrust: hudTelemetry.telemetryRefs.statThrust,
    speedIcon: hudTelemetry.telemetryRefs.speedIcon,
    statTarget: hudTelemetry.telemetryRefs.statTarget,
    targetPill: hudTelemetry.telemetryRefs.targetPill,
    targetSphere: hudTelemetry.telemetryRefs.targetSphere,
    targetStatus: hudTelemetry.telemetryRefs.targetStatus,
    statTargetSpeed: null,
    statTime: hudTelemetry.telemetryRefs.statTime,
    timeIcon: hudTelemetry.telemetryRefs.timeIcon,
    timeIconHand: hudTelemetry.telemetryRefs.timeIconHand,
    statWarp: null,
    statZoom: null,
  }
}

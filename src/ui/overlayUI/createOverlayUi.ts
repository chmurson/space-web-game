import type { Body } from '../../simulation/types'
import { createDebugPanel, type DebugPanel } from '../debugPanel'
import {
  createScenarioPromptUI,
  type ScenarioPromptSurfaceRenderer,
} from '../scenario-prompts/scenario-prompts'
import '../targetBodyGlyphs.css'
import { createBottomHudNoticesSurface } from './createBottomHudNoticesSurface'
import './overlayUIStyles.css'

const crashIconMarkup = `
  <svg class="telemetry-crash-icon telemetry-crash-icon-burst" viewBox="0 0 16 16" aria-hidden="true">
    <path class="telemetry-crash-icon-blast" d="M8 1.1 9 4.5 12.6 3.2 10.9 6.1 14.4 7.3 11.2 8.8 12.3 12 9.2 11.1 8 13.9 6.9 11.2 3.6 12.3 4.8 9.1 1.6 7.9 4.6 6.4 3.2 3.4 6.5 4.6Z"></path>
    <g class="telemetry-crash-icon-rocket">
      <path class="telemetry-crash-icon-rocket-body" d="M8 1.5 L10.5 6.2 L10.2 10.1 L9 12.8 L7 12.8 L5.8 10.1 L5.5 6.2 Z"></path>
      <path class="telemetry-crash-icon-rocket-wing" d="M5.7 8.8 L3.9 10.8 L5.8 11.1 Z"></path>
      <path class="telemetry-crash-icon-rocket-wing" d="M10.3 8.8 L12.1 10.8 L10.2 11.1 Z"></path>
      <circle class="telemetry-crash-icon-rocket-window" cx="8" cy="6.1" r="0.95"></circle>
    </g>
  </svg>
`

const fuelIconMarkup = `
  <svg class="telemetry-fuel-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path class="telemetry-fuel-icon-tank" d="M5.1 2.2h5.8l1.25 1.7v8.4c0 .85-.55 1.5-1.42 1.5H5.27c-.87 0-1.42-.65-1.42-1.5V3.9Z"></path>
    <path class="telemetry-fuel-icon-cap" d="M5.6 2.2V1.3h4.8v.9"></path>
    <path class="telemetry-fuel-icon-level" d="M5.65 10.65h4.7"></path>
  </svg>
`

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

export const createOverlayUi = (options: OverlayUiOptions): OverlayUiRefs => {
  const topBar = document.createElement('div')
  topBar.className = 'top-bar'
  options.app.appendChild(topBar)

  const bottomHudNotices = createBottomHudNoticesSurface(options.app)
  const { bottomPillArea } = bottomHudNotices

  const telemetryStrip = document.createElement('div')
  telemetryStrip.className = 'telemetry-strip'

  telemetryStrip.innerHTML = `
    <div class="telemetry-pill telemetry-pill-time">
      <span class="telemetry-time-display">
        <svg class="telemetry-time-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="telemetry-time-icon-face" cx="8" cy="8" r="6.25"></circle>
          <line class="telemetry-time-icon-hand telemetry-time-icon-hand-minute" x1="8" y1="8" x2="8" y2="3.5"></line>
          <circle class="telemetry-time-icon-center" cx="8" cy="8" r="0.9"></circle>
        </svg>
        <strong data-stat="time"></strong>
      </span>
    </div>
    <div class="telemetry-pill telemetry-pill-thrust">
      <span class="telemetry-thrust-display">
        ${crashIconMarkup}
        <strong data-stat="thrust"></strong>
      </span>
    </div>
    <div class="telemetry-critical-cluster">
      <div class="telemetry-pill telemetry-pill-fuel" style="display: none">
        <span class="telemetry-fuel-display">
          ${fuelIconMarkup}
          <strong data-stat="fuel"></strong>
        </span>
      </div>
      <div class="telemetry-pill telemetry-pill-velocity">
        <span class="telemetry-speed-display">
          <svg class="telemetry-speed-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path class="telemetry-speed-icon-body" d="M8 1.5 L10.5 6.2 L10.2 10.1 L9 12.8 L7 12.8 L5.8 10.1 L5.5 6.2 Z"></path>
            <path class="telemetry-speed-icon-wing telemetry-speed-icon-wing-left" d="M5.7 8.8 L3.9 10.8 L5.8 11.1 Z"></path>
            <path class="telemetry-speed-icon-wing telemetry-speed-icon-wing-right" d="M10.3 8.8 L12.1 10.8 L10.2 11.1 Z"></path>
            <circle class="telemetry-speed-icon-window" cx="8" cy="6.1" r="0.95"></circle>
            <path class="telemetry-speed-icon-flame" d="M8 14.6 C8.9 13.6, 9.3 12.4, 8 11.1 C6.7 12.4, 7.1 13.6, 8 14.6 Z"></path>
          </svg>
          <strong data-stat="speed"></strong>
        </span>
      </div>
    </div>
    <div class="telemetry-pill telemetry-pill-target">
      <span class="telemetry-target-display">
        <span class="target-body-sphere" data-stat="target-sphere" aria-hidden="true"></span>
        <strong data-stat="target"></strong>
        <span class="target-status-mark" data-stat="target-status" aria-hidden="true"></span>
      </span>
    </div>
  `
  topBar.appendChild(telemetryStrip)

  const debugPanel = createDebugPanel(options.app)

  const fpsIndicator = document.createElement('div')
  fpsIndicator.className = 'fps-indicator'

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
    cameraUnlockNotice: bottomHudNotices.cameraUnlockNotice,
    cameraUnlockNoticeBody: bottomHudNotices.cameraUnlockNoticeBody,
    cameraUnlockNoticeTitle: bottomHudNotices.cameraUnlockNoticeTitle,
    debugPanel,
    fpsIndicator,
    fuelDepletedNotice: bottomHudNotices.fuelDepletedNotice,
    fuelPill: topBar.querySelector<HTMLElement>('.telemetry-pill-fuel'),
    headingTargetDot,
    headingTargetLine,
    headingTargetOverlay,
    headingTargetTurnSlice,
    offscreenIndicators,
    renderScenarioPromptSurface: scenarioPromptUi.renderSurface,
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
    statFuel: topBar.querySelector<HTMLElement>('[data-stat="fuel"]'),
    statGuidance: null,
    statSpeed: topBar.querySelector<HTMLElement>('[data-stat="speed"]'),
    targetRecommendationNotice: bottomHudNotices.targetRecommendationNotice,
    targetRecommendationNoticeDismissButton:
      bottomHudNotices.targetRecommendationNoticeDismissButton,
    targetRecommendationNoticeMessage:
      bottomHudNotices.targetRecommendationNoticeMessage,
    targetRecommendationNoticeOpenButton:
      bottomHudNotices.targetRecommendationNoticeOpenButton,
    statThrust: topBar.querySelector<HTMLElement>('[data-stat="thrust"]'),
    speedIcon: topBar.querySelector<SVGSVGElement>('.telemetry-speed-icon'),
    statTarget: topBar.querySelector<HTMLElement>('[data-stat="target"]'),
    targetPill: topBar.querySelector<HTMLElement>('.telemetry-pill-target'),
    targetSphere: topBar.querySelector<HTMLElement>(
      '[data-stat="target-sphere"]',
    ),
    targetStatus: topBar.querySelector<HTMLElement>(
      '[data-stat="target-status"]',
    ),
    statTargetSpeed: null,
    statTime: topBar.querySelector<HTMLElement>('[data-stat="time"]'),
    timeIcon: topBar.querySelector<SVGSVGElement>('.telemetry-time-icon'),
    timeIconHand: topBar.querySelector<SVGLineElement>(
      '.telemetry-time-icon-hand-minute',
    ),
    statWarp: null,
    statZoom: null,
  }
}

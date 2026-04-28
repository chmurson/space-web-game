import './thrustControl.css'
import type { TouchThrustControlUiState } from '../../runtime/appRuntimeState'
import {
  createTouchInteractionModel,
  type TouchInteractionSnapshot,
  type TouchOverlayPoint,
} from './touchInteractionModel'

type OverlaySize = {
  halfHeight: number
  halfWidth: number
}

type PendingThrustSession = {
  kind: 'right-zone-pending'
  holdTimer: number
  startX: number
  startY: number
  touchId: number
}

type ActiveThrustSession = {
  kind: 'right-zone-active'
  startLatched: boolean
  startX: number
  startY: number
  touchId: number
}

export type ThrustGestureSession =
  | { kind: 'none' }
  | PendingThrustSession
  | ActiveThrustSession

const thrustAppearHoldMs = 180
const thrustLatchedLabelHideDelayMs = 500
const thrustControlSpawnOffsetPx = 54
const thrustControlHitRadiusPx = 90
const screenEdgePaddingPx = 12
const pendingFadeInDelayMs = 125
const pendingFadeInMs = thrustAppearHoldMs + 160

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const measureOverlaySize = (
  element: HTMLElement,
  fallback: OverlaySize,
): OverlaySize => {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return fallback
  }

  return {
    halfHeight: rect.height / 2,
    halfWidth: rect.width / 2,
  }
}

export const createThrustControl = (options: {
  container?: HTMLElement
  onSessionChange(session: ThrustGestureSession): void
  onUiStateChange(state: TouchThrustControlUiState): void
  panel: HTMLElement
  setMainThrust(engaged: boolean): void
  tapMoveTolerancePx: number
  vibrate(): void
}) => {
  const thrustControl = document.createElement('div')
  thrustControl.className = 'touch-thrust-control'
  thrustControl.setAttribute('aria-hidden', 'true')
  thrustControl.innerHTML = `
    <div class="touch-thrust-control-track">
      <div class="touch-thrust-control-thumb"></div>
    </div>
    <div class="touch-thrust-control-label">Thrust</div>
  `
  const isDocked = Boolean(options.container)
  if (isDocked) {
    thrustControl.classList.add('touch-thrust-control-docked')
  }
  const parentElement = options.container ?? options.panel
  parentElement.appendChild(thrustControl)

  const thrustControlLabel = thrustControl.querySelector<HTMLDivElement>(
    '.touch-thrust-control-label',
  )
  const thrustControlThumb = thrustControl.querySelector<HTMLDivElement>(
    '.touch-thrust-control-thumb',
  )

  const interactionModel = createTouchInteractionModel()
  let thrustLabelHideTimer: number | null = null
  let pendingFadeTimer: number | null = null
  let isPendingFadeReady = false
  let isThrustLabelVisible = true
  let isPendingVisible = false
  let isAvailable = true
  let thrustControlSize: OverlaySize = {
    halfHeight: 88,
    halfWidth: 42,
  }

  const getPanelWidth = () =>
    options.panel.getBoundingClientRect().width || window.innerWidth
  const getPanelHeight = () =>
    options.panel.getBoundingClientRect().height || window.innerHeight

  const clampOverlayPoint = (
    point: TouchOverlayPoint,
    overlaySize: OverlaySize,
  ): TouchOverlayPoint => ({
    x: clamp(
      point.x,
      overlaySize.halfWidth + screenEdgePaddingPx,
      getPanelWidth() - overlaySize.halfWidth - screenEdgePaddingPx,
    ),
    y: clamp(
      point.y,
      overlaySize.halfHeight + screenEdgePaddingPx,
      getPanelHeight() - overlaySize.halfHeight - screenEdgePaddingPx,
    ),
  })

  const refreshControlSize = () => {
    thrustControlSize = measureOverlaySize(thrustControl, thrustControlSize)
  }

  const clearLabelHideTimer = () => {
    if (thrustLabelHideTimer !== null) {
      window.clearTimeout(thrustLabelHideTimer)
      thrustLabelHideTimer = null
    }
  }

  const clearPendingFadeTimer = () => {
    if (pendingFadeTimer !== null) {
      window.clearTimeout(pendingFadeTimer)
      pendingFadeTimer = null
    }
  }

  const showLabel = () => {
    clearLabelHideTimer()
    isThrustLabelVisible = true
    thrustControl.classList.remove('touch-thrust-control-label-hidden')
  }

  const scheduleLatchedLabelHide = () => {
    clearLabelHideTimer()
    thrustLabelHideTimer = window.setTimeout(() => {
      isThrustLabelVisible = false
      thrustControl.classList.add('touch-thrust-control-label-hidden')
      thrustLabelHideTimer = null
    }, thrustLatchedLabelHideDelayMs)
  }

  const syncControlUi = () => {
    const snapshot = interactionModel.getSnapshot()
    const uiState: TouchThrustControlUiState = {
      engaged: snapshot.thrust.engaged,
      interactive: isAvailable && (isDocked || snapshot.thrust.visible),
      visible:
        isAvailable &&
        (isDocked || snapshot.thrust.visible || isPendingFadeReady),
    }
    thrustControl.hidden = !isAvailable
    thrustControl.classList.toggle(
      'touch-thrust-control-visible',
      uiState.visible,
    )
    thrustControl.classList.toggle(
      'touch-thrust-control-on',
      snapshot.thrust.engaged,
    )
    thrustControl.classList.toggle(
      'touch-thrust-control-pending',
      isPendingVisible,
    )
    if (thrustControlLabel) {
      thrustControlLabel.textContent = snapshot.thrust.engaged
        ? 'Thrust On'
        : 'Thrust Off'
    }
    thrustControl.classList.toggle(
      'touch-thrust-control-label-hidden',
      !isThrustLabelVisible,
    )
    refreshControlSize()
    const clampedAnchor = clampOverlayPoint(
      snapshot.thrust.anchor,
      thrustControlSize,
    )
    if (isDocked) {
      thrustControl.style.removeProperty('left')
      thrustControl.style.removeProperty('top')
    } else {
      thrustControl.style.left = `${clampedAnchor.x}px`
      thrustControl.style.top = `${clampedAnchor.y}px`
    }
    thrustControl.style.setProperty(
      '--thrust-thumb-offset',
      `${snapshot.thrust.offset}px`,
    )
    thrustControl.style.setProperty(
      '--thrust-control-fade-duration',
      `${isPendingVisible ? pendingFadeInMs : 140}ms`,
    )
    thrustControl.style.setProperty(
      '--thrust-control-scale-duration',
      `${isPendingVisible ? pendingFadeInMs : 160}ms`,
    )
    options.onUiStateChange(uiState)
  }

  const applySnapshot = (snapshot: TouchInteractionSnapshot) => {
    options.setMainThrust(snapshot.thrust.engaged)
    syncControlUi()
    if (snapshot.shouldPulseHaptics) {
      options.vibrate()
    }
  }

  const isTouchOnThumb = (touch: Pick<Touch, 'clientX' | 'clientY'>) => {
    if (!thrustControlThumb) {
      return false
    }

    const thumbRect = thrustControlThumb.getBoundingClientRect()
    return (
      touch.clientX >= thumbRect.left &&
      touch.clientX <= thumbRect.right &&
      touch.clientY >= thumbRect.top &&
      touch.clientY <= thumbRect.bottom
    )
  }

  const clearPendingHoldTimer = (session: ThrustGestureSession) => {
    if (session.kind === 'right-zone-pending') {
      window.clearTimeout(session.holdTimer)
    }
  }

  const isInBottomRightQuarter = (touch: Pick<Touch, 'clientX' | 'clientY'>) =>
    touch.clientX >= getPanelWidth() / 2 &&
    touch.clientY >= getPanelHeight() / 2

  const clearGesture = (
    session: ThrustGestureSession,
  ): ThrustGestureSession => {
    if (
      session.kind !== 'right-zone-pending' &&
      session.kind !== 'right-zone-active'
    ) {
      return session
    }

    clearPendingFadeTimer()
    isPendingFadeReady = false
    isPendingVisible = false
    clearPendingHoldTimer(session)
    const snapshot = interactionModel.hideThrust()
    applySnapshot(snapshot)
    if (snapshot.thrust.visible && snapshot.thrust.latched) {
      scheduleLatchedLabelHide()
    }
    return { kind: 'none' }
  }

  const promotePendingSession = (
    session: ThrustGestureSession,
  ): ThrustGestureSession => {
    if (session.kind !== 'right-zone-pending') {
      return session
    }

    clearPendingFadeTimer()
    isPendingFadeReady = false
    isPendingVisible = false
    showLabel()
    const snapshot = interactionModel.getSnapshot()
    const nextSession: ThrustGestureSession = {
      kind: 'right-zone-active',
      startLatched: snapshot.thrust.latched,
      startX: session.startX,
      startY: session.startY,
      touchId: session.touchId,
    }
    applySnapshot(interactionModel.showThrust(snapshot.thrust.anchor))
    return nextSession
  }

  const beginGesture = (
    touch: Touch,
    session: ThrustGestureSession,
  ): ThrustGestureSession => {
    if (!isAvailable) {
      return session
    }

    const thrustSnapshot = interactionModel.getSnapshot().thrust
    const panelWidth = getPanelWidth()
    const panelHeight = getPanelHeight()
    const minX = Math.max(
      panelWidth / 2 + screenEdgePaddingPx,
      screenEdgePaddingPx,
    )
    const maxX = panelWidth - screenEdgePaddingPx
    const minY = Math.max(
      panelHeight / 2 + screenEdgePaddingPx,
      screenEdgePaddingPx + thrustControlSpawnOffsetPx,
    )
    const maxY = panelHeight - screenEdgePaddingPx - thrustControlSpawnOffsetPx
    const touchPoint = { x: touch.clientX, y: touch.clientY }
    const canReuseLatchedControl =
      thrustSnapshot.visible &&
      thrustSnapshot.latched &&
      Math.hypot(
        touchPoint.x - thrustSnapshot.anchor.x,
        touchPoint.y - thrustSnapshot.anchor.y,
      ) <= thrustControlHitRadiusPx

    if (thrustSnapshot.visible && !canReuseLatchedControl) {
      return session
    }

    if (!canReuseLatchedControl && !isInBottomRightQuarter(touch)) {
      return session
    }

    if (canReuseLatchedControl) {
      isPendingVisible = false
      if (isTouchOnThumb(touch)) {
        showLabel()
      }
      applySnapshot(interactionModel.reuseLatchedThrust(thrustSnapshot.latched))
      return {
        kind: 'right-zone-active',
        startLatched: thrustSnapshot.latched,
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
    }

    showLabel()
    const anchor = {
      x: clamp(touch.clientX, minX, maxX),
      y: clamp(touch.clientY - thrustControlSpawnOffsetPx, minY, maxY),
    }
    clearPendingFadeTimer()
    isPendingVisible = true
    isPendingFadeReady = false
    applySnapshot(interactionModel.setPendingThrustAnchor(anchor))
    pendingFadeTimer = window.setTimeout(() => {
      isPendingFadeReady = true
      pendingFadeTimer = null
      syncControlUi()
    }, pendingFadeInDelayMs)

    const pendingSession: PendingThrustSession = {
      kind: 'right-zone-pending',
      holdTimer: 0,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }
    pendingSession.holdTimer = window.setTimeout(() => {
      if (
        currentSession.kind !== 'right-zone-pending' ||
        currentSession.touchId !== touch.identifier
      ) {
        return
      }
      currentSession = promotePendingSession(currentSession)
      options.onSessionChange(currentSession)
    }, thrustAppearHoldMs)

    return pendingSession
  }

  const beginDockedGesture = (
    touch: Touch,
    session: ThrustGestureSession,
  ): ThrustGestureSession => {
    if (!isAvailable || !isDocked) {
      return session
    }

    const thrustSnapshot = interactionModel.getSnapshot().thrust
    if (thrustSnapshot.visible && !thrustSnapshot.latched) {
      return session
    }

    clearPendingFadeTimer()
    isPendingFadeReady = false
    isPendingVisible = false
    showLabel()
    applySnapshot(interactionModel.reuseLatchedThrust(thrustSnapshot.latched))
    return {
      kind: 'right-zone-active',
      startLatched: thrustSnapshot.latched,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }
  }

  const updateGesture = (
    touch: Touch,
    session: ThrustGestureSession,
  ): ThrustGestureSession => {
    if (session.kind === 'right-zone-pending') {
      if (
        Math.hypot(
          touch.clientX - session.startX,
          touch.clientY - session.startY,
        ) > options.tapMoveTolerancePx
      ) {
        return clearGesture(session)
      }
      return session
    }

    if (
      session.kind === 'right-zone-active' &&
      session.touchId === touch.identifier
    ) {
      applySnapshot(
        interactionModel.updateThrustDrag({
          currentY: touch.clientY,
          startLatched: session.startLatched,
          startY: session.startY,
        }),
      )
    }

    return session
  }

  let currentSession: ThrustGestureSession = { kind: 'none' }

  const setSession = (session: ThrustGestureSession) => {
    currentSession = session
    options.onSessionChange(session)
  }

  const syncUi = () => {
    refreshControlSize()
    syncControlUi()
  }

  syncUi()

  return {
    beginGesture(touch: Touch, session: ThrustGestureSession) {
      const nextSession = beginGesture(touch, session)
      setSession(nextSession)
      return nextSession
    },
    beginDockedGesture(touch: Touch, session: ThrustGestureSession) {
      const nextSession = beginDockedGesture(touch, session)
      setSession(nextSession)
      return nextSession
    },
    clearGesture(session: ThrustGestureSession) {
      const nextSession = clearGesture(session)
      setSession(nextSession)
      return nextSession
    },
    ownsTouch(session: ThrustGestureSession, touchId: number) {
      return (
        (session.kind === 'right-zone-pending' ||
          session.kind === 'right-zone-active') &&
        session.touchId === touchId
      )
    },
    setSession,
    setAvailable(available: boolean) {
      isAvailable = available
      if (!available) {
        clearGesture(currentSession)
      }
      syncUi()
    },
    syncUi,
    updateGesture(touch: Touch, session: ThrustGestureSession) {
      const nextSession = updateGesture(touch, session)
      setSession(nextSession)
      return nextSession
    },
  }
}

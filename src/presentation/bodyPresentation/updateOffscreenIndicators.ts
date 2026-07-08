import { renderPosition } from '../../render/sceneUpdates'
import type { GameSceneRefs } from '../../scene/createGameScene'
import { RENDER_SCALE } from '../../simulation/constants'
import type { Body } from '../../simulation/types'
import type { Vec2 } from '../../simulation/vector'
import { formatDistance } from '../../ui/formatters'
import {
  type OverlayUiRefs,
  spacecraftOffscreenIndicatorId,
} from '../../ui/overlayUI/createOverlayUi'
import { createMeasuredFunction } from '../../utils/measuredFunction'
import {
  type OffscreenIndicatorArrowSide,
  type OffscreenIndicatorEdge,
  type OffscreenIndicatorPlacement,
  type OffscreenIndicatorRect,
  resolveOffscreenIndicatorArrowSide,
  resolveOffscreenIndicatorPlacement,
  resolveOffscreenIndicatorVector,
} from '../offscreenIndicatorPlacement'

declare global {
  interface Window {
    __measureOffscreenIndicatorRects?: boolean
  }
}

type MeasureElementRect = (element: HTMLElement, label: string) => DOMRect

const offscreenIndicatorRectMeasurements = createMeasuredFunction({
  enabled: () => !!window.__measureOffscreenIndicatorRects,
  reportLabel: 'Offscreen indicator getBoundingClientRect() timings',
})

const measureOffscreenIndicatorRect: MeasureElementRect = (element, label) =>
  offscreenIndicatorRectMeasurements.measure(label, () =>
    element.getBoundingClientRect(),
  )

const offscreenIndicatorBlockerSelectors = [
  '.top-menu-button',
  '.top-menu-dropdown',
  '.telemetry-strip',
  '.bottom-pill-area > *',
  '.in-game-controls-menu-button',
  '.in-game-controls-menu-popover',
  '.debug-panel',
  '.fps-indicator',
  '.scenario-prompt',
  '.app-dialog-panel',
  '.crash-menu-panel',
  '.touch-edge-reveal-tab',
  '.touch-edge-reveal-control-open .touch-edge-reveal-content',
  '.touch-controls-tutorial-hint',
]

const getVisibleOffscreenIndicatorBlockerRects = (
  measureRect: MeasureElementRect,
): OffscreenIndicatorRect[] => {
  const elements = new Set<HTMLElement>()

  for (const selector of offscreenIndicatorBlockerSelectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      elements.add(element)
    }
  }

  return Array.from(elements).flatMap((element) => {
    const styles = window.getComputedStyle(element)
    const opacity = Number.parseFloat(styles.opacity)

    if (
      element.hidden ||
      styles.display === 'none' ||
      styles.visibility === 'hidden' ||
      opacity === 0 ||
      element.getClientRects().length === 0
    ) {
      return []
    }

    const rect = measureRect(element, `blocker:${element.className}`)
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.right <= 0 ||
      rect.left >= window.innerWidth ||
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight
    ) {
      return []
    }

    return [
      {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      },
    ]
  })
}

const isOffscreenIndicatorEdge = (
  value: string | undefined,
): value is OffscreenIndicatorEdge =>
  value === 'bottom' || value === 'left' || value === 'right' || value === 'top'

const isOffscreenIndicatorArrowSide = (
  value: string | undefined,
): value is OffscreenIndicatorArrowSide => value === 'left' || value === 'right'

const getPreviousOffscreenIndicatorPlacement = (
  indicator: HTMLElement,
): OffscreenIndicatorPlacement | undefined => {
  const x = Number.parseFloat(indicator.style.left)
  const y = Number.parseFloat(indicator.style.top)

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !isOffscreenIndicatorEdge(indicator.dataset.offscreenIndicatorEdge)
  ) {
    return undefined
  }

  return {
    edge: indicator.dataset.offscreenIndicatorEdge,
    x,
    y,
  }
}

const getPreviousOffscreenIndicatorArrowSide = (
  indicator: HTMLElement,
): OffscreenIndicatorArrowSide | undefined =>
  isOffscreenIndicatorArrowSide(indicator.dataset.offscreenIndicatorArrowSide)
    ? indicator.dataset.offscreenIndicatorArrowSide
    : undefined

type OffscreenIndicatorTarget = {
  id: string
  lift: number
  name: string
  position: Vec2
}

export const updateOffscreenIndicators = (options: {
  bodies: Body[]
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  spacecraftPosition: Vec2
  viewportSize: number
}) => {
  const edgePadding = 12
  const blockerPadding = 6
  const screenCenterX = window.innerWidth * 0.5
  const mobileViewport = window.matchMedia(
    '(hover: none), (pointer: coarse)',
  ).matches
  const portraitViewport = window.innerWidth < window.innerHeight

  const telemetryStrip = document.querySelector<HTMLElement>('.telemetry-strip')
  const telemetryStripBottom = telemetryStrip
    ? measureOffscreenIndicatorRect(telemetryStrip, 'telemetry-strip').bottom
    : 0
  const reservedTop = telemetryStripBottom + 12
  const bottomPill = Array.from(
    document.querySelectorAll<HTMLElement>('.bottom-pill-area > *'),
  ).find((element) => {
    const styles = window.getComputedStyle(element)

    return (
      styles.display !== 'none' &&
      styles.visibility !== 'hidden' &&
      element.getClientRects().length > 0
    )
  })
  const bottomPillTop =
    (bottomPill
      ? measureOffscreenIndicatorRect(bottomPill, 'bottom-pill').top
      : undefined) ?? window.innerHeight
  const reservedBottom =
    bottomPillTop >= window.innerHeight * 0.5 &&
    bottomPillTop < window.innerHeight
      ? window.innerHeight - bottomPillTop + 12
      : edgePadding
  const blockerRects = getVisibleOffscreenIndicatorBlockerRects(
    measureOffscreenIndicatorRect,
  )
  const metersPerPixel =
    options.viewportSize / Math.max(window.innerHeight, 1) / RENDER_SCALE
  const targets: OffscreenIndicatorTarget[] = [
    ...options.bodies.map((body) => ({
      id: body.id,
      lift: body.radius * RENDER_SCALE,
      name: body.name,
      position: body.position,
    })),
    {
      id: spacecraftOffscreenIndicatorId,
      lift: 1.2,
      name: 'Spacecraft',
      position: options.spacecraftPosition,
    },
  ]
  const activeTargetIds = new Set(targets.map((target) => target.id))

  const visibleIndicators: Array<{
    distance: number
    indicator: HTMLElement
    priority: number
    rect: DOMRect
  }> = []

  for (const target of targets) {
    const indicator = options.overlayUi.offscreenIndicators.get(target.id)
    if (!indicator) {
      continue
    }

    const position = renderPosition(
      target.position.x,
      target.position.y,
      target.lift,
    )
    position.project(options.gameScene.camera)

    const isVisible =
      position.x >= -1 &&
      position.x <= 1 &&
      position.y >= -1 &&
      position.y <= 1 &&
      position.z > -1 &&
      position.z < 1

    if (isVisible) {
      indicator.style.display = 'none'
      delete indicator.dataset.offscreenIndicatorEdge
      delete indicator.dataset.offscreenIndicatorArrowSide
      continue
    }

    const projectedX = (position.x * 0.5 + 0.5) * window.innerWidth
    const projectedY = (-position.y * 0.5 + 0.5) * window.innerHeight
    const pointer = indicator.querySelector<HTMLElement>('.pointer')
    const label = indicator.querySelector<HTMLElement>('.label')
    const previousPlacement = getPreviousOffscreenIndicatorPlacement(indicator)
    const previousArrowSide = getPreviousOffscreenIndicatorArrowSide(indicator)
    const provisionalPlacement = previousPlacement ?? {
      edge: 'right' as const,
      x: screenCenterX,
      y: window.innerHeight * 0.5,
    }
    const provisionalVector = resolveOffscreenIndicatorVector({
      placement: provisionalPlacement,
      projectedX,
      projectedY,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    })

    if (label) {
      label.textContent = `${target.name} ${formatDistance(
        provisionalVector.distancePixels * metersPerPixel,
      )}`
    }
    indicator.style.display = 'flex'
    indicator.style.visibility = 'hidden'
    indicator.classList.remove('offscreen-indicator-mobile-stack')
    const resolvePlacement = (bounds: { height: number; width: number }) =>
      resolveOffscreenIndicatorPlacement({
        blockerPadding,
        blockerRects,
        edgePadding,
        indicatorHeight: bounds.height,
        indicatorWidth: bounds.width,
        previousPlacement,
        projectedY,
        projectedX,
        reservedBottom,
        reservedTop,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      })
    const shouldStackPlacement = (placement: OffscreenIndicatorPlacement) =>
      mobileViewport &&
      portraitViewport &&
      placement.y > window.innerHeight * 0.2 &&
      placement.y < window.innerHeight * 0.8
    const bounds = measureOffscreenIndicatorRect(
      indicator,
      `${target.id}:initial`,
    )
    const initialPlacement = resolvePlacement(bounds)
    let shouldStackIndicator = shouldStackPlacement(initialPlacement)
    indicator.classList.toggle(
      'offscreen-indicator-mobile-stack',
      shouldStackIndicator,
    )
    const stackedBounds = measureOffscreenIndicatorRect(
      indicator,
      `${target.id}:stacked`,
    )
    let placementBounds = stackedBounds
    let placement = resolvePlacement(stackedBounds)
    const correctedShouldStackIndicator = shouldStackPlacement(placement)

    if (correctedShouldStackIndicator !== shouldStackIndicator) {
      shouldStackIndicator = correctedShouldStackIndicator
      indicator.classList.toggle(
        'offscreen-indicator-mobile-stack',
        shouldStackIndicator,
      )
      placementBounds = measureOffscreenIndicatorRect(
        indicator,
        `${target.id}:corrected`,
      )
      placement = resolvePlacement(placementBounds)
    }

    const arrowSide = resolveOffscreenIndicatorArrowSide({
      indicatorWidth: placementBounds.width,
      placement,
      previousSide: previousArrowSide,
      projectedX,
    })

    indicator.classList.toggle(
      'offscreen-indicator-arrow-left',
      arrowSide === 'left',
    )
    indicator.classList.toggle(
      'offscreen-indicator-arrow-right',
      arrowSide === 'right',
    )

    indicator.style.left = `${placement.x}px`
    indicator.style.top = `${placement.y}px`
    indicator.dataset.offscreenIndicatorEdge = placement.edge
    indicator.dataset.offscreenIndicatorArrowSide = arrowSide

    const vector = resolveOffscreenIndicatorVector({
      placement,
      projectedX,
      projectedY,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    })
    const distance = vector.distancePixels * metersPerPixel

    if (pointer) {
      pointer.style.transform = `rotate(${vector.direction + Math.PI / 2}rad)`
    }
    if (label) {
      label.textContent = `${target.name} ${formatDistance(distance)}`
    }

    indicator.style.visibility = 'visible'
    visibleIndicators.push({
      distance,
      indicator,
      priority: target.id === spacecraftOffscreenIndicatorId ? 0 : 1,
      rect: measureOffscreenIndicatorRect(indicator, `${target.id}:final`),
    })
  }

  const overlapPadding = 6
  const keptRects: DOMRect[] = []
  const overlaps = (a: DOMRect, b: DOMRect) =>
    a.left < b.right + overlapPadding &&
    a.right > b.left - overlapPadding &&
    a.top < b.bottom + overlapPadding &&
    a.bottom > b.top - overlapPadding

  visibleIndicators
    .sort(
      (left, right) =>
        left.priority - right.priority || left.distance - right.distance,
    )
    .forEach(({ indicator, rect }) => {
      const collides = keptRects.some((keptRect) => overlaps(rect, keptRect))
      indicator.style.display = collides ? 'none' : 'flex'
      if (!collides) {
        keptRects.push(rect)
      }
    })

  for (const [
    targetId,
    indicator,
  ] of options.overlayUi.offscreenIndicators.entries()) {
    if (!activeTargetIds.has(targetId)) {
      indicator.style.display = 'none'
      delete indicator.dataset.offscreenIndicatorEdge
      delete indicator.dataset.offscreenIndicatorArrowSide
    }
  }

  offscreenIndicatorRectMeasurements.report()
}

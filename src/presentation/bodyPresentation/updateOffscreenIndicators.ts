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
import { getBodySurfaceDistanceMeters } from '../bodyDistanceContext'
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

type IndicatorBounds = {
  height: number
  width: number
}

type IndicatorPartRefs = {
  label: HTMLElement | null
  pointer: HTMLElement | null
}

const offscreenIndicatorRectMeasurements = createMeasuredFunction({
  enabled: () => !!window.__measureOffscreenIndicatorRects,
  reportLabel: 'Offscreen indicator getBoundingClientRect() timings',
})

const indicatorBoundsCache = new WeakMap<
  HTMLElement,
  Map<string, IndicatorBounds>
>()
const indicatorPartRefs = new WeakMap<HTMLElement, IndicatorPartRefs>()
const maxCachedIndicatorBounds = 24

const measureOffscreenIndicatorRect: MeasureElementRect = (element, label) =>
  offscreenIndicatorRectMeasurements.measure(label, () =>
    element.getBoundingClientRect(),
  )

const createCachedElementRectMeasurer = (): MeasureElementRect => {
  const rects = new WeakMap<HTMLElement, DOMRect>()

  return (element, label) => {
    const cachedRect = rects.get(element)
    if (cachedRect) {
      return cachedRect
    }

    const rect = measureOffscreenIndicatorRect(element, label)
    rects.set(element, rect)
    return rect
  }
}

const getIndicatorPartRefs = (indicator: HTMLElement): IndicatorPartRefs => {
  const cachedRefs = indicatorPartRefs.get(indicator)
  if (cachedRefs) {
    return cachedRefs
  }

  const refs = {
    label: indicator.querySelector<HTMLElement>('.label'),
    pointer: indicator.querySelector<HTMLElement>('.pointer'),
  }
  indicatorPartRefs.set(indicator, refs)
  return refs
}

const getIndicatorBoundsCacheKey = (options: {
  labelText: string
  stacked: boolean
  visualState: string
  viewportHeight: number
  viewportWidth: number
}) =>
  [
    options.stacked ? 'stacked' : 'inline',
    options.visualState,
    options.viewportWidth,
    options.viewportHeight,
    options.labelText,
  ].join('|')

const getCachedIndicatorBounds = (
  indicator: HTMLElement,
  key: string,
): IndicatorBounds | undefined => indicatorBoundsCache.get(indicator)?.get(key)

const setCachedIndicatorBounds = (
  indicator: HTMLElement,
  key: string,
  bounds: IndicatorBounds,
) => {
  let cache = indicatorBoundsCache.get(indicator)
  if (!cache) {
    cache = new Map()
    indicatorBoundsCache.set(indicator, cache)
  }

  if (cache.size >= maxCachedIndicatorBounds) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, bounds)
}

const setLabelText = (label: HTMLElement | null, text: string) => {
  if (label && label.textContent !== text) {
    label.textContent = text
  }
}

const setStyleValue = (
  styles: CSSStyleDeclaration,
  name: 'left' | 'top',
  value: string,
) => {
  if (styles[name] !== value) {
    styles[name] = value
  }
}

const setDatasetValue = (
  dataset: DOMStringMap,
  name: 'offscreenIndicatorArrowSide' | 'offscreenIndicatorEdge',
  value: string,
) => {
  if (dataset[name] !== value) {
    dataset[name] = value
  }
}

const getIndicatorBounds = (options: {
  indicator: HTMLElement
  label: HTMLElement | null
  labelText: string
  measurementLabel: string
  stacked: boolean
  visualState: string
  viewportHeight: number
  viewportWidth: number
}): IndicatorBounds => {
  const cacheKey = getIndicatorBoundsCacheKey({
    labelText: options.labelText,
    stacked: options.stacked,
    visualState: options.visualState,
    viewportHeight: options.viewportHeight,
    viewportWidth: options.viewportWidth,
  })
  const cachedBounds = getCachedIndicatorBounds(options.indicator, cacheKey)
  if (cachedBounds) {
    return cachedBounds
  }

  setLabelText(options.label, options.labelText)
  const rect = measureOffscreenIndicatorRect(
    options.indicator,
    options.measurementLabel,
  )
  const bounds = {
    height: rect.height,
    width: rect.width,
  }
  setCachedIndicatorBounds(options.indicator, cacheKey, bounds)

  return bounds
}

const getPlacedIndicatorRect = (
  placement: OffscreenIndicatorPlacement,
  bounds: IndicatorBounds,
): OffscreenIndicatorRect => {
  const halfWidth = bounds.width * 0.5
  const halfHeight = bounds.height * 0.5

  return {
    bottom: placement.y + halfHeight,
    left: placement.x - halfWidth,
    right: placement.x + halfWidth,
    top: placement.y - halfHeight,
  }
}

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
  '.mobile-command-dock-bar',
  '.mobile-command-dock-panel',
]

const getVisibleOffscreenIndicatorBlockerRects = (
  measureRect: MeasureElementRect,
  viewportHeight: number,
  viewportWidth: number,
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
      opacity === 0
    ) {
      return []
    }

    const rect = measureRect(element, `blocker:${element.className}`)
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.right <= 0 ||
      rect.left >= viewportWidth ||
      rect.bottom <= 0 ||
      rect.top >= viewportHeight
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

type OffscreenIndicatorTarget =
  | {
      body: Body
      id: string
      kind: 'body'
      lift: number
      name: string
      position: Vec2
    }
  | {
      id: string
      kind: 'spacecraft'
      lift: number
      name: 'Spacecraft'
      position: Vec2
    }

export const updateOffscreenIndicators = (options: {
  bodies: Body[]
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  pinnedBodyIds: ReadonlySet<string>
  spacecraftPosition: Vec2
  targetBodyId: string | null
}) => {
  const edgePadding = 12
  const blockerPadding = 6
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const mobileViewport = window.matchMedia(
    '(hover: none), (pointer: coarse)',
  ).matches
  const portraitViewport = viewportWidth < viewportHeight
  const measureCachedElementRect = createCachedElementRectMeasurer()

  const telemetryStrip = document.querySelector<HTMLElement>('.telemetry-strip')
  const telemetryStripBottom = telemetryStrip
    ? measureCachedElementRect(telemetryStrip, 'telemetry-strip').bottom
    : 0
  const reservedTop = telemetryStripBottom + 12
  let bottomPillTop = viewportHeight
  for (const element of document.querySelectorAll<HTMLElement>(
    '.bottom-pill-area > *',
  )) {
    const styles = window.getComputedStyle(element)

    if (styles.display === 'none' || styles.visibility === 'hidden') {
      continue
    }

    const rect = measureCachedElementRect(element, 'bottom-pill')
    if (rect.width > 0 && rect.height > 0) {
      bottomPillTop = rect.top
      break
    }
  }
  const reservedBottom =
    bottomPillTop >= viewportHeight * 0.5 && bottomPillTop < viewportHeight
      ? viewportHeight - bottomPillTop + 12
      : edgePadding
  const blockerRects = getVisibleOffscreenIndicatorBlockerRects(
    measureCachedElementRect,
    viewportHeight,
    viewportWidth,
  )
  const targets: OffscreenIndicatorTarget[] = [
    ...options.bodies.map((body) => ({
      body,
      id: body.id,
      kind: 'body' as const,
      lift: body.radius * RENDER_SCALE,
      name: body.name,
      position: body.position,
    })),
    {
      id: spacecraftOffscreenIndicatorId,
      kind: 'spacecraft',
      lift: 1.2,
      name: 'Spacecraft' as const,
      position: options.spacecraftPosition,
    },
  ]
  const activeTargetIds = new Set(targets.map((target) => target.id))

  const visibleIndicators: Array<{
    distance: number
    indicator: HTMLElement
    priority: number
    rect: OffscreenIndicatorRect
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

    const projectedX = (position.x * 0.5 + 0.5) * viewportWidth
    const projectedY = (-position.y * 0.5 + 0.5) * viewportHeight
    const { label, pointer } = getIndicatorPartRefs(indicator)
    const bodySurfaceDistance =
      target.kind === 'body'
        ? getBodySurfaceDistanceMeters(target.body, options.spacecraftPosition)
        : 0
    const activeTarget =
      target.kind === 'body' && target.id === options.targetBodyId
    const pinnedBody =
      target.kind === 'body' && options.pinnedBodyIds.has(target.id)
    const targetedBody = activeTarget && pinnedBody
    const unlabeledBody = target.kind === 'body' && !pinnedBody
    let visualState = 'spacecraft'
    if (unlabeledBody) {
      visualState = 'unpinned'
    } else if (targetedBody) {
      visualState = 'active-target'
    } else if (pinnedBody) {
      visualState = 'pinned'
    }
    let labelText = 'Spacecraft'
    let accessibleLabel = 'Spacecraft, off screen'
    if (target.kind === 'body') {
      const distanceLabel = formatDistance(bodySurfaceDistance)
      accessibleLabel = unlabeledBody
        ? `${target.name}, off screen`
        : `${target.name}, surface distance ${distanceLabel}`
      labelText = unlabeledBody ? '' : `${target.name} · ${distanceLabel}`
    }

    indicator.classList.toggle(
      'offscreen-indicator-active-target',
      targetedBody,
    )
    indicator.classList.toggle('offscreen-indicator-pinned', pinnedBody)
    indicator.classList.toggle(
      'offscreen-indicator-unpinned-body',
      unlabeledBody,
    )
    indicator.classList.toggle(
      'offscreen-indicator-spacecraft',
      target.kind === 'spacecraft',
    )
    indicator.classList.toggle('offscreen-indicator-unlabeled', unlabeledBody)
    indicator.setAttribute('aria-label', accessibleLabel)
    indicator.setAttribute('role', 'img')
    const previousPlacement = getPreviousOffscreenIndicatorPlacement(indicator)
    const previousArrowSide = getPreviousOffscreenIndicatorArrowSide(indicator)
    indicator.style.display = 'flex'
    indicator.style.visibility = 'hidden'
    indicator.classList.remove('offscreen-indicator-mobile-stack')
    const resolvePlacement = (bounds: IndicatorBounds) =>
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
        viewportHeight,
        viewportWidth,
      })
    const shouldStackPlacement = (placement: OffscreenIndicatorPlacement) =>
      labelText.length > 0 &&
      mobileViewport &&
      portraitViewport &&
      placement.y > viewportHeight * 0.2 &&
      placement.y < viewportHeight * 0.8
    const unstackedBounds = getIndicatorBounds({
      indicator,
      label,
      labelText,
      measurementLabel: `${target.id}:initial`,
      stacked: false,
      visualState,
      viewportHeight,
      viewportWidth,
    })
    const unstackedPlacement = resolvePlacement(unstackedBounds)
    const shouldStackIndicator = shouldStackPlacement(unstackedPlacement)
    let placementBounds = unstackedBounds
    let placement = unstackedPlacement

    if (shouldStackIndicator) {
      indicator.classList.add('offscreen-indicator-mobile-stack')
      const stackedBounds = getIndicatorBounds({
        indicator,
        label,
        labelText,
        measurementLabel: `${target.id}:stacked`,
        stacked: true,
        visualState,
        viewportHeight,
        viewportWidth,
      })
      const stackedPlacement = resolvePlacement(stackedBounds)

      if (shouldStackPlacement(stackedPlacement)) {
        placementBounds = stackedBounds
        placement = stackedPlacement
      } else {
        indicator.classList.remove('offscreen-indicator-mobile-stack')
      }
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

    setStyleValue(indicator.style, 'left', `${placement.x}px`)
    setStyleValue(indicator.style, 'top', `${placement.y}px`)
    setDatasetValue(indicator.dataset, 'offscreenIndicatorEdge', placement.edge)
    setDatasetValue(indicator.dataset, 'offscreenIndicatorArrowSide', arrowSide)

    const vector = resolveOffscreenIndicatorVector({
      placement,
      projectedX,
      projectedY,
      viewportHeight,
      viewportWidth,
    })
    if (pointer) {
      pointer.style.transform = `rotate(${vector.direction + Math.PI / 2}rad)`
    }
    setLabelText(label, labelText)

    indicator.style.visibility = 'visible'
    let priority = 3
    if (target.kind === 'spacecraft') {
      priority = 0
    } else if (targetedBody) {
      priority = 1
    } else if (pinnedBody) {
      priority = 2
    }

    visibleIndicators.push({
      distance: bodySurfaceDistance,
      indicator,
      priority,
      rect: getPlacedIndicatorRect(placement, placementBounds),
    })
  }

  const overlapPadding = 6
  const keptRects: OffscreenIndicatorRect[] = []
  const overlaps = (a: OffscreenIndicatorRect, b: OffscreenIndicatorRect) =>
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

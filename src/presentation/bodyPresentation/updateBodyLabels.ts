import * as THREE from 'three'
import { renderPosition } from '../../render/sceneUpdates'
import type { GameSceneRefs } from '../../scene/createGameScene'
import { RENDER_SCALE } from '../../simulation/constants'
import type { Body } from '../../simulation/types'
import type { OverlayUiRefs } from '../../ui/overlayUI/createOverlayUi'
import { createMeasuredFunction } from '../../utils/measuredFunction'
import type { BodyDistanceContext } from '../bodyDistanceContext'

declare global {
  interface Window {
    __measureBodyLabelRects?: boolean
  }
}

type BodyLabelBounds = {
  height: number
  width: number
}

type BodyLabelState = {
  accessibleLabel: string
  hasDistanceContext: boolean
  text: string
  wrap: boolean
}

const bodyLabelRectMeasurements = createMeasuredFunction({
  enabled: () => !!window.__measureBodyLabelRects,
  reportLabel: 'Body label getBoundingClientRect() timings',
})

const bodyLabelBoundsCache = new WeakMap<
  HTMLElement,
  Map<string, BodyLabelBounds>
>()
const maxCachedBodyLabelBounds = 32

const setTextContent = (element: HTMLElement, text: string) => {
  if (element.textContent !== text) {
    element.textContent = text
  }
}

const setAttributeValue = (
  element: HTMLElement,
  name: string,
  value: string,
) => {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value)
  }
}

const setClassEnabled = (
  element: HTMLElement,
  className: string,
  enabled: boolean,
) => {
  if (element.classList.contains(className) !== enabled) {
    element.classList.toggle(className, enabled)
  }
}

const setDisplay = (element: HTMLElement, display: string) => {
  if (element.style.display !== display) {
    element.style.display = display
  }
}

const setVisibility = (element: HTMLElement, visibility: string) => {
  if (element.style.visibility !== visibility) {
    element.style.visibility = visibility
  }
}

const setFixedOrigin = (element: HTMLElement) => {
  if (element.style.left !== '' && element.style.left !== '0px') {
    element.style.left = '0px'
  }
  if (element.style.top !== '' && element.style.top !== '0px') {
    element.style.top = '0px'
  }
}

const setTransform = (element: HTMLElement, transform: string) => {
  if (element.style.transform !== transform) {
    element.style.transform = transform
  }
}

const applyBodyLabelState = (label: HTMLElement, state: BodyLabelState) => {
  setTextContent(label, state.text)

  if (label.title !== state.accessibleLabel) {
    label.title = state.accessibleLabel
  }

  setAttributeValue(label, 'aria-label', state.accessibleLabel)
  setClassEnabled(
    label,
    'body-label-distance-context',
    state.hasDistanceContext,
  )
  setClassEnabled(label, 'body-label-mobile-wrap', state.wrap)
  setFixedOrigin(label)
}

const getBodyLabelBoundsTextKey = (options: {
  hasDistanceContext: boolean
  text: string
}) =>
  options.hasDistanceContext
    ? options.text.replaceAll(/\d/g, '#')
    : options.text

const getBodyLabelBoundsCacheKey = (options: {
  hasDistanceContext: boolean
  text: string
  viewportHeight: number
  viewportWidth: number
  wrap: boolean
}) =>
  [
    options.viewportWidth,
    options.viewportHeight,
    options.hasDistanceContext ? 'distance' : 'name',
    options.wrap ? 'wrap' : 'nowrap',
    getBodyLabelBoundsTextKey(options),
  ].join('|')

const getCachedBodyLabelBounds = (
  label: HTMLElement,
  key: string,
): BodyLabelBounds | undefined => bodyLabelBoundsCache.get(label)?.get(key)

const setCachedBodyLabelBounds = (
  label: HTMLElement,
  key: string,
  bounds: BodyLabelBounds,
) => {
  let cache = bodyLabelBoundsCache.get(label)
  if (!cache) {
    cache = new Map()
    bodyLabelBoundsCache.set(label, cache)
  }

  if (cache.size >= maxCachedBodyLabelBounds) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, bounds)
}

const getBodyLabelBounds = (options: {
  cacheKey: string
  label: HTMLElement
  measurementLabel: string
}): BodyLabelBounds => {
  const cachedBounds = getCachedBodyLabelBounds(options.label, options.cacheKey)
  if (cachedBounds) {
    return cachedBounds
  }

  setDisplay(options.label, 'block')
  setVisibility(options.label, 'hidden')

  const rect = bodyLabelRectMeasurements.measure(options.measurementLabel, () =>
    options.label.getBoundingClientRect(),
  )
  const bounds = {
    height: rect.height,
    width: rect.width,
  }
  setCachedBodyLabelBounds(options.label, options.cacheKey, bounds)

  return bounds
}

export const updateBodyLabels = (options: {
  bodies: Body[]
  distanceContext: BodyDistanceContext | null
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  viewportSize: number
}) => {
  const labelRadiusThreshold = 24
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const pixelsPerRenderUnit = viewportHeight / options.viewportSize
  const mobileViewport = window.matchMedia(
    '(hover: none), (pointer: coarse)',
  ).matches
  const activeBodyIds = new Set(options.bodies.map((body) => body.id))
  let reservedTop: number | undefined

  const getReservedTop = () => {
    if (reservedTop !== undefined) {
      return reservedTop
    }

    const telemetryStrip =
      document.querySelector<HTMLElement>('.telemetry-strip')
    reservedTop = telemetryStrip
      ? bodyLabelRectMeasurements.measure('telemetry-strip', () =>
          telemetryStrip.getBoundingClientRect(),
        ).bottom + 12
      : 8

    return reservedTop
  }

  for (const body of options.bodies) {
    const label = options.overlayUi.bodyLabels.get(body.id)
    if (!label) {
      continue
    }

    const apparentRadius = body.radius * RENDER_SCALE * pixelsPerRenderUnit
    const position = renderPosition(
      body.position.x,
      body.position.y,
      body.radius * RENDER_SCALE,
    )
    position.project(options.gameScene.camera)
    const isVisible =
      position.x >= -1 &&
      position.x <= 1 &&
      position.y >= -1 &&
      position.y <= 1 &&
      position.z > -1 &&
      position.z < 1

    const distanceContext =
      options.distanceContext?.bodyId === body.id
        ? options.distanceContext
        : null

    if (
      !isVisible ||
      (apparentRadius > labelRadiusThreshold && !distanceContext)
    ) {
      setDisplay(label, 'none')
      continue
    }

    const screenX = (position.x * 0.5 + 0.5) * viewportWidth
    const screenY = (-position.y * 0.5 + 0.5) * viewportHeight
    const shouldWrapLabel =
      mobileViewport &&
      screenX > viewportWidth * 0.22 &&
      screenX < viewportWidth * 0.78
    const labelState = {
      accessibleLabel: distanceContext
        ? distanceContext.accessibleLabel
        : body.name,
      hasDistanceContext: !!distanceContext,
      text: distanceContext ? distanceContext.tooltipLabel : body.name,
      wrap: shouldWrapLabel,
    }
    const cacheKey = getBodyLabelBoundsCacheKey({
      hasDistanceContext: labelState.hasDistanceContext,
      text: labelState.text,
      viewportHeight,
      viewportWidth,
      wrap: labelState.wrap,
    })

    applyBodyLabelState(label, labelState)
    const bounds = getBodyLabelBounds({
      cacheKey,
      label,
      measurementLabel: body.id,
    })
    const labelX = THREE.MathUtils.clamp(
      screenX + 10,
      8,
      viewportWidth - bounds.width - 8,
    )
    const labelY = THREE.MathUtils.clamp(
      screenY,
      getReservedTop() + bounds.height * 0.5,
      viewportHeight - bounds.height * 0.5 - 8,
    )

    setDisplay(label, 'block')
    setTransform(
      label,
      `translate3d(${labelX}px, ${labelY}px, 0) translateY(-50%)`,
    )
    setVisibility(label, 'visible')
  }

  for (const [bodyId, label] of options.overlayUi.bodyLabels.entries()) {
    if (!activeBodyIds.has(bodyId)) {
      setDisplay(label, 'none')
    }
  }

  bodyLabelRectMeasurements.report()
}

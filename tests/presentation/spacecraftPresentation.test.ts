import { afterEach, describe, expect, it } from 'vitest'

import { createSpacecraftPresentation } from '@/presentation/spacecraftPresentation'
import { updateCameraView } from '@/render/sceneUpdates'
import { createGameScene } from '@/scene/createGameScene'
import type { Body, Spacecraft } from '@/simulation/types'
import type { OverlayUiRefs } from '@/ui/overlayUI/createOverlayUi'

const createTestGameScene = () =>
  createGameScene([], {
    dashPixels: 12,
    endMarkerMinScreenRadius: 5.5,
    endMarkerRadius: 0.17,
    gapPixels: 8,
    replaceLineGeometryOnUpdate: true,
  })

const globals = globalThis as unknown as {
  window?: { innerHeight: number; innerWidth: number }
}
const originalWindow = globals.window

const setWindowSize = (innerWidth: number, innerHeight: number) => {
  globals.window = { innerHeight, innerWidth }
}

const createStyleStub = () => ({
  display: '',
  left: '',
  setProperty(name: string, value: string) {
    Reflect.set(this, name, value)
  },
  top: '',
  transform: '',
})

const createElementStub = () => {
  const attributes = new Map<string, string>()
  return {
    getAttribute(name: string) {
      return attributes.get(name) ?? null
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    style: createStyleStub(),
  }
}

const createOverlayUiStub = () => {
  const headingTargetLine = createElementStub()
  const headingTargetOverlay = createElementStub()
  const headingTargetTurnSlice = createElementStub()
  const spacecraftCallout = createElementStub()
  const refs = {
    headingTargetDot: createElementStub(),
    headingTargetLine,
    headingTargetOverlay,
    headingTargetTurnSlice,
    spacecraftCallout,
    spacecraftCalloutLabel: null,
    spacecraftIconThrust: createElementStub(),
  } as unknown as OverlayUiRefs

  return {
    headingTargetLine,
    headingTargetOverlay,
    headingTargetTurnSlice,
    spacecraftCallout,
    refs,
  }
}

const createBody = (): Body => ({
  color: '#ffffff',
  id: 'target',
  mass: 1,
  name: 'Target',
  position: { x: 0, y: 0 },
  radius: 1,
  velocity: { x: 0, y: 0 },
})

const createSpacecraft = (
  position: Spacecraft['position'],
  heading = 0,
): Spacecraft => ({
  dryMass: 1,
  fuel: 1,
  fuelCapacity: 1,
  fuelMass: 1,
  fuelUsed: 0,
  heading,
  position,
  velocity: { x: 0, y: 0 },
})

const parsePathPoints = (path: string) => {
  const values = [...path.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map(
    (match) => Number(match[0]),
  )
  const points: { x: number; y: number }[] = []
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] })
  }
  return points
}

const getDistance = (
  point: { x: number; y: number },
  center: { x: number; y: number },
) => Math.hypot(point.x - center.x, point.y - center.y)

describe('createSpacecraftPresentation', () => {
  afterEach(() => {
    if (originalWindow) {
      globals.window = originalWindow
    } else {
      Reflect.deleteProperty(globals, 'window')
    }
  })

  it('projects the heading turn slice onto the flight plane', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const overlayUi = createOverlayUiStub()
    const trailTarget = createBody()
    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      overlayUi: overlayUi.refs,
      pointerCameraInput: { pointerScreenPosition: { x: 0, y: 0 } },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 0, y: 0 }),
      spacecraftLabelIntroUntil: 0,
      targetHeading: Math.PI / 2,
      targetHeadingScreenPosition: null,
      targetHeadingWorldPosition: { x: 0, y: 1_000_000 },
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 480,
    })

    expect(gameScene.debugGrid.visible).toBe(false)
    expect(overlayUi.headingTargetOverlay.style.display).toBe('block')
    const path = overlayUi.headingTargetTurnSlice.getAttribute('d') ?? ''
    expect(path).toMatch(/^M .* Z$/)

    const center = {
      x: Number(overlayUi.headingTargetLine.getAttribute('x1')),
      y: Number(overlayUi.headingTargetLine.getAttribute('y1')),
    }
    const points = parsePathPoints(path)
    const outerPoints = points.slice(0, points.length / 2)
    const outerDistances = outerPoints.map((point) =>
      getDistance(point, center),
    )
    expect(points.length).toBeGreaterThan(12)
    expect(
      Math.max(...outerDistances) - Math.min(...outerDistances),
    ).toBeGreaterThan(2)
  })

  it('places spacecraft indicators close to the trajectory plane', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const overlayUi = createOverlayUiStub()
    const trailTarget = createBody()
    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      overlayUi: overlayUi.refs,
      pointerCameraInput: { pointerScreenPosition: { x: 0, y: 0 } },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 0, y: 0 }),
      spacecraftLabelIntroUntil: 0,
      targetHeading: null,
      targetHeadingScreenPosition: null,
      targetHeadingWorldPosition: null,
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 720,
    })

    expect(gameScene.spacecraftMesh.position.y).toBe(0.32)
    expect(gameScene.spacecraftMarker.position.y).toBe(0.32)
    expect(gameScene.trail.material.depthWrite).toBe(false)
    expect(gameScene.trail.renderOrder).toBeLessThan(
      gameScene.spacecraftMarker.renderOrder,
    )
    expect(
      gameScene.trail.geometry.getAttribute('position').getY(0),
    ).toBeCloseTo(0.24)
    expect(gameScene.engineGlow.visible).toBe(false)
    expect(gameScene.engineGlow.material.depthWrite).toBe(false)
    expect(gameScene.engineGlow.renderOrder).toBeGreaterThan(
      gameScene.spacecraftMarker.renderOrder,
    )
    expect(gameScene.spacecraftMarker.material.depthWrite).toBe(false)

    const projected = gameScene.spacecraftMesh.position
      .clone()
      .project(gameScene.camera)
    expect(overlayUi.spacecraftCallout.style.left).toBe(
      `${(projected.x * 0.5 + 0.5) * 800}px`,
    )
    expect(overlayUi.spacecraftCallout.style.top).toBe(
      `${(-projected.y * 0.5 + 0.5) * 600}px`,
    )
  })
})

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
  opacity: '',
  setProperty(name: string, value: string) {
    Reflect.set(this, name, value)
  },
  top: '',
  transform: '',
})

const createClassListStub = () => {
  const classes = new Set<string>()

  return {
    contains(className: string) {
      return classes.has(className)
    },
    toggle(className: string, force?: boolean) {
      const enabled = force ?? !classes.has(className)
      if (enabled) {
        classes.add(className)
      } else {
        classes.delete(className)
      }
      return enabled
    },
  }
}

const createElementStub = () => {
  const attributes = new Map<string, string>()
  return {
    classList: createClassListStub(),
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
  const rcsActualTurnOverlay = createElementStub()
  const rcsActualTurnSlices = Array.from({ length: 40 }, createElementStub)
  const spacecraftCallout = createElementStub()
  const refs = {
    rcsActualTurnOverlay,
    rcsActualTurnSlices,
    spacecraftCallout,
    spacecraftCalloutLabel: null,
    spacecraftIconThrust: createElementStub(),
  } as unknown as OverlayUiRefs

  return {
    rcsActualTurnOverlay,
    rcsActualTurnSlices,
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

describe('createSpacecraftPresentation', () => {
  afterEach(() => {
    if (originalWindow) {
      globals.window = originalWindow
    } else {
      Reflect.deleteProperty(globals, 'window')
    }
  })

  it('renders RCS actual-turn feedback without target-heading state', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const overlayUi = createOverlayUiStub()
    const trailTarget = createBody()
    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      overlayUi: overlayUi.refs,
      pointerCameraInput: {
        pointerScreenPosition: { x: 0, y: 0 },
        updateEdgeScroll: () => {},
      },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 0, y: 0 }, Math.PI / 3),
      spacecraftLabelIntroUntil: 0,
      rcsActualTurnFeedback: {
        currentHeading: Math.PI / 3,
        opacity: 0.72,
        phase: 'active',
        settleCurrentHeading: Math.PI / 3,
        settleElapsedSeconds: 0,
        settleStartHeading: 0,
        startHeading: 0,
      },
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 480,
    })

    expect(overlayUi.rcsActualTurnOverlay.style.display).toBe('block')
    const visibleSlices = overlayUi.rcsActualTurnSlices.filter(
      (slice) => slice.style.display === 'block',
    )
    expect(visibleSlices.length).toBeGreaterThan(1)
    expect(Number(visibleSlices[0].style.opacity)).toBeLessThan(
      Number(visibleSlices.at(-1)?.style.opacity),
    )
    expect(visibleSlices.at(-1)?.getAttribute('d')).toMatch(/^M .* Z$/)
  })

  it('renders RCS feedback continuously beyond 180 degrees', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const overlayUi = createOverlayUiStub()
    const trailTarget = createBody()
    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      overlayUi: overlayUi.refs,
      pointerCameraInput: {
        pointerScreenPosition: { x: 0, y: 0 },
        updateEdgeScroll: () => {},
      },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 0, y: 0 }, -Math.PI / 2),
      spacecraftLabelIntroUntil: 0,
      rcsActualTurnFeedback: {
        currentHeading: (Math.PI * 3) / 2,
        opacity: 1,
        phase: 'active',
        settleCurrentHeading: (Math.PI * 3) / 2,
        settleElapsedSeconds: 0,
        settleStartHeading: 0,
        startHeading: 0,
      },
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 480,
    })

    const visibleSlices = overlayUi.rcsActualTurnSlices.filter(
      (slice) => slice.style.display === 'block',
    )
    expect(visibleSlices).toHaveLength(30)
    expect(Number(visibleSlices[0].style.opacity)).toBeLessThan(
      Number(visibleSlices.at(-1)?.style.opacity),
    )
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
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      overlayUi: overlayUi.refs,
      pointerCameraInput: {
        pointerScreenPosition: { x: 0, y: 0 },
        updateEdgeScroll: () => {},
      },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 0, y: 0 }),
      spacecraftLabelIntroUntil: 0,
      rcsActualTurnFeedback: null,
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

  it('reports the spacecraft hidden when it leaves the viewport bounds', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const overlayUi = createOverlayUiStub()
    const trailTarget = createBody()
    let visible: boolean | null = null
    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
      viewportHeight: 600,
      viewportSize: 480,
      viewportWidth: 800,
    })
    const presentation = createSpacecraftPresentation({
      defaultViewport: 480,
      gameScene,
      onSpacecraftVisibleChange: (nextVisible) => {
        visible = nextVisible
      },
      overlayUi: overlayUi.refs,
      pointerCameraInput: {
        pointerScreenPosition: { x: 0, y: 0 },
        updateEdgeScroll: () => {},
      },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 1_000_000_000, y: 0 }),
      spacecraftLabelIntroUntil: 0,
      rcsActualTurnFeedback: {
        currentHeading: Math.PI / 2,
        opacity: 1,
        phase: 'active',
        settleCurrentHeading: Math.PI / 2,
        settleElapsedSeconds: 0,
        settleStartHeading: 0,
        startHeading: 0,
      },
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 480,
    })

    expect(visible).toBe(false)
    expect(overlayUi.rcsActualTurnOverlay.style.display).toBe('none')
  })
})

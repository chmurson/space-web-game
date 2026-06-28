import { afterEach, describe, expect, it } from 'vitest'

import { createSpacecraftPresentation } from '@/presentation/spacecraftPresentation'
import { renderPosition } from '@/render/sceneUpdates'
import { createGameScene } from '@/scene/createGameScene'
import type { Spacecraft } from '@/simulation/types'
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

const createElementStub = () => ({
  setAttribute: () => {},
  style: createStyleStub(),
})

const createOverlayUiStub = (): OverlayUiRefs =>
  ({
    headingTargetDot: createElementStub(),
    headingTargetLine: createElementStub(),
    headingTargetOverlay: createElementStub(),
    headingTargetTurnSlice: createElementStub(),
    spacecraftCallout: createElementStub(),
    spacecraftCalloutLabel: null,
    spacecraftIconThrust: createElementStub(),
  }) as unknown as OverlayUiRefs

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

describe('createGameScene', () => {
  afterEach(() => {
    if (originalWindow) {
      globals.window = originalWindow
    } else {
      Reflect.deleteProperty(globals, 'window')
    }
  })

  it('prepares a subtle flight plane cue without showing the debug grid', () => {
    const gameScene = createTestGameScene()

    expect(gameScene.debugGrid.visible).toBe(false)
    expect(gameScene.flightPlaneCue.name).toBe('flight-plane-cue')
    expect(gameScene.flightPlaneCue.visible).toBe(false)
    expect(gameScene.flightPlaneCue.scale.x).toBe(0)
    expect(gameScene.flightPlaneCue.material.opacity).toBeLessThan(0.3)
    expect(gameScene.flightPlaneCue.material.depthWrite).toBe(false)
    expect(
      gameScene.flightPlaneCue.geometry.getAttribute('position').count,
    ).toBeGreaterThan(100)
  })

  it('syncs the flight plane cue through the spacecraft presentation update', () => {
    setWindowSize(800, 600)
    const gameScene = createTestGameScene()
    const trailTarget = {
      color: '#ffffff',
      id: 'target',
      mass: 1,
      name: 'Target',
      position: { x: 0, y: 0 },
      radius: 1,
      velocity: { x: 0, y: 0 },
    }
    const presentation = createSpacecraftPresentation({
      defaultViewport: 100,
      gameScene,
      overlayUi: createOverlayUiStub(),
      pointerCameraInput: { pointerScreenPosition: { x: 0, y: 0 } },
      spacecraftModelZoomThreshold: 1,
    })

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 0,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: 10_000_000, y: -20_000_000 }),
      spacecraftLabelIntroUntil: 0,
      targetHeading: null,
      targetHeadingScreenPosition: null,
      targetHeadingWorldPosition: null,
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 480,
    })

    const firstCuePosition = renderPosition(10_000_000, -20_000_000, 0.08)
    const firstCueScale = gameScene.flightPlaneCue.scale.x
    expect(gameScene.flightPlaneCue.visible).toBe(true)
    expect(gameScene.flightPlaneCue.position.x).toBeCloseTo(firstCuePosition.x)
    expect(gameScene.flightPlaneCue.position.y).toBeCloseTo(firstCuePosition.y)
    expect(gameScene.flightPlaneCue.position.z).toBeCloseTo(firstCuePosition.z)
    expect(firstCueScale).toBeGreaterThan(0)
    expect(gameScene.flightPlaneCue.scale.y).toBeCloseTo(firstCueScale)
    expect(gameScene.flightPlaneCue.scale.z).toBeCloseTo(firstCueScale)

    presentation.updateVisuals({
      bodies: [trailTarget],
      elapsed: 1,
      isThrusting: false,
      spacecraft: createSpacecraft({ x: -30_000_000, y: 40_000_000 }),
      spacecraftLabelIntroUntil: 0,
      targetHeading: null,
      targetHeadingScreenPosition: null,
      targetHeadingWorldPosition: null,
      trailTarget,
      trimTrailAroundTarget: false,
      viewportSize: 960,
    })

    const nextCuePosition = renderPosition(-30_000_000, 40_000_000, 0.08)
    expect(gameScene.flightPlaneCue.visible).toBe(true)
    expect(gameScene.flightPlaneCue.position.x).toBeCloseTo(nextCuePosition.x)
    expect(gameScene.flightPlaneCue.position.y).toBeCloseTo(nextCuePosition.y)
    expect(gameScene.flightPlaneCue.position.z).toBeCloseTo(nextCuePosition.z)
    expect(gameScene.flightPlaneCue.scale.x).toBeCloseTo(firstCueScale * 2)
    expect(gameScene.flightPlaneCue.scale.y).toBeCloseTo(firstCueScale * 2)
    expect(gameScene.flightPlaneCue.scale.z).toBeCloseTo(firstCueScale * 2)
  })
})

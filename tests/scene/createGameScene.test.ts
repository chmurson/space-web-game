import { describe, expect, it } from 'vitest'

import { createGameScene } from '@/scene/createGameScene'

const createTestGameScene = () =>
  createGameScene([], {
    dashPixels: 12,
    endMarkerMinScreenRadius: 5.5,
    endMarkerRadius: 0.17,
    gapPixels: 8,
    replaceLineGeometryOnUpdate: true,
  })

describe('createGameScene', () => {
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
})

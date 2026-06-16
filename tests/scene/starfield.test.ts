import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createGameScene } from '@/scene/createGameScene'
import { createStarfield, type Starfield } from '@/scene/starfield'

const getLayerPoints = (starfield: Starfield, layerIndex: number) => {
  const layer = starfield.group.children[layerIndex]
  if (!(layer instanceof THREE.Group)) {
    throw new Error('Expected starfield layer group')
  }

  const points = layer.children[0]
  if (!(points instanceof THREE.Points)) {
    throw new Error('Expected starfield layer points')
  }

  return points as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
}

const getLayerGroup = (starfield: Starfield, layerIndex: number) => {
  const layer = starfield.group.children[layerIndex]
  if (!(layer instanceof THREE.Group)) {
    throw new Error('Expected starfield layer group')
  }

  return layer
}

const getPositionValues = (starfield: Starfield, layerIndex = 0) =>
  Array.from(
    getLayerPoints(starfield, layerIndex).geometry.attributes.position.array,
  )

const updateStarfield = (
  starfield: Starfield,
  options: {
    target?: THREE.Vector3
    viewportHeight?: number
    viewportSize?: number
    viewportWidth?: number
  } = {},
) => {
  starfield.update({
    cameraTarget: options.target ?? new THREE.Vector3(0, 0, 0),
    viewportHeight: options.viewportHeight ?? 600,
    viewportSize: options.viewportSize ?? 100,
    viewportWidth: options.viewportWidth ?? 800,
  })
}

describe('createStarfield', () => {
  it('generates deterministic layer geometry for the same camera view', () => {
    const first = createStarfield()
    const second = createStarfield()
    const baseLayerIndex = 3

    updateStarfield(first)
    updateStarfield(second)

    expect(getPositionValues(first, baseLayerIndex).slice(0, 60)).toEqual(
      getPositionValues(second, baseLayerIndex).slice(0, 60),
    )
  })

  it('moves layer groups with partial camera parallax', () => {
    const starfield = createStarfield()
    const target = new THREE.Vector3(100, 0, -50)
    const baseLayerIndex = 3

    updateStarfield(starfield, { target })

    const farLayer = starfield.group.children[baseLayerIndex]
    expect(farLayer.position.x).toBeGreaterThan(0)
    expect(farLayer.position.x).toBeLessThan(target.x)
    expect(farLayer.position.z).toBeLessThan(0)
    expect(farLayer.position.z).toBeGreaterThan(target.z)
  })

  it('expands visible star coverage for wider zoom levels', () => {
    const starfield = createStarfield()
    const baseLayerIndex = 3

    updateStarfield(starfield, { viewportSize: 100 })
    const closeStarCount =
      getPositionValues(starfield, baseLayerIndex).length / 3

    updateStarfield(starfield, { viewportSize: 1_800 })
    const wideStarCount =
      getPositionValues(starfield, baseLayerIndex).length / 3

    expect(wideStarCount).toBeGreaterThan(closeStarCount)
  })

  it('fades close-detail layers away for wide zoom levels', () => {
    const starfield = createStarfield()

    updateStarfield(starfield, { viewportSize: 4 })
    const closeLayer = getLayerGroup(starfield, 0)
    const closeLayerMaterial = getLayerPoints(starfield, 0).material

    expect(closeLayer.visible).toBe(true)
    expect(closeLayerMaterial.opacity).toBeGreaterThan(0)
    expect(getPositionValues(starfield, 0).length).toBeGreaterThan(0)

    updateStarfield(starfield, { viewportSize: 300 })

    expect(closeLayer.visible).toBe(false)
    expect(closeLayerMaterial.opacity).toBe(0)
  })
})

describe('createGameScene', () => {
  it('adds the starfield and keeps the debug grid hidden by default', () => {
    const scene = createGameScene([], {
      dashPixels: 12,
      endMarkerMinScreenRadius: 5.5,
      endMarkerRadius: 0.17,
      gapPixels: 8,
      replaceLineGeometryOnUpdate: true,
    })

    expect(scene.debugGrid.visible).toBe(false)
    expect(scene.scene.children).toContain(scene.starfield.group)
  })
})

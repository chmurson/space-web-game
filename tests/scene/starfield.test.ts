import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { ScenarioAssets } from '@/render/scenarioAssets'
import {
  applyScenarioRenderConfigToScene,
  createGameScene,
} from '@/scene/createGameScene'
import { createStarfield, type Starfield } from '@/scene/starfield'
import type { Body } from '@/simulation/types'

const EARTH_CLOUD_LAYER_NAME = 'earth-cloud-layer'

const createBody = (overrides: Partial<Body> = {}): Body => ({
  id: 'earth',
  name: 'Earth',
  mass: 5.972e24,
  radius: 6_371_000,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#3b82f6',
  ...overrides,
})

const createTestGameScene = (
  bodies: Body[] = [],
  scenarioAssets?: ScenarioAssets,
  scenarioRenderConfig?: Parameters<typeof createGameScene>[3],
) =>
  createGameScene(
    bodies,
    {
      dashPixels: 12,
      endMarkerMinScreenRadius: 5.5,
      endMarkerRadius: 0.17,
      gapPixels: 8,
      replaceLineGeometryOnUpdate: true,
    },
    scenarioAssets,
    scenarioRenderConfig,
  )

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

const getLayerOpacity = (starfield: Starfield, layerIndex: number) =>
  getLayerPoints(starfield, layerIndex).material.opacity

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

const createBodyShaderTestInput = () =>
  ({
    fragmentShader: [
      'void main() {',
      '#include <common>',
      '#include <opaque_fragment>',
      '}',
    ].join('\n'),
    uniforms: {},
    vertexShader: [
      'void main() {',
      '#include <common>',
      '#include <begin_vertex>',
      '}',
    ].join('\n'),
  }) as Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0]

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
    const closeStarCount = getLayerPoints(starfield, baseLayerIndex).geometry
      .drawRange.count

    updateStarfield(starfield, { viewportSize: 1_800 })
    const wideStarCount = getLayerPoints(starfield, baseLayerIndex).geometry
      .drawRange.count

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

  it('hides nearly transparent fading layers before building wide point clouds', () => {
    const starfield = createStarfield()
    const fadingLayerIndex = 1

    updateStarfield(starfield, {
      viewportHeight: 844,
      viewportSize: 100,
      viewportWidth: 390,
    })

    expect(getLayerGroup(starfield, fadingLayerIndex).visible).toBe(false)
    expect(getLayerPoints(starfield, fadingLayerIndex).material.opacity).toBe(0)
    expect(
      getLayerPoints(starfield, fadingLayerIndex).geometry.getAttribute(
        'position',
      ),
    ).toBeUndefined()
  })

  it('does not fade layers away while zooming in', () => {
    const starfield = createStarfield()
    const zoomInViewportSizes = [2_500, 1_800, 1_000, 600, 300, 150, 75, 35, 8]
    let previousOpacities: number[] | null = null

    for (const viewportSize of zoomInViewportSizes) {
      updateStarfield(starfield, { viewportSize })
      const opacities = Array.from({
        length: starfield.group.children.length,
      }).map((_, layerIndex) => getLayerOpacity(starfield, layerIndex))

      if (previousOpacities) {
        for (let index = 0; index < opacities.length; index += 1) {
          expect(opacities[index]).toBeGreaterThanOrEqual(
            previousOpacities[index],
          )
        }
      }

      previousOpacities = opacities
    }
  })

  it('keeps sparse anchor stars available while thinning detail at max zoom-out', () => {
    const starfield = createStarfield()

    updateStarfield(starfield, { viewportSize: 4 })

    expect(getLayerGroup(starfield, 0).visible).toBe(true)
    expect(getLayerGroup(starfield, 5).visible).toBe(true)

    updateStarfield(starfield, { viewportSize: 2_500 })

    expect(getLayerGroup(starfield, 0).visible).toBe(false)
    expect(getLayerGroup(starfield, 3).visible).toBe(false)
    expect(getLayerGroup(starfield, 4).visible).toBe(false)
    expect(getLayerGroup(starfield, 5).visible).toBe(true)
    expect(getLayerPoints(starfield, 5).material.opacity).toBeGreaterThan(0)
  })

  it('reuses layer buffers while zooming out adjusts the drawn star count', () => {
    const starfield = createStarfield()
    const baseLayerIndex = 3

    updateStarfield(starfield, { viewportSize: 100 })
    const points = getLayerPoints(starfield, baseLayerIndex)
    const positionAttribute = points.geometry.getAttribute('position')
    const colorAttribute = points.geometry.getAttribute('color')
    const closeDrawCount = points.geometry.drawRange.count

    updateStarfield(starfield, { viewportSize: 1_800 })

    expect(points.geometry.getAttribute('position')).toBe(positionAttribute)
    expect(points.geometry.getAttribute('color')).toBe(colorAttribute)
    expect(points.geometry.drawRange.count).toBeGreaterThan(closeDrawCount)
    expect(points.geometry.drawRange.count).toBeLessThanOrEqual(
      positionAttribute.count,
    )
  })
})

describe('createGameScene', () => {
  it('adds the starfield and keeps the debug grid hidden by default', () => {
    const scene = createTestGameScene()

    expect(scene.debugGrid.visible).toBe(false)
    expect(scene.scene.children).toContain(scene.starfield.group)
  })

  it('uses preloaded body textures without starting internal texture loads', () => {
    const diffuseTexture = new THREE.Texture()
    const loadTexture = vi
      .spyOn(THREE.TextureLoader.prototype, 'load')
      .mockReturnValue(new THREE.Texture())
    try {
      const scene = createTestGameScene([createBody()], {
        bodyCloudTextures: new Map(),
        bodyDiffuseTextures: new Map([['earth', diffuseTexture]]),
      })
      const earth = scene.bodyMeshes.get('earth')
      const material = earth?.material

      expect(loadTexture).not.toHaveBeenCalled()
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect((material as THREE.MeshStandardMaterial).map).toBe(diffuseTexture)
      expect(
        (material as THREE.MeshStandardMaterial).color.getHexString(),
      ).toBe('ffffff')
    } finally {
      loadTexture.mockRestore()
    }
  })

  it('adds a transparent cloud layer to textured Earth only', () => {
    const cloudTexture = new THREE.Texture()
    const scene = createTestGameScene(
      [
        createBody(),
        createBody({
          id: 'moon',
          name: 'Moon',
          color: '#d1d5db',
          mass: 7.342e22,
          radius: 1_737_400,
        }),
      ],
      {
        bodyCloudTextures: new Map([['earth', cloudTexture]]),
        bodyDiffuseTextures: new Map(),
      },
    )

    const earthCloudLayer = scene.bodyCloudMeshes.get('earth')
    const earth = scene.bodyMeshes.get('earth')
    const moon = scene.bodyMeshes.get('moon')
    const earthRadius = (earth?.geometry as THREE.SphereGeometry).parameters
      .radius
    const cloudRadius = earthCloudLayer?.geometry.parameters.radius

    expect(earthCloudLayer).toBeInstanceOf(THREE.Mesh)
    expect(earthCloudLayer?.name).toBe(EARTH_CLOUD_LAYER_NAME)
    expect(earthCloudLayer?.visible).toBe(true)
    expect(earthCloudLayer?.material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(earthCloudLayer?.material.map).toBe(cloudTexture)
    expect(earthCloudLayer?.material.transparent).toBe(true)
    expect(earthCloudLayer?.material.depthWrite).toBe(false)
    expect(earthCloudLayer?.material.polygonOffset).toBe(false)
    expect(cloudRadius).toBeGreaterThan(earthRadius)
    expect(cloudRadius).toBeCloseTo(earthRadius * 1.001)
    expect(scene.bodyCloudMeshes.has('moon')).toBe(false)
    expect(moon?.getObjectByName(EARTH_CLOUD_LAYER_NAME)).toBeUndefined()
  })

  it('adds a subtle atmosphere rim to Earth only', () => {
    const scene = createTestGameScene([
      createBody(),
      createBody({
        id: 'moon',
        name: 'Moon',
        color: '#d1d5db',
        mass: 7.342e22,
        radius: 1_737_400,
      }),
    ])

    const earth = scene.bodyMeshes.get('earth')
    const moon = scene.bodyMeshes.get('moon')
    const rim = earth?.getObjectByName('earth-atmosphere-rim')

    expect(rim).toBeInstanceOf(THREE.Mesh)
    expect(earth?.getObjectByName(EARTH_CLOUD_LAYER_NAME)).toBeInstanceOf(
      THREE.Mesh,
    )
    expect(moon?.getObjectByName(EARTH_CLOUD_LAYER_NAME)).toBeUndefined()
    expect(moon?.getObjectByName('earth-atmosphere-rim')).toBeUndefined()
    expect(
      (earth?.geometry as THREE.SphereGeometry).parameters.widthSegments,
    ).toBe(64)
    expect(
      (earth?.geometry as THREE.SphereGeometry).parameters.heightSegments,
    ).toBe(32)
    expect(
      (moon?.geometry as THREE.SphereGeometry).parameters.widthSegments,
    ).toBe(64)
    expect(
      (moon?.geometry as THREE.SphereGeometry).parameters.heightSegments,
    ).toBe(32)

    const material = (rim as THREE.Mesh).material
    const geometry = (rim as THREE.Mesh).geometry
    expect(geometry).toBeInstanceOf(THREE.SphereGeometry)
    expect((geometry as THREE.SphereGeometry).parameters.widthSegments).toBe(96)
    expect((geometry as THREE.SphereGeometry).parameters.heightSegments).toBe(
      48,
    )
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect((material as THREE.ShaderMaterial).transparent).toBe(true)
    expect((material as THREE.ShaderMaterial).depthWrite).toBe(false)
    expect((material as THREE.ShaderMaterial).side).toBe(THREE.BackSide)
    expect((material as THREE.ShaderMaterial).fragmentShader).toContain(
      'edgeGlow',
    )
    expect((material as THREE.ShaderMaterial).fragmentShader).toContain(
      'uAtmosphereSunDirection',
    )
  })

  it('drives body day-night materials from the default render sun direction', () => {
    const scene = createTestGameScene([createBody()])
    const earth = scene.bodyMeshes.get('earth')
    const material = earth?.material

    expect(scene.visualSunDirection.x).toBeCloseTo(0)
    expect(scene.visualSunDirection.y).toBeGreaterThan(0)
    expect(scene.visualSunDirection.z).toBeGreaterThan(0)
    expect(scene.sunLight.position.z).toBeGreaterThan(0)
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(
      (material as THREE.MeshStandardMaterial).customProgramCacheKey(),
    ).toBe('body-day-night-lighting-v1')
    expect(
      (
        (material as THREE.MeshStandardMaterial).userData
          .bodyDayNightLighting as {
          bodyAtmosphereTintStrength: number
          bodyNightTextureStrength: number
          bodySunDirection: THREE.Vector3
        }
      ).bodySunDirection,
    ).toBe(scene.visualSunDirection)
  })

  it('injects body day-night shader chunks explicitly', () => {
    const scene = createTestGameScene([createBody()])
    const earth = scene.bodyMeshes.get('earth')
    const material = earth?.material
    const shader = createBodyShaderTestInput()

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    ;(material as THREE.MeshStandardMaterial).onBeforeCompile(
      shader,
      {} as THREE.WebGLRenderer,
    )

    expect(shader.vertexShader).toContain('varying vec3 vBodyWorldNormal;')
    expect(shader.vertexShader).toContain(
      'vec4 bodyWorldPosition = modelMatrix * vec4(transformed, 1.0);',
    )
    expect(shader.fragmentShader).toContain('uniform vec3 uBodySunDirection;')
    expect(shader.fragmentShader).toContain(
      'gl_FragColor.rgb = mix(bodyReadableNight, gl_FragColor.rgb, bodyDaylight);',
    )
    expect(shader.uniforms.uBodySunDirection.value).toBe(
      scene.visualSunDirection,
    )
    expect(shader.uniforms.uBodyNightTextureStrength.value).toBeGreaterThan(0)
    expect(shader.uniforms.uBodyAtmosphereTintStrength.value).toBeGreaterThan(0)
  })

  it('applies configured scenario sun direction to scene lighting', () => {
    const scene = createTestGameScene([createBody()], undefined, {
      sunlightDirection: { x: 1, y: 0 },
    })

    expect(scene.visualSunDirection.x).toBeLessThan(0)
    expect(scene.visualSunDirection.y).toBeGreaterThan(0)
    expect(scene.visualSunDirection.z).toBeCloseTo(0)
    expect(scene.sunLight.position.x).toBeLessThan(0)
    expect(scene.sunLight.position.z).toBeCloseTo(0)

    applyScenarioRenderConfigToScene(scene, {
      sunlightDirection: { x: 0, y: 1 },
    })

    expect(scene.visualSunDirection.x).toBeCloseTo(0)
    expect(scene.visualSunDirection.y).toBeGreaterThan(0)
    expect(scene.visualSunDirection.z).toBeLessThan(0)

    const sunLightDirection = scene.sunLight.position.clone().normalize()
    expect(sunLightDirection.x).toBeCloseTo(scene.visualSunDirection.x)
    expect(sunLightDirection.y).toBeCloseTo(scene.visualSunDirection.y)
    expect(sunLightDirection.z).toBeCloseTo(scene.visualSunDirection.z)
    expect(scene.sunLight.position.y).toBeGreaterThan(0)
  })
})

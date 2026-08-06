import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { sphereOfInfluenceVariants } from '@/config/featureFlags'
import { createGameScene } from '@/scene/createGameScene'
import {
  createSphereOfInfluenceVisual,
  updateSphereOfInfluenceVisualViewport,
} from '@/scene/sphereOfInfluenceVisual'
import type { Body } from '@/simulation/types'

const body: Body = {
  color: '#2f80ed',
  id: 'earth',
  mass: 5.9722e24,
  name: 'Earth',
  position: { x: 10_000_000, y: -20_000_000 },
  radius: 6_371_000,
  sphereOfInfluenceRadius: 924_637_562,
  velocity: { x: 0, y: 1 },
}

const trajectoryRenderingConfig = {
  dashPixels: 12,
  endMarkerMinScreenRadius: 5.5,
  endMarkerRadius: 0.17,
  gapPixels: 8,
  replaceLineGeometryOnUpdate: true,
}

describe('sphere-of-influence visuals', () => {
  it('uses current soi=5 as the shared field for all thinness variants', () => {
    const childSignatures = new Set<string>()
    const expectedMaxZoomWidthScales = [0.25, 0.15, 0.1, 0.05]

    for (const [index, variant] of sphereOfInfluenceVariants.entries()) {
      const visual = createSphereOfInfluenceVisual(body, variant)
      const metadata = visual.group.userData.sphereOfInfluence
      const maxZoomGradientWidthScale = expectedMaxZoomWidthScales[index]

      expect(metadata).toEqual({
        bodyId: 'earth',
        borderWidthPixels: 1,
        edgeGradientStrength: 1.5,
        maxZoomGradientWidthScale,
        radiusMeters: body.sphereOfInfluenceRadius,
        variant,
      })
      expect(visual.group.name).toBe('Earth sphere of influence')
      expect(visual.group.children.map((child) => child.name)).toEqual([
        'soi-field-fill',
      ])
      expect(visual.group.getObjectByName('soi-field-fill')).toHaveProperty(
        'material.uniforms.uSoiBorderWidthPixels.value',
        1,
      )
      expect(visual.group.getObjectByName('soi-field-fill')).toHaveProperty(
        'material.uniforms.uSoiEdgeGradientWidthScale.value',
        1,
      )
      childSignatures.add(
        visual.group.children.map((child) => child.name).join('|'),
      )
    }

    expect(childSignatures.size).toBe(1)
  })

  it('preserves the selected width until local zoom, then reaches four thin endpoints', () => {
    const maxViewportSize = 4_000
    const minViewportSize = 4
    const middleViewportSize = 100
    const taperMidpointViewportSize = 22
    const expectedMaxZoomWidthScales = [0.25, 0.15, 0.1, 0.05]

    for (const [index, variant] of sphereOfInfluenceVariants.entries()) {
      const visual = createSphereOfInfluenceVisual(body, variant)
      const field = visual.group.getObjectByName(
        'soi-field-fill',
      ) as THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>

      updateSphereOfInfluenceVisualViewport(visual.group, {
        maxViewportSize,
        minViewportSize,
        viewportSize: middleViewportSize,
      })
      expect(field.material.uniforms.uSoiEdgeGradientWidthScale.value).toBe(
        middleViewportSize / maxViewportSize,
      )

      updateSphereOfInfluenceVisualViewport(visual.group, {
        maxViewportSize,
        minViewportSize,
        viewportSize: taperMidpointViewportSize,
      })
      expect(
        field.material.uniforms.uSoiEdgeGradientWidthScale.value /
          (taperMidpointViewportSize / maxViewportSize),
      ).toBeCloseTo((1 + expectedMaxZoomWidthScales[index]) / 2)

      updateSphereOfInfluenceVisualViewport(visual.group, {
        maxViewportSize,
        minViewportSize,
        viewportSize: minViewportSize,
      })
      const maxZoomWidthScale =
        field.material.uniforms.uSoiEdgeGradientWidthScale.value

      expect(maxZoomWidthScale).toBeCloseTo(
        (minViewportSize / maxViewportSize) * expectedMaxZoomWidthScales[index],
      )
      expect(
        maxZoomWidthScale / (minViewportSize / maxViewportSize),
      ).toBeCloseTo(expectedMaxZoomWidthScales[index])
    }
  })

  it('keeps the selected gradient profile and screen-space border', () => {
    const visual = createSphereOfInfluenceVisual(
      body,
      'gradient-max-zoom-width-25pct',
    )
    const field = visual.group.getObjectByName('soi-field-fill')

    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining('0.32 * interior + 1.50 * outerField'),
    )
    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining('float alpha = 0.045 * ('),
    )
    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining('dFdx(radiusFromCenter)'),
    )
    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining(
        'float outerFieldWidth = 0.60 * uSoiEdgeGradientWidthScale',
      ),
    )
  })

  it('keeps scene visuals absent until a variant is selected', () => {
    const disabledScene = createGameScene([body], trajectoryRenderingConfig)
    const enabledScene = createGameScene(
      [body],
      trajectoryRenderingConfig,
      undefined,
      undefined,
      'gradient-max-zoom-width-15pct',
    )

    expect(disabledScene.bodySphereOfInfluenceGroups.size).toBe(0)
    expect(enabledScene.bodySphereOfInfluenceGroups.get('earth')).toBeDefined()
  })
})

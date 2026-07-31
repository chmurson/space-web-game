import { describe, expect, it } from 'vitest'

import { sphereOfInfluenceVariants } from '@/config/featureFlags'
import { createGameScene } from '@/scene/createGameScene'
import { createSphereOfInfluenceVisual } from '@/scene/sphereOfInfluenceVisual'
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
  it('uses the approved soft field and 1px border for all five strengths', () => {
    const childSignatures = new Set<string>()
    const expectedStrengths = [1, 1.5, 2, 2.5, 3]

    for (const [index, variant] of sphereOfInfluenceVariants.entries()) {
      const visual = createSphereOfInfluenceVisual(body, variant)
      const metadata = visual.group.userData.sphereOfInfluence
      const edgeGradientStrength = expectedStrengths[index]

      expect(metadata).toEqual({
        bodyId: 'earth',
        borderWidthPixels: 1,
        edgeGradientStrength,
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
        'material.uniforms.uSoiEdgeGradientStrength.value',
        edgeGradientStrength,
      )
      childSignatures.add(
        visual.group.children.map((child) => child.name).join('|'),
      )
    }

    expect(childSignatures.size).toBe(1)
  })

  it('keeps soi=1 as the original field-gradient strength', () => {
    const visual = createSphereOfInfluenceVisual(body, 'field-gradient-1x')
    const field = visual.group.getObjectByName('soi-field-fill')

    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining(
        '0.32 * interior + uSoiEdgeGradientStrength * outerField',
      ),
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
      'material.uniforms.uSoiEdgeGradientStrength.value',
      1,
    )
  })

  it('keeps scene visuals absent until a variant is selected', () => {
    const disabledScene = createGameScene([body], trajectoryRenderingConfig)
    const enabledScene = createGameScene(
      [body],
      trajectoryRenderingConfig,
      undefined,
      undefined,
      'field-gradient-1.5x',
    )

    expect(disabledScene.bodySphereOfInfluenceGroups.size).toBe(0)
    expect(enabledScene.bodySphereOfInfluenceGroups.get('earth')).toBeDefined()
  })
})

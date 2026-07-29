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
  it('uses the approved soft field for all four border widths', () => {
    const childSignatures = new Set<string>()

    for (const [index, variant] of sphereOfInfluenceVariants.entries()) {
      const visual = createSphereOfInfluenceVisual(body, variant)
      const metadata = visual.group.userData.sphereOfInfluence
      const borderWidthPixels = index + 1

      expect(metadata).toEqual({
        bodyId: 'earth',
        borderWidthPixels,
        radiusMeters: body.sphereOfInfluenceRadius,
        variant,
      })
      expect(visual.group.name).toBe('Earth sphere of influence')
      expect(visual.group.children.map((child) => child.name)).toEqual([
        'soi-field-fill',
      ])
      expect(visual.group.getObjectByName('soi-field-fill')).toHaveProperty(
        'material.uniforms.uSoiBorderWidthPixels.value',
        borderWidthPixels,
      )
      childSignatures.add(
        visual.group.children.map((child) => child.name).join('|'),
      )
    }

    expect(childSignatures.size).toBe(1)
  })

  it('preserves the original field gradient shader', () => {
    const visual = createSphereOfInfluenceVisual(body, 'field-1px')
    const field = visual.group.getObjectByName('soi-field-fill')

    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining('0.045 * (0.32 * interior + outerField)'),
    )
    expect(field).toHaveProperty(
      'material.fragmentShader',
      expect.stringContaining('dFdx(radiusFromCenter)'),
    )
  })

  it('keeps scene visuals absent until a variant is selected', () => {
    const disabledScene = createGameScene([body], trajectoryRenderingConfig)
    const enabledScene = createGameScene(
      [body],
      trajectoryRenderingConfig,
      undefined,
      undefined,
      'field-2px',
    )

    expect(disabledScene.bodySphereOfInfluenceGroups.size).toBe(0)
    expect(enabledScene.bodySphereOfInfluenceGroups.get('earth')).toBeDefined()
  })
})

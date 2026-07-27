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
  it('builds four structurally distinct body-colored variants', () => {
    const childSignatures = new Set<string>()

    for (const variant of sphereOfInfluenceVariants) {
      const visual = createSphereOfInfluenceVisual(body, variant)
      const metadata = visual.group.userData.sphereOfInfluence

      expect(metadata).toEqual({
        bodyId: 'earth',
        radiusMeters: body.sphereOfInfluenceRadius,
        variant,
      })
      expect(visual.group.name).toBe('Earth sphere of influence')
      expect(visual.group.children.length).toBeGreaterThan(0)
      childSignatures.add(
        visual.group.children.map((child) => child.name).join('|'),
      )
    }

    expect(childSignatures.size).toBe(4)
  })

  it('registers a screen-space dash pattern only for the dashed variant', () => {
    for (const variant of sphereOfInfluenceVariants) {
      const visual = createSphereOfInfluenceVisual(body, variant)

      expect(visual.dashPatterns).toHaveLength(variant === 'dashed' ? 1 : 0)
    }
  })

  it('keeps scene visuals absent until a variant is selected', () => {
    const disabledScene = createGameScene([body], trajectoryRenderingConfig)
    const enabledScene = createGameScene(
      [body],
      trajectoryRenderingConfig,
      undefined,
      undefined,
      'boundary',
    )

    expect(disabledScene.bodySphereOfInfluenceGroups.size).toBe(0)
    expect(enabledScene.bodySphereOfInfluenceGroups.get('earth')).toBeDefined()
  })
})

import { describe, expect, it } from 'vitest'

import { EARTH_MOON_VIEWPORT_SIZE } from '@/domain/viewportPresets'
import {
  EARTH_MASS,
  EARTH_MOON_DISTANCE,
  EARTH_ORBIT_SEMI_MAJOR_AXIS,
  MOON_MASS,
  RENDER_SCALE,
  SUN_MASS,
} from '@/simulation/constants'
import { createEarthMoonScenario } from '@/simulation/scenarios/earthMoon'
import { calculateSphereOfInfluenceRadius } from '@/simulation/sphereOfInfluence'

describe('sphere of influence', () => {
  it('uses the classical patched-conic radius for Earth and Moon', () => {
    const earthRadius = calculateSphereOfInfluenceRadius({
      bodyMass: EARTH_MASS,
      orbitalSemiMajorAxis: EARTH_ORBIT_SEMI_MAJOR_AXIS,
      primaryMass: SUN_MASS,
    })
    const moonRadius = calculateSphereOfInfluenceRadius({
      bodyMass: MOON_MASS,
      orbitalSemiMajorAxis: EARTH_MOON_DISTANCE,
      primaryMass: EARTH_MASS,
    })

    expect(earthRadius).toBeGreaterThan(924_000_000)
    expect(earthRadius).toBeLessThan(925_000_000)
    expect(moonRadius).toBeGreaterThan(66_000_000)
    expect(moonRadius).toBeLessThan(67_000_000)
  })

  it('provides an influence radius for every built-in Earth-Moon body', () => {
    const scenario = createEarthMoonScenario()

    expect(scenario.bodies).toHaveLength(2)
    for (const body of scenario.bodies) {
      expect(body.sphereOfInfluenceRadius).toBeGreaterThan(body.radius)
    }
  })

  it('quadruples the system zoom ceiling beyond Earth’s full SOI diameter', () => {
    const earth = createEarthMoonScenario().bodies.find(
      (body) => body.id === 'earth',
    )
    const earthSoiDiameter =
      (earth?.sphereOfInfluenceRadius ?? 0) * RENDER_SCALE * 2

    expect(EARTH_MOON_VIEWPORT_SIZE).toBe(4_000)
    expect(earthSoiDiameter).toBeGreaterThan(1_000)
    expect(earthSoiDiameter).toBeLessThan(EARTH_MOON_VIEWPORT_SIZE)
  })
})

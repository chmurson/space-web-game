import { describe, expect, it } from 'vitest'

import { propagateKeplerTwoBody } from '@/prediction/keplerTwoBody'
import { EARTH_MASS, EARTH_RADIUS, G } from '@/simulation/constants'
import type { Body } from '@/simulation/types'
import { length } from '@/simulation/vector'

const earth: Body = {
  id: 'earth',
  name: 'Earth',
  mass: EARTH_MASS,
  radius: EARTH_RADIUS,
  position: { x: 1_000_000, y: -2_000_000 },
  velocity: { x: 120, y: -80 },
  color: '#fff',
}

const orbitRadius = EARTH_RADIUS + 400_000
const orbitSpeed = Math.sqrt((G * EARTH_MASS) / orbitRadius)
const spacecraft = {
  position: {
    x: earth.position.x + orbitRadius,
    y: earth.position.y,
  },
  velocity: {
    x: earth.velocity.x,
    y: earth.velocity.y + orbitSpeed,
  },
  dryMass: 10_000,
}

describe('propagateKeplerTwoBody', () => {
  it('preserves the initial state at zero elapsed time', () => {
    expect(propagateKeplerTwoBody(earth, spacecraft, 0)).toEqual({
      position: spacecraft.position,
      velocity: spacecraft.velocity,
    })
  })

  it('returns to the same circular orbit after one orbital period', () => {
    const stationaryEarth = { ...earth, velocity: { x: 0, y: 0 } }
    const stationarySpacecraft = {
      ...spacecraft,
      velocity: { x: 0, y: orbitSpeed },
    }
    const period = 2 * Math.PI * Math.sqrt(orbitRadius ** 3 / (G * earth.mass))
    const propagated = propagateKeplerTwoBody(
      stationaryEarth,
      stationarySpacecraft,
      period,
    )

    expect(
      length({
        x: propagated.position.x - stationarySpacecraft.position.x,
        y: propagated.position.y - stationarySpacecraft.position.y,
      }),
    ).toBeLessThan(1e-3)
    expect(
      length({
        x: propagated.velocity.x - stationarySpacecraft.velocity.x,
        y: propagated.velocity.y - stationarySpacecraft.velocity.y,
      }),
    ).toBeLessThan(1e-6)
  })

  it('moves with a translating central body', () => {
    const propagated = propagateKeplerTwoBody(earth, spacecraft, 1_000)
    const earthShift = {
      x: earth.position.x + earth.velocity.x * 1_000,
      y: earth.position.y + earth.velocity.y * 1_000,
    }

    expect(propagated.position.x).not.toBe(earthShift.x)
    expect(
      length({
        x: propagated.position.x - earthShift.x,
        y: propagated.position.y - earthShift.y,
      }),
    ).toBeCloseTo(orbitRadius, -2)
  })
})

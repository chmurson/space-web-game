import { describe, expect, it } from 'vitest'

import { getCaptureMetricsForState } from '@/assist/orbitalAssist'
import { EARTH_MASS, EARTH_RADIUS } from '@/simulation/constants'
import { idleControls } from '@/simulation/state'
import type { Body, SimulationState, Spacecraft } from '@/simulation/types'

const earth: Body = {
  id: 'earth',
  name: 'Earth',
  mass: EARTH_MASS,
  radius: EARTH_RADIUS,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#2f80ed',
}

const spacecraftAtMass = (dryMass: number): Spacecraft => ({
  position: { x: EARTH_RADIUS + 400_000, y: 0 },
  velocity: { x: 0, y: 7_600 },
  heading: 0,
  fuel: 1,
  fuelUsed: 0,
  dryMass,
  fuelMass: 8_000,
  fuelCapacity: 32_000,
})

const createState = (spacecraft: Spacecraft): SimulationState => ({
  elapsed: 0,
  controls: idleControls(),
  bodies: [earth],
  spacecraft,
})

describe('orbitalAssist', () => {
  it('keeps orbital speed targets independent of spacecraft mass', () => {
    const lightMetrics = getCaptureMetricsForState(
      createState(spacecraftAtMass(10_000)),
      earth,
    )
    const heavyMetrics = getCaptureMetricsForState(
      createState(spacecraftAtMass(50_000)),
      earth,
    )

    expect(heavyMetrics.circularSpeed).toBe(lightMetrics.circularSpeed)
    expect(heavyMetrics.specificEnergy).toBe(lightMetrics.specificEnergy)
  })
})

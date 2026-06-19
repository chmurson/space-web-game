import {
  EARTH_MASS,
  EARTH_MOON_DISTANCE,
  EARTH_RADIUS,
  G,
  MOON_MASS,
  MOON_RADIUS,
} from '../constants'
import type { Scenario } from '../types'

type EarthMoonScenarioOptions = {
  fuelCapacity?: number
}

export const createEarthMoonScenario = (
  options: EarthMoonScenarioOptions = {},
): Scenario => {
  const totalMass = EARTH_MASS + MOON_MASS
  const earthOrbitRadius = (EARTH_MOON_DISTANCE * MOON_MASS) / totalMass
  const moonOrbitRadius = (EARTH_MOON_DISTANCE * EARTH_MASS) / totalMass
  const angularVelocity = Math.sqrt((G * totalMass) / EARTH_MOON_DISTANCE ** 3)

  const earthPosition = { x: -earthOrbitRadius, y: 0 }
  const moonPosition = { x: moonOrbitRadius, y: 0 }
  const earthVelocity = { x: 0, y: -angularVelocity * earthOrbitRadius }
  const moonVelocity = { x: 0, y: angularVelocity * moonOrbitRadius }

  const parkingOrbitRadius = EARTH_RADIUS + 400_000
  const parkingOrbitSpeed = Math.sqrt((G * EARTH_MASS) / parkingOrbitRadius)

  return {
    id: 'earth-moon',
    name: 'Earth-Moon sandbox',
    description: 'Practice burns in a simplified Earth-Moon plane.',
    bodies: [
      {
        id: 'earth',
        name: 'Earth',
        mass: EARTH_MASS,
        radius: EARTH_RADIUS,
        position: earthPosition,
        velocity: earthVelocity,
        color: '#2f80ed',
      },
      {
        id: 'moon',
        name: 'Moon',
        mass: MOON_MASS,
        radius: MOON_RADIUS,
        position: moonPosition,
        velocity: moonVelocity,
        color: '#9aa0a6',
      },
    ],
    spacecraft: {
      position: {
        x: earthPosition.x + parkingOrbitRadius,
        y: earthPosition.y,
      },
      velocity: {
        x: earthVelocity.x,
        y: earthVelocity.y + parkingOrbitSpeed,
      },
      heading: Math.PI / 2,
      fuel: 1,
      fuelUsed: 0,
      dryMass: 10_000,
      fuelMass: 8_000,
      fuelCapacity: options.fuelCapacity ?? 0,
    },
  }
}

export const createMoonCaptureDebugScenario = (): Scenario => {
  const scenario = createEarthMoonScenario()
  const moon = scenario.bodies.find((body) => body.id === 'moon')

  if (!moon) {
    return scenario
  }

  const approachOffset = {
    x: -84_000_000,
    y: 12_000_000,
  }
  const approachDistance = Math.sqrt(
    approachOffset.x ** 2 + approachOffset.y ** 2,
  )
  const towardMoon = {
    x: -approachOffset.x / approachDistance,
    y: -approachOffset.y / approachDistance,
  }
  const tangent = {
    x: -towardMoon.y,
    y: towardMoon.x,
  }

  return {
    ...scenario,
    id: 'moon-capture-debug',
    name: 'Moon capture debug',
    description:
      'Start near the Moon capture-assist range with an incoming trajectory.',
    spacecraft: {
      ...scenario.spacecraft,
      position: {
        x: moon.position.x + approachOffset.x,
        y: moon.position.y + approachOffset.y,
      },
      velocity: {
        x: moon.velocity.x + towardMoon.x * 1_100 + tangent.x * 350,
        y: moon.velocity.y + towardMoon.y * 1_100 + tangent.y * 350,
      },
      heading: Math.atan2(towardMoon.y, towardMoon.x),
      fuelUsed: 0,
    },
  }
}

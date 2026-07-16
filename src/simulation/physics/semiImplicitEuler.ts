import { G } from '../constants'
import type { Body, PhysicsEngine, SimulationState, Spacecraft } from '../types'
import { add, fromAngle, lengthSq, scale, sub, type Vec2, vec } from '../vector'

const MAIN_THRUST = 120_000
const REVERSE_THRUST = 35_000
const STRAFE_THRUST = 25_000
const ROTATION_RATE = 0.225
const ROTATION_ACCELERATION = 0.9
const ROTATION_BRAKING = 1.8
const FUEL_FLOW = 7
const SOFTENING = 1_000
const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const moveToward = (value: number, target: number, maxDelta: number) =>
  value < target
    ? Math.min(value + maxDelta, target)
    : Math.max(value - maxDelta, target)

const isFiniteFuel = (spacecraft: Spacecraft) => spacecraft.fuelCapacity > 0
const getRemainingFuelMass = (spacecraft: Spacecraft) =>
  Math.max(0, spacecraft.fuel) * spacecraft.fuelCapacity
const getSpacecraftMass = (spacecraft: Spacecraft) =>
  spacecraft.dryMass + spacecraft.fuelMass * Math.max(0, spacecraft.fuel)

const gravityAt = (
  position: Vec2,
  bodies: Body[],
  ignoredBodyId?: string,
): Vec2 => {
  let acceleration = vec()

  for (const body of bodies) {
    if (body.id === ignoredBodyId) {
      continue
    }

    const offset = sub(body.position, position)
    const distanceSquared = lengthSq(offset) + SOFTENING * SOFTENING
    const distance = Math.sqrt(distanceSquared)
    const accelerationMagnitude = (G * body.mass) / distanceSquared
    acceleration = add(
      acceleration,
      scale(offset, accelerationMagnitude / distance),
    )
  }

  return acceleration
}

const spacecraftThrustAcceleration = (
  spacecraft: Spacecraft,
  state: SimulationState,
  dt: number,
) => {
  const { controls } = state
  const requestedFuelUseRate =
    Math.abs(controls.main) * FUEL_FLOW +
    Math.abs(controls.reverse) * FUEL_FLOW * 0.4 +
    Math.abs(controls.strafe) * FUEL_FLOW * 0.35 +
    Math.abs(controls.turn) * FUEL_FLOW * 0.2
  const requestedFuelUse = requestedFuelUseRate * dt
  const finiteFuel = isFiniteFuel(spacecraft)
  const usedFuel = finiteFuel
    ? Math.min(getRemainingFuelMass(spacecraft), requestedFuelUse)
    : 0
  const fuelRatio =
    requestedFuelUse > 0 && finiteFuel ? usedFuel / requestedFuelUse : 1
  const desiredAngularVelocity = controls.turn * ROTATION_RATE * fuelRatio
  const angularVelocity = moveToward(
    spacecraft.angularVelocity ?? 0,
    desiredAngularVelocity,
    (desiredAngularVelocity === 0 ? ROTATION_BRAKING : ROTATION_ACCELERATION) *
      dt,
  )
  const heading = normalizeAngle(spacecraft.heading + angularVelocity * dt)

  const forward = fromAngle(heading)
  const right = { x: forward.y, y: -forward.x }
  const mass = getSpacecraftMass(spacecraft)
  const forwardForce =
    MAIN_THRUST * controls.main - REVERSE_THRUST * controls.reverse
  const strafeForce = STRAFE_THRUST * controls.strafe

  return {
    acceleration: add(
      scale(forward, (forwardForce / mass) * fuelRatio),
      scale(right, (strafeForce / mass) * fuelRatio),
    ),
    fuel: finiteFuel
      ? Math.max(0, spacecraft.fuel - usedFuel / spacecraft.fuelCapacity)
      : spacecraft.fuel,
    fuelUsed: spacecraft.fuelUsed + usedFuel,
    heading,
    angularVelocity,
  }
}

export const semiImplicitEuler: PhysicsEngine = {
  name: 'Semi-implicit Euler',
  step(state, dt) {
    const bodies = state.bodies.map((body) => {
      const acceleration = gravityAt(body.position, state.bodies, body.id)
      const velocity = add(body.velocity, scale(acceleration, dt))

      return {
        ...body,
        velocity,
        position: add(body.position, scale(velocity, dt)),
      }
    })

    const thrust = spacecraftThrustAcceleration(state.spacecraft, state, dt)
    const gravity = gravityAt(state.spacecraft.position, bodies)
    const velocity = add(
      state.spacecraft.velocity,
      scale(add(gravity, thrust.acceleration), dt),
    )

    return {
      ...state,
      elapsed: state.elapsed + dt,
      bodies,
      spacecraft: {
        ...state.spacecraft,
        heading: thrust.heading,
        angularVelocity: thrust.angularVelocity,
        fuel: thrust.fuel,
        fuelUsed: thrust.fuelUsed,
        velocity,
        position: add(state.spacecraft.position, scale(velocity, dt)),
      },
    }
  },
}

import type { SimulationState, Spacecraft } from '../types'
import { add, fromAngle, scale, type Vec2 } from '../vector'

const MAIN_THRUST = 120_000
const REVERSE_THRUST = 35_000
const STRAFE_THRUST = 25_000
const ROTATION_RATE = 0.45
const ROTATION_ACCELERATION = 0.9
const ROTATION_BRAKING = 1.8
const FUEL_FLOW = 7

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

export type SpacecraftControlStep = {
  acceleration: Vec2
  angularVelocity: number
  fuel: number
  fuelUsed: number
  heading: number
}

export const resolveSpacecraftControlStep = (
  spacecraft: Spacecraft,
  state: Pick<SimulationState, 'controls'>,
  dt: number,
): SpacecraftControlStep => {
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

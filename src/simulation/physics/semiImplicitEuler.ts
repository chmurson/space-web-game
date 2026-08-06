import { G } from '../constants'
import type { Body, PhysicsEngine } from '../types'
import { add, lengthSq, scale, sub, type Vec2, vec } from '../vector'
import { resolveSpacecraftControlStep } from './spacecraftControls'

const SOFTENING = 1_000

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

    const thrust = resolveSpacecraftControlStep(state.spacecraft, state, dt)
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

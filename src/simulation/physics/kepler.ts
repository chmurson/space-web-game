import { propagateKeplerTwoBody } from '../../prediction/keplerTwoBody'
import type { Body, PhysicsEngine, SimulationState } from '../types'
import { add, scale } from '../vector'
import { resolveSpacecraftControlStep } from './spacecraftControls'

const getSupportedBody = (state: SimulationState): Body => {
  const body = state.bodies[0]
  if (state.bodies.length !== 1 || !body || body.mass <= 0) {
    throw new Error('The Kepler engine requires exactly one massive body.')
  }
  return body
}

export const kepler: PhysicsEngine = {
  name: 'Kepler two-body',
  validateState: (state) => {
    getSupportedBody(state)
  },
  step(state, dt) {
    const body = getSupportedBody(state)

    const controlStep = resolveSpacecraftControlStep(
      state.spacecraft,
      state,
      dt,
    )
    const controlledSpacecraft = {
      ...state.spacecraft,
      angularVelocity: controlStep.angularVelocity,
      fuel: controlStep.fuel,
      fuelUsed: controlStep.fuelUsed,
      heading: controlStep.heading,
      velocity: add(
        state.spacecraft.velocity,
        scale(controlStep.acceleration, dt),
      ),
    }
    const propagatedSpacecraft = propagateKeplerTwoBody(
      body,
      controlledSpacecraft,
      dt,
    )

    return {
      ...state,
      bodies: [
        {
          ...body,
          // Keep this linear drift and unchanged body velocity aligned with
          // propagateKeplerTwoBody.
          position: add(body.position, scale(body.velocity, dt)),
        },
      ],
      elapsed: state.elapsed + dt,
      spacecraft: {
        ...controlledSpacecraft,
        position: propagatedSpacecraft.position,
        velocity: propagatedSpacecraft.velocity,
      },
    }
  },
}

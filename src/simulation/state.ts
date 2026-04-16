import type { Body, ControlInput, SimulationState, Spacecraft } from './types'

export const idleControls = (): ControlInput => ({
  main: 0,
  reverse: 0,
  strafe: 0,
  turn: 0,
})

export const cloneBody = (body: Body): Body => ({
  ...body,
  position: { ...body.position },
  velocity: { ...body.velocity },
})

export const cloneBodies = (bodies: Body[]): Body[] => bodies.map(cloneBody)

export const cloneSpacecraft = (spacecraft: Spacecraft): Spacecraft => ({
  ...spacecraft,
  position: { ...spacecraft.position },
  velocity: { ...spacecraft.velocity },
})

export const cloneControls = (controls: ControlInput): ControlInput => ({
  ...controls,
})

export const cloneSimulationState = (
  state: SimulationState,
  controls: ControlInput = idleControls(),
): SimulationState => ({
  elapsed: state.elapsed,
  controls: cloneControls(controls),
  bodies: cloneBodies(state.bodies),
  spacecraft: cloneSpacecraft(state.spacecraft),
})

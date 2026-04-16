import type { Vec2 } from './vector'

export type Body = {
  id: string
  name: string
  mass: number
  radius: number
  position: Vec2
  velocity: Vec2
  color: string
}

export type Spacecraft = {
  position: Vec2
  velocity: Vec2
  heading: number
  fuel: number
  fuelUsed: number
  dryMass: number
  fuelMass: number
  fuelCapacity: number
}

export type ControlInput = {
  main: number
  reverse: number
  strafe: number
  turn: number
}

export type Scenario = {
  id: string
  name: string
  description: string
  bodies: Body[]
  spacecraft: Spacecraft
}

export type SimulationState = {
  elapsed: number
  bodies: Body[]
  spacecraft: Spacecraft
  controls: ControlInput
}

export type PhysicsEngine = {
  name: string
  step(state: SimulationState, dt: number): SimulationState
}

import type { PhysicsEngine } from '../types'
import { kepler } from './kepler'
import { semiImplicitEuler } from './semiImplicitEuler'

export const physicsEngines = {
  kepler,
  'semi-implicit-euler': semiImplicitEuler,
} satisfies Record<string, PhysicsEngine>

export const defaultPhysicsEngine = semiImplicitEuler

export const resolvePhysicsEngine = (requestedEngine: string): PhysicsEngine =>
  Object.hasOwn(physicsEngines, requestedEngine)
    ? physicsEngines[requestedEngine as keyof typeof physicsEngines]
    : defaultPhysicsEngine

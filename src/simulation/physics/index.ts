import type { PhysicsEngine } from '../types'
import { kepler } from './kepler'
import { semiImplicitEuler } from './semiImplicitEuler'

export const physicsEngines: Record<string, PhysicsEngine> = {
  kepler,
  'semi-implicit-euler': semiImplicitEuler,
}

export const defaultPhysicsEngine = semiImplicitEuler

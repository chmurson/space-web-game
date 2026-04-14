import type { PhysicsEngine } from "../types";
import { semiImplicitEuler } from "./semiImplicitEuler";

export const physicsEngines: Record<string, PhysicsEngine> = {
	"semi-implicit-euler": semiImplicitEuler,
};

export const defaultPhysicsEngine = semiImplicitEuler;

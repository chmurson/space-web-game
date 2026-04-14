import { G } from "../constants";
import type {
	Body,
	PhysicsEngine,
	SimulationState,
	Spacecraft,
} from "../types";
import {
	add,
	fromAngle,
	lengthSq,
	scale,
	sub,
	vec,
	type Vec2,
} from "../vector";

const MAIN_THRUST = 120_000;
const REVERSE_THRUST = 35_000;
const STRAFE_THRUST = 25_000;
const ROTATION_RATE = 0.9;
const FUEL_FLOW = 7;
const SOFTENING = 1_000;
const normalizeAngle = (angle: number) =>
	Math.atan2(Math.sin(angle), Math.cos(angle));

const gravityAt = (
	position: Vec2,
	bodies: Body[],
	ignoredBodyId?: string,
): Vec2 => {
	let acceleration = vec();

	for (const body of bodies) {
		if (body.id === ignoredBodyId) {
			continue;
		}

		const offset = sub(body.position, position);
		const distanceSquared = lengthSq(offset) + SOFTENING * SOFTENING;
		const distance = Math.sqrt(distanceSquared);
		const accelerationMagnitude = (G * body.mass) / distanceSquared;
		acceleration = add(
			acceleration,
			scale(offset, accelerationMagnitude / distance),
		);
	}

	return acceleration;
};

const spacecraftThrustAcceleration = (
	spacecraft: Spacecraft,
	state: SimulationState,
	dt: number,
) => {
	const { controls } = state;
	const fuelAvailable = spacecraft.fuel > 0;
	const heading = normalizeAngle(
		spacecraft.heading + controls.turn * ROTATION_RATE * dt,
	);

	const forward = fromAngle(heading);
	const right = { x: forward.y, y: -forward.x };
	const throttleFuelUse =
		Math.abs(controls.main) * FUEL_FLOW +
		Math.abs(controls.reverse) * FUEL_FLOW * 0.4 +
		Math.abs(controls.strafe) * FUEL_FLOW * 0.35;
	const fuelUsed = throttleFuelUse * dt;
	const fuelRatio = fuelAvailable || throttleFuelUse === 0 ? 1 : 0;
	const mass = spacecraft.dryMass + spacecraft.fuelMass * spacecraft.fuel;
	const forwardForce =
		MAIN_THRUST * controls.main - REVERSE_THRUST * controls.reverse;
	const strafeForce = STRAFE_THRUST * controls.strafe;

	return {
		acceleration: add(
			scale(forward, (forwardForce / mass) * fuelRatio),
			scale(right, (strafeForce / mass) * fuelRatio),
		),
		fuel: spacecraft.fuel,
		fuelUsed: spacecraft.fuelUsed + fuelUsed,
		heading,
	};
};

export const semiImplicitEuler: PhysicsEngine = {
	name: "Semi-implicit Euler",
	step(state, dt) {
		const bodies = state.bodies.map((body) => {
			const acceleration = gravityAt(body.position, state.bodies, body.id);
			const velocity = add(body.velocity, scale(acceleration, dt));

			return {
				...body,
				velocity,
				position: add(body.position, scale(velocity, dt)),
			};
		});

		const thrust = spacecraftThrustAcceleration(state.spacecraft, state, dt);
		const gravity = gravityAt(state.spacecraft.position, bodies);
		const velocity = add(
			state.spacecraft.velocity,
			scale(add(gravity, thrust.acceleration), dt),
		);

		return {
			...state,
			elapsed: state.elapsed + dt,
			bodies,
			spacecraft: {
				...state.spacecraft,
				heading: thrust.heading,
				fuel: thrust.fuel,
				fuelUsed: thrust.fuelUsed,
				velocity,
				position: add(state.spacecraft.position, scale(velocity, dt)),
			},
		};
	},
};

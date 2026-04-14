import * as THREE from "three";

export type Ripple = {
	age: number;
	element: HTMLElement;
};

export const createRipple = (
	parent: HTMLElement,
	ripples: Ripple[],
	screenX: number,
	screenY: number,
) => {
	const ripple = document.createElement("div");
	ripple.className = "map-ripple";
	ripple.style.left = `${screenX}px`;
	ripple.style.top = `${screenY}px`;
	ripple.innerHTML = "<span></span><span></span><span></span>";
	parent.appendChild(ripple);
	ripples.push({ element: ripple, age: 0 });
};

export const updateRipples = (ripples: Ripple[], dt: number) => {
	const maxAge = 1.15;

	for (let index = ripples.length - 1; index >= 0; index -= 1) {
		const ripple = ripples[index];
		ripple.age += dt;
		const progress = ripple.age / maxAge;
		const rings = Array.from(ripple.element.children) as HTMLElement[];

		for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
			const ring = rings[ringIndex];
			const delayedProgress = THREE.MathUtils.clamp(
				progress - ringIndex * 0.14,
				0,
				1,
			);
			ring.style.opacity = `${Math.max(0, 0.62 * (1 - delayedProgress))}`;
			ring.style.transform = `scale(${1 + delayedProgress * 4.33})`;
		}

		if (ripple.age >= maxAge) {
			ripple.element.remove();
			ripples.splice(index, 1);
		}
	}
};

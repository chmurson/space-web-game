import * as THREE from 'three'

import { RENDER_SCALE } from '../simulation/constants'
import type { Vec2 } from '../simulation/vector'

export type Ripple = {
  age: number
  element: HTMLElement
  worldPosition?: Vec2
}

export const createRipple = (
  parent: HTMLElement,
  ripples: Ripple[],
  screenX: number,
  screenY: number,
  worldPosition?: Vec2 | null,
) => {
  const ripple = document.createElement('div')
  ripple.className = 'map-ripple'
  ripple.style.left = `${screenX}px`
  ripple.style.top = `${screenY}px`
  ripple.innerHTML = '<span></span><span></span><span></span>'
  parent.appendChild(ripple)
  ripples.push({
    element: ripple,
    age: 0,
    worldPosition: worldPosition ? { ...worldPosition } : undefined,
  })
}

const projectWorldPositionToScreen = (
  camera: THREE.Camera,
  worldPosition: Vec2,
) => {
  const position = new THREE.Vector3(
    worldPosition.x * RENDER_SCALE,
    1.2,
    worldPosition.y * RENDER_SCALE,
  )
  position.project(camera)

  return {
    x: (position.x * 0.5 + 0.5) * window.innerWidth,
    y: (-position.y * 0.5 + 0.5) * window.innerHeight,
  }
}

export const updateRipples = (
  ripples: Ripple[],
  dt: number,
  options?: { camera: THREE.Camera },
) => {
  const maxAge = 1.15

  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index]
    ripple.age += dt
    const progress = ripple.age / maxAge
    const rings = Array.from(ripple.element.children) as HTMLElement[]

    if (ripple.worldPosition && options?.camera) {
      const screenPosition = projectWorldPositionToScreen(
        options.camera,
        ripple.worldPosition,
      )
      ripple.element.style.left = `${screenPosition.x}px`
      ripple.element.style.top = `${screenPosition.y}px`
    }

    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      const ring = rings[ringIndex]
      const delayedProgress = THREE.MathUtils.clamp(
        progress - ringIndex * 0.14,
        0,
        1,
      )
      ring.style.opacity = `${Math.max(0, 0.62 * (1 - delayedProgress))}`
      ring.style.transform = `scale(${1 + delayedProgress * 4.33})`
    }

    if (ripple.age >= maxAge) {
      ripple.element.remove()
      ripples.splice(index, 1)
    }
  }
}

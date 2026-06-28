import type { Scenario } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'

export type ScenarioRenderConfig = {
  /**
   * Direction sunlight travels across the simulation plane. With the default
   * camera, `{ x: 0, y: -1 }` reads as bottom-left toward top-right.
   */
  sunlightDirection: Vec2
}

export const defaultScenarioSunlightDirection: Readonly<Vec2> = {
  x: 0,
  y: -1,
}

const normalizeDirection = (direction: Vec2 | undefined): Vec2 => {
  const x = direction?.x ?? defaultScenarioSunlightDirection.x
  const y = direction?.y ?? defaultScenarioSunlightDirection.y
  const length = Math.hypot(x, y)

  if (!Number.isFinite(length) || length <= 0) {
    return { ...defaultScenarioSunlightDirection }
  }

  return {
    x: x / length,
    y: y / length,
  }
}

export const resolveScenarioRenderConfig = (
  render: Scenario['render'] | undefined,
): ScenarioRenderConfig => ({
  sunlightDirection: normalizeDirection(render?.sunlightDirection),
})

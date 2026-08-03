import { EARTH_VIEWPORT_SIZE } from '../../domain/viewportPresets'
import { G } from '../../simulation/constants'
import { createEarthMoonScenario } from '../../simulation/scenarios/earthMoon'
import type { RuntimeScenarioDefinition } from '../scenarioRegistry'
import { createRuntimeScenarioSession } from '../scenarioSession'

type MenuBackgroundScenarioState = {
  cameraFollowBodyId: 'earth'
  cameraFollowOffsetX: number
  cameraFollowOffsetY: number
  hiddenBodyIds: [] | ['moon']
}

type MenuBackgroundScenarioId = 'menu-background' | 'menu-background-kepler'

export const registerMenuBackgroundScenario = (
  scenarioId: MenuBackgroundScenarioId = 'menu-background',
): RuntimeScenarioDefinition<MenuBackgroundScenarioState> => ({
  id: scenarioId,
  getSceneDefinition: () => ({
    directives: () => ({
      hiddenUIElements: new Set(['timeWarpPill']),
    }),
  }),
  createScenario: () => {
    const scenario = createEarthMoonScenario()
    const singleBody = scenarioId === 'menu-background-kepler'
    const bodies = singleBody
      ? scenario.bodies.filter((body) => body.id === 'earth')
      : scenario.bodies
    const earth = bodies.find((body) => body.id === 'earth')
    const hiddenBodyIds: MenuBackgroundScenarioState['hiddenBodyIds'] =
      singleBody ? [] : ['moon']

    if (!earth) {
      return {
        ...scenario,
        bodies,
        id: scenarioId,
        name: 'Menu background',
        scenarioSession: createRuntimeScenarioSession(scenarioId),
      }
    }

    const orbitRadius = earth.radius + 1_000_000
    const orbitSpeed = Math.sqrt((G * earth.mass) / orbitRadius) * 1.01

    return {
      ...scenario,
      bodies,
      id: scenarioId,
      name: 'Menu background',
      viewportSize: EARTH_VIEWPORT_SIZE,
      scenarioSession: createRuntimeScenarioSession(scenarioId, {
        cameraFollowBodyId: 'earth',
        cameraFollowOffsetX: 4_000_000,
        cameraFollowOffsetY: 4_000_000,
        hiddenBodyIds,
      }),
      spacecraft: {
        ...scenario.spacecraft,
        heading: Math.PI / 2,
        position: {
          x: earth.position.x + orbitRadius,
          y: earth.position.y,
        },
        velocity: {
          x: earth.velocity.x,
          y: earth.velocity.y + orbitSpeed,
        },
      },
    }
  },
})

import { describe, expect, it } from 'vitest'

import {
  defaultScenarioSunlightDirection,
  resolveScenarioRenderConfig,
} from '@/scenario/scenarioRenderConfig'
import { createEarthMoonScenario } from '@/simulation/scenarios/earthMoon'

describe('scenarioRenderConfig', () => {
  it('defaults sunlight to bottom-left toward top-right for the current camera', () => {
    expect(resolveScenarioRenderConfig(undefined).sunlightDirection).toEqual(
      defaultScenarioSunlightDirection,
    )
  })

  it('normalizes configured scenario sunlight direction', () => {
    expect(
      resolveScenarioRenderConfig({
        sunlightDirection: { x: 3, y: 4 },
      }).sunlightDirection,
    ).toEqual({
      x: 0.6,
      y: 0.8,
    })
  })

  it('falls back to the default when scenario direction is invalid', () => {
    expect(
      resolveScenarioRenderConfig({
        sunlightDirection: { x: 0, y: 0 },
      }).sunlightDirection,
    ).toEqual(defaultScenarioSunlightDirection)
  })

  it('allows Earth-Moon scenarios to carry render-only sunlight config', () => {
    expect(
      createEarthMoonScenario({
        render: {
          sunlightDirection: { x: 1, y: 0 },
        },
      }).render,
    ).toEqual({
      sunlightDirection: { x: 1, y: 0 },
    })
  })
})

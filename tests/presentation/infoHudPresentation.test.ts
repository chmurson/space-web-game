import { describe, expect, it } from 'vitest'

import { createInfoHudView } from '@/presentation/infoHudPresentation'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import {
  apoapsisInfoPin,
  createBodyInfoPin,
  periapsisInfoPin,
} from '@/runtime/infoPins'
import type { TrajectoryPredictionState } from '@/runtime/trajectoryPredictionRuntime'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'

const runtime: AppRuntimeState = {
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
  },
  info: {
    userPins: [createBodyInfoPin('moon'), apoapsisInfoPin],
  },
  scenario: {
    directives: {
      ...createDefaultScenarioDirectives(),
      infoPins: [createBodyInfoPin('earth'), periapsisInfoPin],
    },
    metadata: { description: 'Test', title: 'Test' },
    session: createRuntimeScenarioSession('test'),
  },
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 1,
    assistTargetSelectionMode: 'manual',
    coastPredictionHorizonHours: 1,
    crashedBodyName: null,
    state: {
      bodies: [
        {
          color: '#fff',
          id: 'earth',
          mass: 1,
          name: 'Earth',
          position: { x: 0, y: 0 },
          radius: 1_000,
          velocity: { x: 0, y: 0 },
        },
        {
          color: '#fff',
          id: 'moon',
          mass: 1,
          name: 'Moon',
          position: { x: 100_000, y: 0 },
          radius: 1_000,
          velocity: { x: 0, y: 0 },
        },
      ],
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
      elapsed: 0,
      spacecraft: {
        dryMass: 1,
        fuel: 0,
        fuelCapacity: 0,
        fuelMass: 0,
        fuelUsed: 0,
        heading: 0,
        position: { x: 11_000, y: 0 },
        velocity: { x: 0, y: 0 },
      },
    },
    targetHeading: null,
    targetHeadingTurn: null,
    timeWarpIndex: 0,
    viewportSize: 100,
  },
  ui: {
    camera: { follow: 'spacecraft', panOffset: { x: 0, y: 0 } },
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
}

const prediction: TrajectoryPredictionState = {
  absolutePredictionEnd: null,
  absolutePredictionPoints: [],
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  targetId: 'moon',
  targetRelativeAssistedPoints: [],
  targetRelativeEventMarkers: [
    {
      altitude: 123_000,
      distance: 124_000,
      kind: 'periapsis',
      point: { x: 0, y: 0 },
      time: 1,
    },
    {
      altitude: 456_000,
      distance: 457_000,
      kind: 'apoapsis',
      point: { x: 0, y: 0 },
      time: 2,
    },
  ],
  targetRelativePredictionEnd: null,
  targetRelativePredictionPoints: [],
}

const queries = {
  getAssistTargetUiState: () => ({
    activeTarget: runtime.simulation.state.bodies[1],
    mode: 'manual' as const,
    recommendedTarget: null,
  }),
}

describe('createInfoHudView', () => {
  it('presents each body once and uses physical surface distances', () => {
    const view = createInfoHudView({ prediction, queries, runtime })
    const rows = view.entries.map((entry) => entry.row)

    expect(rows.map(({ label }) => label)).toEqual(['Moon', 'Earth', 'Pe / Ap'])
    expect(rows.map(({ distanceLabel }) => distanceLabel)).toEqual([
      '88 km',
      '10 km',
      '120 km | 460 km',
    ])
    expect(rows.map(({ secondaryLabel }) => secondaryLabel)).toEqual([
      'to spacecraft',
      'to spacecraft',
      'to Moon',
    ])
    expect(view.entries.map(({ key }) => key)).toEqual([
      'body:moon',
      'body:earth',
      'apsides',
    ])
    expect(
      rows.filter(({ pinned }) => pinned).map(({ label }) => label),
    ).toEqual(['Moon', 'Earth', 'Pe / Ap'])
    expect(rows.find(({ label }) => label === 'Earth')).toMatchObject({
      pinned: true,
      scenarioOwned: true,
    })
    expect(rows.find(({ label }) => label === 'Moon')).toMatchObject({
      pinned: true,
      scenarioOwned: false,
    })
    expect(rows.find(({ key }) => key === 'apsides')).toMatchObject({
      pinned: true,
      scenarioOwned: true,
    })
    expect(
      view.entries.find((entry) => entry.kind === 'apsides'),
    ).toMatchObject({
      points: [
        { distanceLabel: '120 km', label: 'Pe' },
        { distanceLabel: '460 km', label: 'Ap' },
      ],
    })
    expect(view.clearAvailable).toBe(true)
    expect(view.targetMode).toBe('manual')
  })

  it('orders target, selected entries, then remaining entries by target distance', () => {
    const orderedRuntime = structuredClone(runtime)
    orderedRuntime.scenario.directives.infoPins = []
    orderedRuntime.info.userPins = [createBodyInfoPin('earth')]
    orderedRuntime.simulation.state.bodies.push({
      color: '#f59e0b',
      id: 'station',
      mass: 1,
      name: 'Station',
      position: { x: 130_000, y: 0 },
      radius: 1_000,
      velocity: { x: 0, y: 0 },
    })

    const view = createInfoHudView({
      prediction,
      queries: {
        getAssistTargetUiState: () => ({
          activeTarget: orderedRuntime.simulation.state.bodies[1],
          mode: 'manual' as const,
          recommendedTarget: null,
        }),
      },
      runtime: orderedRuntime,
    })

    expect(view.entries.map(({ key }) => key)).toEqual([
      'body:moon',
      'body:earth',
      'body:station',
      'apsides',
    ])
    expect(view.entries[0]).toMatchObject({
      bodyColor: '#fff',
      kind: 'body',
      target: true,
      row: {
        key: 'body:moon',
        pinned: false,
      },
    })
  })

  it('keeps body selections attached to identity when the target changes', () => {
    const targetRuntime = structuredClone(runtime)
    targetRuntime.scenario.directives.infoPins = []
    targetRuntime.info.userPins = [createBodyInfoPin('earth')]
    let targetIndex = 1
    const targetQueries = {
      getAssistTargetUiState: () => ({
        activeTarget: targetRuntime.simulation.state.bodies[targetIndex],
        mode: 'manual' as const,
        recommendedTarget: null,
      }),
    }

    const moonTargetView = createInfoHudView({
      prediction,
      queries: targetQueries,
      runtime: targetRuntime,
    })
    targetIndex = 0
    const earthTargetView = createInfoHudView({
      prediction: { ...prediction, targetId: 'earth' },
      queries: targetQueries,
      runtime: targetRuntime,
    })

    expect(moonTargetView.entries[0]).toMatchObject({
      key: 'body:moon',
      target: true,
      row: { pinned: false },
    })
    expect(earthTargetView.entries[0]).toMatchObject({
      key: 'body:earth',
      target: true,
      row: { pinned: true },
    })
    expect(targetRuntime.info.userPins).toEqual([createBodyInfoPin('earth')])
  })

  it('does not present stale Pe and Ap values for another target', () => {
    const view = createInfoHudView({
      prediction: { ...prediction, targetId: 'earth' },
      queries,
      runtime,
    })

    expect(
      view.entries.find((entry) => entry.kind === 'apsides'),
    ).toMatchObject({
      points: [
        { distanceLabel: '—', label: 'Pe' },
        { distanceLabel: '—', label: 'Ap' },
      ],
    })
  })
})

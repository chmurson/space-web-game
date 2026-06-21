import type { RuntimeScenario } from '../../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../../domain/viewportPresets'
import type { AppRuntimeState } from '../../runtime/appRuntimeState'
import { createEarthMoonScenario } from '../../simulation/scenarios/earthMoon'
import {
  advanceScenarioOrbitProgress,
  createScenarioOrbitProgressState,
  isWithinScenarioObjectiveRadius,
  type ScenarioOrbitProgressState,
} from '../scenarioObjectiveProgress'
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
} from '../scenarioDirectiveTypes'
import type {
  RuntimeScenarioDefinition,
  ScenarioSceneDefinition,
} from '../scenarioRegistry'
import type { ScenarioRuntimeTransition } from '../scenarioRuntimeTransition'
import {
  createRuntimeScenarioSession,
  type ScenarioSessionValue,
} from '../scenarioSession'

const reachMoonFuelCapacity = 32_000
const requiredMoonOrbitTurns = 3
const requiredEarthOrbitTurns = 1
const moonObjectiveRadiusMultiplier = 35
const earthObjectiveRadiusMultiplier = 20

type ReachMoonScenarioPhase =
  | 'reach-moon'
  | 'orbit-moon'
  | 'return-earth'
  | 'orbit-earth'
  | 'complete'

type ReachMoonApproachState = {
  phase: 'reach-moon'
}

type OrbitMoonState = {
  phase: 'orbit-moon'
} & ScenarioOrbitProgressState

type ReturnEarthState = {
  phase: 'return-earth'
}

type OrbitEarthState = {
  phase: 'orbit-earth'
} & ScenarioOrbitProgressState

type CompleteReachMoonState = {
  phase: 'complete'
}

type ReachMoonScenarioState =
  | ReachMoonApproachState
  | OrbitMoonState
  | ReturnEarthState
  | OrbitEarthState
  | CompleteReachMoonState

const createInitialReachMoonScenarioState = (): ReachMoonApproachState => ({
  phase: 'reach-moon',
})

const isReachMoonScenarioPhase = (
  value: ScenarioSessionValue,
): value is ReachMoonScenarioPhase =>
  value === 'reach-moon' ||
  value === 'orbit-moon' ||
  value === 'return-earth' ||
  value === 'orbit-earth' ||
  value === 'complete'

const isReachMoonScenarioState = (
  value: unknown,
): value is ReachMoonScenarioState => {
  if (!value || typeof value !== 'object' || !('phase' in value)) {
    return false
  }

  return isReachMoonScenarioPhase(value.phase as ScenarioSessionValue)
}

const createReachMoonScenario = (): RuntimeScenario => {
  const scenario = createEarthMoonScenario({
    fuelCapacity: reachMoonFuelCapacity,
  })

  return {
    ...scenario,
    id: 'reach-moon',
    name: 'Reach the Moon',
    description: 'Launch from Earth into the Earth-Moon mission route.',
    scenarioSession: createRuntimeScenarioSession(
      'reach-moon',
      createInitialReachMoonScenarioState(),
    ),
  }
}

const createReachMoonTransition = (
  state: ReachMoonScenarioState,
  options: {
    completed?: boolean
  } = {},
): ScenarioRuntimeTransition<ReachMoonScenarioState> => ({
  completed: options.completed,
  nextState: state,
})

const getObjectiveRadiusMultiplier = (targetId: 'earth' | 'moon') =>
  targetId === 'earth'
    ? earthObjectiveRadiusMultiplier
    : moonObjectiveRadiusMultiplier

const isWithinObjectiveDistance = (
  runtime: AppRuntimeState,
  targetId: 'earth' | 'moon',
) =>
  isWithinScenarioObjectiveRadius(runtime, {
    radiusMultiplier: getObjectiveRadiusMultiplier(targetId),
    targetId,
  })

const advanceOrbitProgress = <TState extends OrbitMoonState | OrbitEarthState>(
  runtime: AppRuntimeState,
  state: TState,
  targetId: 'earth' | 'moon',
  requiredTurns: number,
): ScenarioRuntimeTransition<ReachMoonScenarioState> | null => {
  const orbitProgress = advanceScenarioOrbitProgress(runtime, state, {
    maxRadiusMultiplier: getObjectiveRadiusMultiplier(targetId),
    requiredTurns,
    targetId,
  })
  if (!orbitProgress) {
    return null
  }

  return createReachMoonTransition(orbitProgress.state, {
    completed: orbitProgress.completed,
  })
}

const createMissionDirectives = (): RuntimeScenarioDirectives => ({
  ...createDefaultScenarioDirectives(),
  maxCoastPredictionHorizonHours: 24,
  maxTimeWarp: 2000,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
})

type ReachMoonSceneDefinitionMap = {
  [TPhase in ReachMoonScenarioState['phase']]: ScenarioSceneDefinition<
    Extract<ReachMoonScenarioState, { phase: TPhase }>,
    ReachMoonScenarioState
  >
}

const reachMoonSceneDefinitions: ReachMoonSceneDefinitionMap = {
  'reach-moon': {
    advance: ({ runtime }) =>
      isWithinObjectiveDistance(runtime, 'moon')
        ? createReachMoonTransition({
            phase: 'orbit-moon',
            ...createScenarioOrbitProgressState(),
          })
        : null,
    directives: createMissionDirectives,
  },
  'orbit-moon': {
    advance: ({ runtime, state }) => {
      const orbitProgress = advanceOrbitProgress(
        runtime,
        state,
        'moon',
        requiredMoonOrbitTurns,
      )
      if (!orbitProgress?.completed) {
        return orbitProgress
      }

      return createReachMoonTransition({
        phase: 'return-earth',
      })
    },
    directives: createMissionDirectives,
  },
  'return-earth': {
    advance: ({ runtime }) =>
      isWithinObjectiveDistance(runtime, 'earth')
        ? createReachMoonTransition({
            phase: 'orbit-earth',
            ...createScenarioOrbitProgressState(),
          })
        : null,
    directives: createMissionDirectives,
  },
  'orbit-earth': {
    advance: ({ runtime, state }) => {
      const orbitProgress = advanceOrbitProgress(
        runtime,
        state,
        'earth',
        requiredEarthOrbitTurns,
      )
      if (!orbitProgress?.completed) {
        return orbitProgress
      }

      return createReachMoonTransition(
        {
          phase: 'complete',
        },
        { completed: true },
      )
    },
    directives: createMissionDirectives,
  },
  complete: {
    directives: () => createDefaultScenarioDirectives(),
  },
}

const getReachMoonSceneDefinition = <TState extends ReachMoonScenarioState>(
  state: TState,
): ScenarioSceneDefinition<TState> =>
  reachMoonSceneDefinitions[
    state.phase
  ] as unknown as ScenarioSceneDefinition<TState>

export const registerReachMoonScenario =
  (): RuntimeScenarioDefinition<ReachMoonScenarioState> => ({
    id: 'reach-moon',
    createScenario: createReachMoonScenario,
    getSceneDefinition: getReachMoonSceneDefinition,
    isState: isReachMoonScenarioState,
  })

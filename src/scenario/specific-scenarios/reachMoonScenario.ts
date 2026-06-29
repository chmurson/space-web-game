import type { RuntimeScenario } from '../../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../../domain/viewportPresets'
import type { AppRuntimeState } from '../../runtime/appRuntimeState'
import { createEarthMoonScenario } from '../../simulation/scenarios/earthMoon'
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
} from '../scenarioDirectiveTypes'
import {
  advanceScenarioOrbitProgress,
  createScenarioOrbitProgressState,
  isWithinScenarioObjectiveRadius,
  type ScenarioOrbitProgressState,
} from '../scenarioObjectiveProgress'
import type { PromptDefinition } from '../scenarioPromptTypes'
import type {
  RuntimeScenarioDefinition,
  ScenarioSceneDefinition,
} from '../scenarioRegistry'
import type { ScenarioRuntimeTransition } from '../scenarioRuntimeTransition'
import {
  createRuntimeScenarioSession,
  type ScenarioPromptUiState,
  type ScenarioSessionValue,
} from '../scenarioSession'
import type { ReachMoonHighscoreSubmitInput } from './reachMoonHighscores'
import {
  calculateReachMoonScore,
  formatReachMoonScoreSummary,
  isReachMoonScoreSummary,
  REACH_MOON_FUEL_CAPACITY_KG,
  type ReachMoonScoreSummary,
} from './reachMoonScore'

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

type ReachMoonPromptId =
  | 'mission-start'
  | 'moon-reached'
  | 'lunar-orbits-complete'
  | 'earth-reached'
  | 'mission-complete'

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
  highscore?: ReachMoonCompletedHighscorePayload
  score?: ReachMoonScoreSummary
}

type ReachMoonScenarioState =
  | ReachMoonApproachState
  | OrbitMoonState
  | ReturnEarthState
  | OrbitEarthState
  | CompleteReachMoonState

export type ReachMoonCompletedHighscorePayload = {
  input: ReachMoonHighscoreSubmitInput
  score: ReachMoonScoreSummary
}

const createInitialReachMoonScenarioState = (): ReachMoonApproachState => ({
  phase: 'reach-moon',
})

const createReachMoonScenarioSession = () =>
  createRuntimeScenarioSession(
    'reach-moon',
    createInitialReachMoonScenarioState(),
    {
      activePromptId: 'mission-start',
      replayPromptId: null,
    },
  )

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
    fuelCapacity: REACH_MOON_FUEL_CAPACITY_KG,
  })

  return {
    ...scenario,
    id: 'reach-moon',
    name: 'Reach the Moon',
    description: 'Launch from Earth into the Earth-Moon mission route.',
    scenarioSession: createReachMoonScenarioSession(),
  }
}

const createReachMoonTransition = (
  state: ReachMoonScenarioState,
  options: {
    completed?: boolean
    promptUi?: ScenarioPromptUiState
  } = {},
): ScenarioRuntimeTransition<ReachMoonScenarioState> => ({
  completed: options.completed,
  nextState: state,
  promptUi: options.promptUi,
})

const createPromptUiWithActivePrompt = (
  runtime: AppRuntimeState,
  activePromptId: ReachMoonPromptId,
): ScenarioPromptUiState => ({
  ...runtime.scenario.session.promptUi,
  activePromptId,
})

const clampReachMoonFuelRatio = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

const normalizeMissionElapsedSeconds = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0

const createReachMoonCompletedHighscorePayload = (
  runtime: AppRuntimeState,
): ReachMoonCompletedHighscorePayload => {
  const input = {
    fuelRemainingRatio: clampReachMoonFuelRatio(
      runtime.simulation.state.spacecraft.fuel,
    ),
    missionElapsedSeconds: normalizeMissionElapsedSeconds(
      runtime.simulation.state.elapsed,
    ),
  }

  return {
    input,
    score: calculateReachMoonScore({
      fuelCapacityKg: runtime.simulation.state.spacecraft.fuelCapacity,
      ...input,
    }),
  }
}

const isReachMoonHighscoreSubmitInput = (
  value: unknown,
): value is ReachMoonHighscoreSubmitInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<keyof ReachMoonHighscoreSubmitInput, unknown>
  return (
    typeof record.fuelRemainingRatio === 'number' &&
    Number.isFinite(record.fuelRemainingRatio) &&
    record.fuelRemainingRatio >= 0 &&
    record.fuelRemainingRatio <= 1 &&
    typeof record.missionElapsedSeconds === 'number' &&
    Number.isFinite(record.missionElapsedSeconds) &&
    record.missionElapsedSeconds >= 0 &&
    (record.playerName === undefined ||
      record.playerName === null ||
      typeof record.playerName === 'string')
  )
}

const getLegacyHighscoreInputFromScore = (
  score: ReachMoonScoreSummary,
): ReachMoonHighscoreSubmitInput => ({
  fuelRemainingRatio: clampReachMoonFuelRatio(
    REACH_MOON_FUEL_CAPACITY_KG > 0
      ? score.fuelRemainingKg / REACH_MOON_FUEL_CAPACITY_KG
      : 0,
  ),
  missionElapsedSeconds: normalizeMissionElapsedSeconds(
    score.missionElapsedSeconds,
  ),
})

export const getReachMoonCompletedHighscorePayload = (
  runtime: AppRuntimeState,
): ReachMoonCompletedHighscorePayload | null => {
  if (runtime.scenario.session.scenarioId !== 'reach-moon') {
    return null
  }

  const state = runtime.scenario.session.state
  if (
    !state ||
    typeof state !== 'object' ||
    !('phase' in state) ||
    state.phase !== 'complete'
  ) {
    return null
  }

  const completeState = state as CompleteReachMoonState
  const score = isReachMoonScoreSummary(completeState.highscore?.score)
    ? completeState.highscore.score
    : isReachMoonScoreSummary(completeState.score)
      ? completeState.score
      : null
  if (!score) {
    return null
  }

  return {
    input: isReachMoonHighscoreSubmitInput(completeState.highscore?.input)
      ? completeState.highscore.input
      : getLegacyHighscoreInputFromScore(score),
    score,
  }
}

const getReachMoonCompletedScore = (
  runtime: AppRuntimeState,
): ReachMoonScoreSummary | null => {
  return getReachMoonCompletedHighscorePayload(runtime)?.score ?? null
}

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
        ? createReachMoonTransition(
            {
              phase: 'orbit-moon',
              ...createScenarioOrbitProgressState(),
            },
            {
              promptUi: createPromptUiWithActivePrompt(runtime, 'moon-reached'),
            },
          )
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

      return createReachMoonTransition(
        {
          phase: 'return-earth',
        },
        {
          promptUi: createPromptUiWithActivePrompt(
            runtime,
            'lunar-orbits-complete',
          ),
        },
      )
    },
    directives: createMissionDirectives,
  },
  'return-earth': {
    advance: ({ runtime }) =>
      isWithinObjectiveDistance(runtime, 'earth')
        ? createReachMoonTransition(
            {
              phase: 'orbit-earth',
              ...createScenarioOrbitProgressState(),
            },
            {
              promptUi: createPromptUiWithActivePrompt(
                runtime,
                'earth-reached',
              ),
            },
          )
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

      const highscore = createReachMoonCompletedHighscorePayload(runtime)

      return createReachMoonTransition(
        {
          phase: 'complete',
          highscore,
          score: highscore.score,
        },
        {
          completed: true,
          promptUi: createPromptUiWithActivePrompt(runtime, 'mission-complete'),
        },
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

const reachMoonPromptDefinitions = {
  'mission-start': {
    id: 'mission-start',
    title: 'Reach the Moon',
    shortLabel: 'Mission Brief',
    description: [
      'Launch from ',
      { text: 'Earth', tone: 'concept' },
      ', reach the ',
      { text: 'Moon', tone: 'concept' },
      ', complete ',
      { text: 'three lunar orbits', tone: 'number' },
      ', return to Earth, then complete one final Earth orbit. ',
      { text: 'Fuel is finite', tone: 'constraint' },
      ', so keep burns deliberate.',
    ],
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Start mission',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'moon-reached': {
    id: 'moon-reached',
    title: 'Moon Reached',
    shortLabel: 'Moon Orbit',
    description: [
      'You are inside the ',
      { text: 'lunar objective zone', tone: 'concept' },
      '. ',
      { text: 'Stay bound to the Moon', tone: 'constraint' },
      ' and complete ',
      { text: 'three full orbits', tone: 'number' },
      '.',
    ],
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'lunar-orbits-complete': {
    id: 'lunar-orbits-complete',
    title: 'Return to Earth',
    shortLabel: 'Return to Earth',
    description: [
      { text: 'Three lunar orbits', tone: 'number' },
      ' are complete. Head back toward ',
      { text: 'Earth', tone: 'concept' },
      ' and enter the ',
      { text: 'Earth objective zone', tone: 'concept' },
      '.',
    ],
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'earth-reached': {
    id: 'earth-reached',
    title: 'Earth Reached',
    shortLabel: 'Earth Orbit',
    description: [
      'You are back in ',
      { text: 'Earth', tone: 'concept' },
      ' range. Complete ',
      { text: 'one bound Earth orbit', tone: 'number' },
      ' to finish the mission.',
    ],
    buttons: [
      {
        action: { kind: 'builtin', id: 'dismiss_to_replay' },
        label: 'Continue',
        tone: 'primary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
  'mission-complete': {
    id: 'mission-complete',
    title: 'Mission Complete',
    shortLabel: 'Mission Complete',
    description: ({ runtime }) => {
      const score = getReachMoonCompletedScore(runtime)
      return score
        ? formatReachMoonScoreSummary(score)
        : [
            'You completed the ',
            { text: 'Earth-Moon route', tone: 'concept' },
            '. Continue to ',
            { text: 'highscores', tone: 'concept' },
            ' or start ',
            { text: 'free roam', tone: 'concept' },
            '.',
          ]
    },
    buttons: [
      {
        action: { kind: 'builtin', id: 'show_reach_moon_highscores' },
        label: 'Highscores',
        tone: 'primary',
      },
      {
        action: { kind: 'builtin', id: 'start_free_roam' },
        label: 'Free roam',
        tone: 'secondary',
      },
    ],
    presentation: { kind: 'blocking' },
  },
} satisfies Record<ReachMoonPromptId, PromptDefinition>

export const registerReachMoonScenario =
  (): RuntimeScenarioDefinition<ReachMoonScenarioState> => ({
    id: 'reach-moon',
    createScenario: createReachMoonScenario,
    getSceneDefinition: getReachMoonSceneDefinition,
    isState: isReachMoonScenarioState,
    prompts: reachMoonPromptDefinitions,
  })

import type { RuntimeScenario } from '../../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../../domain/viewportPresets'
import type {
  AppRuntimeState,
  RuntimeTransientNotice,
} from '../../runtime/appRuntimeState'
import { createEarthMoonScenario } from '../../simulation/scenarios/earthMoon'
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
} from '../scenarioDirectiveTypes'
import {
  advanceScenarioOrbitProgress,
  createScenarioOrbitProgressState,
  getScenarioTargetBody,
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
  calculateReachMoonOrbitQualityBreakdown,
  calculateReachMoonOrbitQualityPoints,
  calculateReachMoonScore,
  formatReachMoonOrbitAltitude,
  formatReachMoonScoreSummary,
  isReachMoonScoreSummary,
  MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS,
  MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS,
  MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS,
  REACH_MOON_FUEL_CAPACITY_KG,
  type ReachMoonOrbitQualityMetric,
  type ReachMoonScoreSummary,
} from './reachMoonScore'

const requiredMoonOrbitTurns = 3
const requiredEarthOrbitTurns = 1
const moonObjectiveRadiusMultiplier = 35
const earthObjectiveRadiusMultiplier = 20
const moonOrbitSafePeriapsisPromptText = `${formatReachMoonOrbitAltitude(
  MOON_ORBIT_SAFE_PERIAPSIS_ALTITUDE_METERS,
)} periapsis`

type ReachMoonScenarioPhase =
  | 'reach-moon'
  | 'orbit-moon'
  | 'return-earth'
  | 'orbit-earth'
  | 'complete'

type ReachMoonPromptId =
  | 'mission-start'
  | 'moon-reached'
  | 'safe-lunar-orbit-bonus'
  | 'lunar-orbits-complete'
  | 'earth-reached'
  | 'mission-complete'

type ReachMoonApproachState = {
  phase: 'reach-moon'
}

type OrbitMoonState = {
  bestLunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  currentOrbitApoapsisAltitudeMeters?: number
  currentOrbitPeriapsisAltitudeMeters?: number
  phase: 'orbit-moon'
} & ScenarioOrbitProgressState

type ReturnEarthState = {
  bestLunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  phase: 'return-earth'
}

type OrbitEarthState = {
  bestLunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
  phase: 'orbit-earth'
} & ScenarioOrbitProgressState

type CompleteReachMoonState = {
  bestLunarOrbitQuality?: ReachMoonOrbitQualityMetric | null
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
    transientNotice?: RuntimeTransientNotice | null
  } = {},
): ScenarioRuntimeTransition<ReachMoonScenarioState> => ({
  completed: options.completed,
  nextState: state,
  promptUi: options.promptUi,
  transientNotice: options.transientNotice,
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
  lunarOrbitQuality: ReachMoonOrbitQualityMetric | null | undefined,
): ReachMoonCompletedHighscorePayload => {
  const input = {
    fuelRemainingRatio: clampReachMoonFuelRatio(
      runtime.simulation.state.spacecraft.fuel,
    ),
    lunarOrbitQuality: lunarOrbitQuality ?? null,
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

const getMoonRelativeAltitude = (runtime: AppRuntimeState): number | null => {
  const moon = getScenarioTargetBody(runtime, 'moon')
  if (!moon) {
    return null
  }

  const { position } = runtime.simulation.state.spacecraft
  return Math.max(
    0,
    Math.hypot(position.x - moon.position.x, position.y - moon.position.y) -
      moon.radius,
  )
}

const withCurrentLunarOrbitAltitude = (
  runtime: AppRuntimeState,
  state: OrbitMoonState,
): OrbitMoonState => {
  const altitude = getMoonRelativeAltitude(runtime)
  if (altitude == null) {
    return state
  }

  return {
    ...state,
    currentOrbitApoapsisAltitudeMeters: Math.max(
      state.currentOrbitApoapsisAltitudeMeters ?? altitude,
      altitude,
    ),
    currentOrbitPeriapsisAltitudeMeters: Math.min(
      state.currentOrbitPeriapsisAltitudeMeters ?? altitude,
      altitude,
    ),
  }
}

const getLunarOrbitMetric = (
  state: OrbitMoonState,
): ReachMoonOrbitQualityMetric | null => {
  if (
    state.currentOrbitApoapsisAltitudeMeters == null ||
    state.currentOrbitPeriapsisAltitudeMeters == null
  ) {
    return null
  }

  return {
    orbitApoapsisAltitudeMeters: Math.round(
      state.currentOrbitApoapsisAltitudeMeters,
    ),
    orbitPeriapsisAltitudeMeters: Math.round(
      state.currentOrbitPeriapsisAltitudeMeters,
    ),
  }
}

const getBetterLunarOrbitMetric = (
  currentBest: ReachMoonOrbitQualityMetric | null | undefined,
  candidate: ReachMoonOrbitQualityMetric | null,
): ReachMoonOrbitQualityMetric | null | undefined => {
  if (!candidate) {
    return currentBest
  }
  if (
    !currentBest ||
    calculateReachMoonOrbitQualityPoints(candidate) >
      calculateReachMoonOrbitQualityPoints(currentBest)
  ) {
    return candidate
  }

  return currentBest
}

const createLunarOrbitQualityNotice = (
  previousBest: ReachMoonOrbitQualityMetric | null | undefined,
  best: ReachMoonOrbitQualityMetric | null | undefined,
  orbitTurnsCompleted: number,
): RuntimeTransientNotice | null => {
  if (!best || best === previousBest) {
    return null
  }

  const breakdown = calculateReachMoonOrbitQualityBreakdown(best)
  const points = breakdown.totalPoints
  const safe = breakdown.riskPenaltyPoints === 0
  const closeOrbit =
    breakdown.altitudeBonusPoints >= MOON_ORBIT_ALTITUDE_BONUS_MAX_POINTS * 0.7
  const nearCircular =
    breakdown.circularityBonusPoints >=
    MOON_ORBIT_CIRCULARITY_BONUS_MAX_POINTS * 0.8
  const title = !safe
    ? 'Risky lunar orbit recorded'
    : closeOrbit && nearCircular
      ? 'Excellent lunar orbit recorded'
      : nearCircular
        ? 'Circular lunar orbit recorded'
        : closeOrbit
          ? 'Close lunar orbit recorded'
          : points > 0
            ? 'Lunar orbit recorded'
            : null
  if (!title) {
    return null
  }

  const altitudeDetail = `Ap ${formatReachMoonOrbitAltitude(best.orbitApoapsisAltitudeMeters)} - Pe ${formatReachMoonOrbitAltitude(best.orbitPeriapsisAltitudeMeters)}`
  const orbitShapeDetail = nearCircular
    ? closeOrbit
      ? 'near circular'
      : 'higher than ideal'
    : closeOrbit
      ? 'elongated'
      : 'orbit quality improved'

  return {
    body: !safe
      ? `Pe ${formatReachMoonOrbitAltitude(best.orbitPeriapsisAltitudeMeters)} - too close to the Moon`
      : `${altitudeDetail} - ${orbitShapeDetail}`,
    id: `reach-moon-lunar-orbit-quality-${orbitTurnsCompleted}-${points}`,
    title,
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
  lunarOrbitQuality: score.lunarOrbitQuality ?? null,
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
            withCurrentLunarOrbitAltitude(runtime, {
              phase: 'orbit-moon',
              ...createScenarioOrbitProgressState(),
            }),
            {
              promptUi: createPromptUiWithActivePrompt(
                runtime,
                'safe-lunar-orbit-bonus',
              ),
            },
          )
        : null,
    directives: createMissionDirectives,
  },
  'orbit-moon': {
    advance: ({ runtime, state }) => {
      const sampledState = withCurrentLunarOrbitAltitude(runtime, state)
      const orbitProgress = advanceScenarioOrbitProgress(
        runtime,
        sampledState,
        {
          maxRadiusMultiplier: getObjectiveRadiusMultiplier('moon'),
          requiredTurns: requiredMoonOrbitTurns,
          targetId: 'moon',
        },
      )
      if (!orbitProgress) {
        return null
      }

      const completedNewTurn =
        orbitProgress.status === 'progressing' &&
        orbitProgress.state.orbitTurnsCompleted > state.orbitTurnsCompleted
      const completedMetric = completedNewTurn
        ? getLunarOrbitMetric(orbitProgress.state)
        : null
      const bestLunarOrbitQuality = completedNewTurn
        ? getBetterLunarOrbitMetric(
            state.bestLunarOrbitQuality,
            completedMetric,
          )
        : state.bestLunarOrbitQuality
      const altitude = getMoonRelativeAltitude(runtime)
      const resetCurrentOrbitAltitude =
        orbitProgress.status === 'reset' || completedNewTurn
      const nextState: OrbitMoonState = {
        ...orbitProgress.state,
        bestLunarOrbitQuality,
        currentOrbitApoapsisAltitudeMeters: resetCurrentOrbitAltitude
          ? (altitude ?? undefined)
          : orbitProgress.state.currentOrbitApoapsisAltitudeMeters,
        currentOrbitPeriapsisAltitudeMeters: resetCurrentOrbitAltitude
          ? (altitude ?? undefined)
          : orbitProgress.state.currentOrbitPeriapsisAltitudeMeters,
      }
      const transientNotice = completedNewTurn
        ? createLunarOrbitQualityNotice(
            state.bestLunarOrbitQuality,
            bestLunarOrbitQuality,
            orbitProgress.state.orbitTurnsCompleted,
          )
        : null

      if (!orbitProgress.completed) {
        return createReachMoonTransition(nextState, {
          ...(transientNotice ? { transientNotice } : {}),
        })
      }

      return createReachMoonTransition(
        {
          bestLunarOrbitQuality,
          phase: 'return-earth',
        },
        {
          promptUi: createPromptUiWithActivePrompt(
            runtime,
            'lunar-orbits-complete',
          ),
          ...(transientNotice ? { transientNotice } : {}),
        },
      )
    },
    directives: createMissionDirectives,
  },
  'return-earth': {
    advance: ({ runtime, state }) =>
      isWithinObjectiveDistance(runtime, 'earth')
        ? createReachMoonTransition(
            {
              bestLunarOrbitQuality: state.bestLunarOrbitQuality,
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

      const highscore = createReachMoonCompletedHighscorePayload(
        runtime,
        state.bestLunarOrbitQuality,
      )

      return createReachMoonTransition(
        {
          bestLunarOrbitQuality: state.bestLunarOrbitQuality,
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
  'safe-lunar-orbit-bonus': {
    id: 'safe-lunar-orbit-bonus',
    title: 'Close Lunar Orbit Bonus',
    shortLabel: 'Orbit Bonus',
    description: [
      'Close ',
      { text: 'lunar orbits', tone: 'concept' },
      ' can earn bonus points during this phase. Keep apoapsis low and the orbit near circular, but dipping below ',
      { text: moonOrbitSafePeriapsisPromptText, tone: 'constraint' },
      ' is risky and can cost points.',
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

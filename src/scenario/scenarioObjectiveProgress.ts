import { getCaptureMetricsForState } from '../assist/orbitalAssist'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { Body } from '../simulation/types'

export const fullTurnRadians = Math.PI * 2

export type ScenarioOrbitProgressState = {
  orbitProgressRadians: number
  orbitTurnsCompleted: number
  previousOrbitAngle?: number
}

type ScenarioOrbitProgressMode = 'absolute' | 'signed'

type ScenarioOrbitProgressAdvanceStatus = 'progressing' | 'reset'

type ScenarioOrbitProgressAdvance<TState extends ScenarioOrbitProgressState> = {
  completed: boolean
  state: TState
  status: ScenarioOrbitProgressAdvanceStatus
}

export const createScenarioOrbitProgressState =
  (): ScenarioOrbitProgressState => ({
    orbitProgressRadians: 0,
    orbitTurnsCompleted: 0,
  })

export const getScenarioTargetBody = (
  runtime: AppRuntimeState,
  targetId: string,
): Body | null =>
  runtime.simulation.state.bodies.find((body) => body.id === targetId) ?? null

export const isWithinScenarioObjectiveRadius = (
  runtime: AppRuntimeState,
  options: {
    radiusMultiplier: number
    targetId: string
  },
) => {
  const target = getScenarioTargetBody(runtime, options.targetId)
  if (!target) {
    return false
  }

  return (
    getCaptureMetricsForState(runtime.simulation.state, target).distance <
    target.radius * options.radiusMultiplier
  )
}

export const normalizeScenarioAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const getScenarioOrbitAngle = (runtime: AppRuntimeState, target: Body) =>
  Math.atan2(
    runtime.simulation.state.spacecraft.position.y - target.position.y,
    runtime.simulation.state.spacecraft.position.x - target.position.x,
  )

const resetScenarioOrbitProgress = <TState extends ScenarioOrbitProgressState>(
  state: TState,
  previousOrbitAngle: number,
): TState => ({
  ...state,
  ...createScenarioOrbitProgressState(),
  previousOrbitAngle,
})

export const advanceScenarioOrbitProgress = <
  TState extends ScenarioOrbitProgressState,
>(
  runtime: AppRuntimeState,
  state: TState,
  options: {
    maxRadiusMultiplier?: number
    progressMode?: ScenarioOrbitProgressMode
    requiredTurns: number
    targetId: string
  },
): ScenarioOrbitProgressAdvance<TState> | null => {
  const target = getScenarioTargetBody(runtime, options.targetId)
  if (!target) {
    return null
  }

  const captureMetrics = getCaptureMetricsForState(
    runtime.simulation.state,
    target,
  )
  const orbitAngle = getScenarioOrbitAngle(runtime, target)
  const outsideObjectiveRadius =
    typeof options.maxRadiusMultiplier === 'number' &&
    captureMetrics.distance >= target.radius * options.maxRadiusMultiplier

  if (outsideObjectiveRadius || captureMetrics.specificEnergy >= 0) {
    return {
      completed: false,
      state: resetScenarioOrbitProgress(state, orbitAngle),
      status: 'reset',
    }
  }

  const angleDelta =
    typeof state.previousOrbitAngle === 'number'
      ? normalizeScenarioAngleDelta(orbitAngle - state.previousOrbitAngle)
      : 0
  const progressMode = options.progressMode ?? 'signed'
  const additionalProgress =
    progressMode === 'absolute' ? Math.abs(angleDelta) : angleDelta
  const orbitProgressRadians = state.orbitProgressRadians + additionalProgress
  const comparableProgressRadians =
    progressMode === 'signed'
      ? Math.abs(orbitProgressRadians)
      : orbitProgressRadians
  const orbitTurnsCompleted = Math.floor(
    comparableProgressRadians / fullTurnRadians,
  )

  return {
    completed: orbitTurnsCompleted >= options.requiredTurns,
    state: {
      ...state,
      orbitProgressRadians,
      orbitTurnsCompleted,
      previousOrbitAngle: orbitAngle,
    },
    status: 'progressing',
  }
}

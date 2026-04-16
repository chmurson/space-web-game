import { cloneBodies, cloneSpacecraft } from './simulation/state'
import {
  cloneRuntimeScenarioSession,
  createRuntimeScenarioSession,
  type RuntimeScenarioSession,
} from './scenario/scenarioSession'
import type {
  Body,
  Scenario,
  SimulationState,
  Spacecraft,
} from './simulation/types'

const debugSnapshotStorageKey = 'space-web-game.debugScenarioSnapshot.v1'

type DebugScenarioSnapshotV1 = {
  version: 1
  savedAt: string
  elapsed: number
  viewportSize?: number
  coastPredictionHorizonHours?: number
  coastPredictionHorizonMultiplier?: number
  bodies: Body[]
  spacecraft: Spacecraft
}

type DebugScenarioSnapshotV2 = {
  version: 2
  savedAt: string
  elapsed: number
  viewportSize?: number
  coastPredictionHorizonHours?: number
  bodies: Body[]
  spacecraft: Spacecraft
  runtimeScenario?: RuntimeScenarioSession
}

export type DebugScenarioSnapshot =
  | DebugScenarioSnapshotV1
  | DebugScenarioSnapshotV2

export type RuntimeScenario = Scenario & {
  coastPredictionHorizonHours?: number
  elapsed?: number
  scenarioSession?: RuntimeScenarioSession
  viewportSize?: number
}

const getSnapshotCoastPredictionHorizonHours = (
  snapshot: DebugScenarioSnapshot,
) =>
  snapshot.coastPredictionHorizonHours ??
  ('coastPredictionHorizonMultiplier' in snapshot &&
  snapshot.coastPredictionHorizonMultiplier
    ? snapshot.coastPredictionHorizonMultiplier * 4
    : undefined)

const getSnapshotScenarioSession = (
  snapshot: DebugScenarioSnapshot,
): RuntimeScenarioSession =>
  snapshot.version === 2 && snapshot.runtimeScenario
    ? cloneRuntimeScenarioSession(snapshot.runtimeScenario)
    : createRuntimeScenarioSession('legacy-debug-snapshot')

export const createScenarioFromSnapshot = (
  snapshot: DebugScenarioSnapshot,
): RuntimeScenario => ({
  id: 'debug-snapshot',
  name: 'Debug snapshot',
  description: `Frozen debug state from ${new Date(snapshot.savedAt).toLocaleString()}.`,
  elapsed: snapshot.elapsed,
  viewportSize: snapshot.viewportSize,
  coastPredictionHorizonHours: getSnapshotCoastPredictionHorizonHours(snapshot),
  bodies: cloneBodies(snapshot.bodies),
  scenarioSession: getSnapshotScenarioSession(snapshot),
  spacecraft: cloneSpacecraft(snapshot.spacecraft),
})

export const createSnapshotFromState = (
  state: SimulationState,
  options: {
    coastPredictionHorizonHours?: number
    scenarioSession?: RuntimeScenarioSession
    viewportSize?: number
  } = {},
): DebugScenarioSnapshot => ({
  version: 2,
  savedAt: new Date().toISOString(),
  elapsed: state.elapsed,
  viewportSize: options.viewportSize,
  coastPredictionHorizonHours: options.coastPredictionHorizonHours,
  bodies: cloneBodies(state.bodies),
  runtimeScenario: options.scenarioSession
    ? cloneRuntimeScenarioSession(options.scenarioSession)
    : undefined,
  spacecraft: cloneSpacecraft(state.spacecraft),
})

export const readDebugScenarioSnapshot = (): DebugScenarioSnapshot | null => {
  try {
    const rawSnapshot = window.localStorage.getItem(debugSnapshotStorageKey)
    if (!rawSnapshot) {
      return null
    }

    const snapshot = JSON.parse(rawSnapshot) as DebugScenarioSnapshot
    return (snapshot.version === 1 || snapshot.version === 2) &&
      Array.isArray(snapshot.bodies) &&
      snapshot.spacecraft
      ? snapshot
      : null
  } catch {
    return null
  }
}

export const writeDebugScenarioSnapshot = (snapshot: DebugScenarioSnapshot) => {
  window.localStorage.setItem(debugSnapshotStorageKey, JSON.stringify(snapshot))
}

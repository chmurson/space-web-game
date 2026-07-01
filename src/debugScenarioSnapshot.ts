import type { AssistTargetSelectionMode } from './runtime/appRuntimeState'
import type { CameraControlMode } from './scenario/scenarioDirectiveTypes'
import {
  cloneRuntimeScenarioSession,
  createRuntimeScenarioSession,
  type RuntimeScenarioSession,
} from './scenario/scenarioSession'
import { cloneBodies, cloneSpacecraft } from './simulation/state'
import type {
  Body,
  Scenario,
  SimulationState,
  Spacecraft,
} from './simulation/types'
import type { OrbitPointDisplaySettingOverrides } from './userSettingsStorage'

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
  assistTargetIndex?: number
  assistTargetSelectionMode?: AssistTargetSelectionMode
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
  assistTargetIndex?: number
  assistTargetSelectionMode?: AssistTargetSelectionMode
  cameraMode?: CameraControlMode
  coastPredictionHorizonHours?: number
  elapsed?: number
  orbitPointDisplay?: OrbitPointDisplaySettingOverrides
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

const getSnapshotAssistTargetIndex = (snapshot: DebugScenarioSnapshot) =>
  snapshot.version === 2 && Number.isInteger(snapshot.assistTargetIndex)
    ? snapshot.assistTargetIndex
    : undefined

const getSnapshotAssistTargetSelectionMode = (
  snapshot: DebugScenarioSnapshot,
): AssistTargetSelectionMode | undefined =>
  snapshot.version === 2 &&
  (snapshot.assistTargetSelectionMode === 'auto' ||
    snapshot.assistTargetSelectionMode === 'manual')
    ? snapshot.assistTargetSelectionMode
    : undefined

export const createScenarioFromSnapshot = (
  snapshot: DebugScenarioSnapshot,
): RuntimeScenario => ({
  id: 'debug-snapshot',
  name: 'Debug snapshot',
  description: `Frozen debug state from ${new Date(snapshot.savedAt).toLocaleString()}.`,
  assistTargetIndex: getSnapshotAssistTargetIndex(snapshot),
  assistTargetSelectionMode: getSnapshotAssistTargetSelectionMode(snapshot),
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
    assistTargetIndex?: number
    assistTargetSelectionMode?: AssistTargetSelectionMode
    coastPredictionHorizonHours?: number
    scenarioSession?: RuntimeScenarioSession
    viewportSize?: number
  } = {},
): DebugScenarioSnapshot => ({
  version: 2,
  savedAt: new Date().toISOString(),
  assistTargetIndex: options.assistTargetIndex,
  assistTargetSelectionMode: options.assistTargetSelectionMode,
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

export const clearDebugScenarioSnapshot = () => {
  try {
    window.localStorage.removeItem(debugSnapshotStorageKey)
  } catch {
    // Snapshot clearing is best-effort when storage is unavailable.
  }
}

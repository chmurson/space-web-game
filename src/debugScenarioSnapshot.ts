import type { AssistTargetSelectionMode } from './runtime/appRuntimeState'
import type { CameraFollowSubject } from './scenario/scenarioDirectiveTypes'
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
import type { Vec2 } from './simulation/vector'
import type { OrbitPointDisplaySettingOverrides } from './userSettingsStorage'

const debugSnapshotStorageKey = 'space-web-game.debugScenarioSnapshot.v1'
const recentDebugSnapshotsStorageKey =
  'space-web-game.recentDebugScenarioSnapshots.v1'
const maxRecentDebugScenarioSnapshots = 10

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

type DebugScenarioSnapshotV3 = {
  version: 3
  savedAt: string
  assistTargetIndex?: number
  assistTargetSelectionMode?: AssistTargetSelectionMode
  cameraFollow?: CameraFollowSubject
  cameraPanOffset?: Vec2
  cameraView?: 'free' | 'locked'
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
  | DebugScenarioSnapshotV3

export type DebugScenarioSnapshotEntry = {
  id: string
  name: string
  savedAt: string
  snapshot: DebugScenarioSnapshot
}

export type DebugScenarioSnapshotLink = Pick<
  DebugScenarioSnapshotEntry,
  'id' | 'name' | 'savedAt'
> & {
  url: string
}

export type RuntimeScenario = Scenario & {
  assistTargetIndex?: number
  assistTargetSelectionMode?: AssistTargetSelectionMode
  cameraFollow?: CameraFollowSubject
  cameraPanOffset?: Vec2
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
  snapshot.version !== 1 && snapshot.runtimeScenario
    ? cloneRuntimeScenarioSession(snapshot.runtimeScenario)
    : createRuntimeScenarioSession('legacy-debug-snapshot')

const getSnapshotAssistTargetIndex = (snapshot: DebugScenarioSnapshot) =>
  snapshot.version !== 1 && Number.isInteger(snapshot.assistTargetIndex)
    ? snapshot.assistTargetIndex
    : undefined

const getSnapshotAssistTargetSelectionMode = (
  snapshot: DebugScenarioSnapshot,
): AssistTargetSelectionMode | undefined =>
  snapshot.version !== 1 &&
  (snapshot.assistTargetSelectionMode === 'auto' ||
    snapshot.assistTargetSelectionMode === 'manual')
    ? snapshot.assistTargetSelectionMode
    : undefined

const getSnapshotCameraPanOffset = (
  snapshot: DebugScenarioSnapshot,
): Vec2 | undefined => {
  if (snapshot.version !== 3 || !snapshot.cameraPanOffset) {
    return undefined
  }
  if (snapshot.cameraView === 'locked') {
    return { x: 0, y: 0 }
  }

  return { ...snapshot.cameraPanOffset }
}

const cloneDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
): DebugScenarioSnapshot => JSON.parse(JSON.stringify(snapshot))

const formatElapsedLabel = (elapsed: number) => {
  if (!Number.isFinite(elapsed)) {
    return null
  }

  const totalSeconds = Math.max(0, Math.floor(elapsed))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0
    ? `${hours}h ${minutes}m`
    : minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`
}

const getSnapshotPhaseLabel = (snapshot: DebugScenarioSnapshot) => {
  if (snapshot.version === 1 || !snapshot.runtimeScenario) {
    return null
  }

  const phase =
    snapshot.runtimeScenario.state &&
    typeof snapshot.runtimeScenario.state === 'object' &&
    'phase' in snapshot.runtimeScenario.state &&
    typeof snapshot.runtimeScenario.state.phase === 'string'
      ? snapshot.runtimeScenario.state.phase
      : null

  return [snapshot.runtimeScenario.scenarioId, phase].filter(Boolean).join(' ')
}

export const createDebugScenarioSnapshotEntryName = (
  snapshot: DebugScenarioSnapshot,
) => {
  const phaseLabel = getSnapshotPhaseLabel(snapshot)
  const elapsedLabel = formatElapsedLabel(snapshot.elapsed)

  if (phaseLabel && elapsedLabel) {
    return `${phaseLabel} at ${elapsedLabel}`
  }
  if (phaseLabel) {
    return phaseLabel
  }
  if (elapsedLabel) {
    return `Snapshot at ${elapsedLabel}`
  }

  return `Snapshot ${new Date(snapshot.savedAt).toLocaleTimeString()}`
}

const isDebugScenarioSnapshot = (
  snapshot: unknown,
): snapshot is DebugScenarioSnapshot =>
  !!snapshot &&
  typeof snapshot === 'object' &&
  'version' in snapshot &&
  ((snapshot as DebugScenarioSnapshot).version === 1 ||
    (snapshot as DebugScenarioSnapshot).version === 2 ||
    (snapshot as DebugScenarioSnapshot).version === 3) &&
  Array.isArray((snapshot as DebugScenarioSnapshot).bodies) &&
  !!(snapshot as DebugScenarioSnapshot).spacecraft

const isDebugScenarioSnapshotEntry = (
  entry: unknown,
): entry is DebugScenarioSnapshotEntry => {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  const candidate = entry as Partial<DebugScenarioSnapshotEntry>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.savedAt === 'string' &&
    isDebugScenarioSnapshot(candidate.snapshot)
  )
}

const readStoredRecentDebugScenarioSnapshots = () => {
  try {
    const rawEntries = window.localStorage.getItem(
      recentDebugSnapshotsStorageKey,
    )
    if (!rawEntries) {
      return []
    }

    const entries = JSON.parse(rawEntries)
    return Array.isArray(entries)
      ? entries
          .filter(isDebugScenarioSnapshotEntry)
          .slice(0, maxRecentDebugScenarioSnapshots)
      : []
  } catch {
    return []
  }
}

const createDebugScenarioSnapshotEntry = (
  snapshot: DebugScenarioSnapshot,
  name: string | undefined,
  existingEntries: DebugScenarioSnapshotEntry[],
): DebugScenarioSnapshotEntry => {
  const baseId = `debug-snapshot-${snapshot.savedAt}`
  let id = baseId
  let suffix = 2

  while (existingEntries.some((entry) => entry.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return {
    id,
    name: name?.trim() || createDebugScenarioSnapshotEntryName(snapshot),
    savedAt: snapshot.savedAt,
    snapshot: cloneDebugScenarioSnapshot(snapshot),
  }
}

const readRecentDebugScenarioSnapshots = () => {
  const storedEntries = readStoredRecentDebugScenarioSnapshots()
  if (storedEntries.length > 0) {
    return storedEntries
  }

  const activeSnapshot = readDebugScenarioSnapshot()
  return activeSnapshot
    ? [createDebugScenarioSnapshotEntry(activeSnapshot, undefined, [])]
    : []
}

const addRecentDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
  name?: string,
) => {
  const recentEntries = readRecentDebugScenarioSnapshots()
  const entry = createDebugScenarioSnapshotEntry(snapshot, name, recentEntries)
  const nextEntries = [entry, ...recentEntries].slice(
    0,
    maxRecentDebugScenarioSnapshots,
  )

  window.localStorage.setItem(
    recentDebugSnapshotsStorageKey,
    JSON.stringify(nextEntries),
  )
}

export const createScenarioFromSnapshot = (
  snapshot: DebugScenarioSnapshot,
): RuntimeScenario => ({
  id: 'debug-snapshot',
  name: 'Debug snapshot',
  description: `Frozen debug state from ${new Date(snapshot.savedAt).toLocaleString()}.`,
  assistTargetIndex: getSnapshotAssistTargetIndex(snapshot),
  assistTargetSelectionMode: getSnapshotAssistTargetSelectionMode(snapshot),
  cameraFollow: snapshot.version === 3 ? snapshot.cameraFollow : undefined,
  cameraPanOffset: getSnapshotCameraPanOffset(snapshot),
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
    cameraFollow?: CameraFollowSubject
    cameraPanOffset?: Vec2
    coastPredictionHorizonHours?: number
    scenarioSession?: RuntimeScenarioSession
    viewportSize?: number
  } = {},
): DebugScenarioSnapshot => ({
  version: 3,
  savedAt: new Date().toISOString(),
  assistTargetIndex: options.assistTargetIndex,
  assistTargetSelectionMode: options.assistTargetSelectionMode,
  cameraFollow: options.cameraFollow,
  cameraPanOffset: options.cameraPanOffset
    ? { ...options.cameraPanOffset }
    : undefined,
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

    const snapshot = JSON.parse(rawSnapshot)
    return isDebugScenarioSnapshot(snapshot) ? snapshot : null
  } catch {
    return null
  }
}

export const writeDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
  name?: string,
) => {
  addRecentDebugScenarioSnapshot(snapshot, name)
  window.localStorage.setItem(debugSnapshotStorageKey, JSON.stringify(snapshot))
}

export const getRecentDebugScenarioSnapshots = () => {
  return readRecentDebugScenarioSnapshots().map((entry) => ({
    ...entry,
    snapshot: cloneDebugScenarioSnapshot(entry.snapshot),
  }))
}

export const getRecentDebugScenarioSnapshotLinks = (
  baseUrl: string,
): DebugScenarioSnapshotLink[] =>
  readRecentDebugScenarioSnapshots().map(({ id, name, savedAt }) => {
    const url = new URL(baseUrl)
    url.searchParams.set('scenario', id)
    return { id, name, savedAt, url: url.href }
  })

export const loadRecentDebugScenarioSnapshot = (id: string) => {
  const entry = readRecentDebugScenarioSnapshots().find(
    (recentEntry) => recentEntry.id === id,
  )
  if (!entry) {
    return false
  }

  window.localStorage.setItem(
    debugSnapshotStorageKey,
    JSON.stringify(entry.snapshot),
  )
  return true
}

export const clearRecentDebugScenarioSnapshotsForTests = () => {
  window.localStorage.removeItem(recentDebugSnapshotsStorageKey)
}

export const clearDebugScenarioSnapshot = () => {
  try {
    window.localStorage.removeItem(debugSnapshotStorageKey)
  } catch {
    // Snapshot clearing is best-effort when storage is unavailable.
  }
}

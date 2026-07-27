import type { AssistTargetSelectionMode } from './runtime/appRuntimeState'
import { type InfoPin, normalizeInfoPins } from './runtime/infoPins'
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

type DebugScenarioSnapshotV3 = Omit<DebugScenarioSnapshotV2, 'version'> & {
  version: 3
  cameraFollow?: CameraFollowSubject
  cameraPanOffset?: Vec2
  cameraView?: 'free' | 'locked'
  userInfoPins?: InfoPin[]
}

export type DebugScenarioSnapshot =
  | DebugScenarioSnapshotV1
  | DebugScenarioSnapshotV2
  | DebugScenarioSnapshotV3

export type DebugScenarioSnapshotEntry = {
  id: string
  importedAt?: string
  lastExportedAt?: string
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
  scenarioSession?: RuntimeScenarioSession
  userInfoPins?: InfoPin[]
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

const getSnapshotUserInfoPins = (snapshot: DebugScenarioSnapshot): InfoPin[] =>
  snapshot.version === 3
    ? normalizeInfoPins(
        snapshot.userInfoPins,
        new Set(snapshot.bodies.map((body) => body.id)),
      )
    : []

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
    (candidate.importedAt === undefined ||
      typeof candidate.importedAt === 'string') &&
    (candidate.lastExportedAt === undefined ||
      typeof candidate.lastExportedAt === 'string') &&
    typeof candidate.name === 'string' &&
    typeof candidate.savedAt === 'string' &&
    isDebugScenarioSnapshot(candidate.snapshot)
  )
}

const readStoredRecentDebugScenarioSnapshots = ():
  | DebugScenarioSnapshotEntry[]
  | null => {
  let rawEntries: string | null

  try {
    rawEntries = window.localStorage.getItem(recentDebugSnapshotsStorageKey)
  } catch {
    return null
  }

  if (!rawEntries) {
    return []
  }

  try {
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

const readActiveDebugScenarioSnapshotAsRecentEntry = () => {
  const activeSnapshot = readDebugScenarioSnapshot()
  return activeSnapshot
    ? [createDebugScenarioSnapshotEntry(activeSnapshot, undefined, [])]
    : []
}

const readRecentDebugScenarioSnapshots = () => {
  const storedEntries = readStoredRecentDebugScenarioSnapshots()
  if (storedEntries && storedEntries.length > 0) {
    return storedEntries
  }

  return readActiveDebugScenarioSnapshotAsRecentEntry()
}

const readRecentDebugScenarioSnapshotsForMutation = () => {
  const storedEntries = readStoredRecentDebugScenarioSnapshots()
  if (storedEntries === null) {
    throw new Error('Recent debug snapshots could not be read.')
  }
  if (storedEntries.length > 0) {
    return storedEntries
  }

  return readActiveDebugScenarioSnapshotAsRecentEntry()
}

type DebugScenarioSnapshotEntryTransportMetadata = Pick<
  DebugScenarioSnapshotEntry,
  'importedAt' | 'lastExportedAt'
>

const insertRecentDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
  metadata: DebugScenarioSnapshotEntryTransportMetadata = {},
  name?: string,
) => {
  const recentEntries = readRecentDebugScenarioSnapshotsForMutation()
  const entry = {
    ...createDebugScenarioSnapshotEntry(snapshot, name, recentEntries),
    ...metadata,
  }
  const nextEntries = [entry, ...recentEntries].slice(
    0,
    maxRecentDebugScenarioSnapshots,
  )

  window.localStorage.setItem(
    recentDebugSnapshotsStorageKey,
    JSON.stringify(nextEntries),
  )

  return entry
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
  userInfoPins: getSnapshotUserInfoPins(snapshot),
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
    userInfoPins?: InfoPin[]
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
  userInfoPins: normalizeInfoPins(
    options.userInfoPins,
    new Set(state.bodies.map((body) => body.id)),
  ),
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
  insertRecentDebugScenarioSnapshot(snapshot, {}, name)
  window.localStorage.setItem(debugSnapshotStorageKey, JSON.stringify(snapshot))
}

export const insertImportedDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
): DebugScenarioSnapshotEntry | null => {
  try {
    return insertRecentDebugScenarioSnapshot(snapshot, {
      importedAt: new Date().toISOString(),
    })
  } catch {
    return null
  }
}

export const insertExportedDebugScenarioSnapshot = (
  snapshot: DebugScenarioSnapshot,
): DebugScenarioSnapshotEntry | null => {
  try {
    return insertRecentDebugScenarioSnapshot(snapshot, {
      lastExportedAt: new Date().toISOString(),
    })
  } catch {
    return null
  }
}

export const markRecentDebugScenarioSnapshotExported = (id: string) => {
  try {
    const recentEntries = readRecentDebugScenarioSnapshotsForMutation()
    const entryIndex = recentEntries.findIndex((entry) => entry.id === id)
    if (entryIndex < 0) {
      return false
    }

    const nextEntries = recentEntries.map((entry, index) =>
      index === entryIndex
        ? { ...entry, lastExportedAt: new Date().toISOString() }
        : entry,
    )
    window.localStorage.setItem(
      recentDebugSnapshotsStorageKey,
      JSON.stringify(nextEntries),
    )
    return true
  } catch {
    return false
  }
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

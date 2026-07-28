import type {
  DebugScenarioSnapshot,
  DebugScenarioSnapshotEntry,
} from '../../debugScenarioSnapshot'
import { formatCompactElapsed } from '../formatters'

const currentScenarioNames: Record<string, string> = {
  'earth-moon': 'Earth-Moon sandbox',
  'menu-background': 'Menu background',
  'moon-capture-debug': 'Moon capture debug',
  'reach-moon': 'Reach the Moon',
  tutorial: 'Tutorial: Escape Earth',
}

export const formatRecentSnapshotSavedAt = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.valueOf()) ? date.toLocaleTimeString() : 'Unknown'
}

const formatRecentSnapshotTimestamp = (value: string) => {
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) {
    return 'Unknown'
  }

  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatRecentSnapshotGameTime = (elapsed: number) =>
  Number.isFinite(elapsed) ? formatCompactElapsed(elapsed) : 'Unknown'

const formatRecentSnapshotScenario = (snapshot: DebugScenarioSnapshot) => {
  if (!snapshot.runtimeScenario) {
    return `Legacy snapshot (version ${snapshot.version})`
  }

  const scenarioId =
    typeof snapshot.runtimeScenario.scenarioId === 'string'
      ? snapshot.runtimeScenario.scenarioId.trim()
      : ''
  if (!scenarioId) {
    return `Scenario ID unavailable (version ${snapshot.version})`
  }

  const friendlyName = currentScenarioNames[scenarioId]
  return friendlyName
    ? `${friendlyName} (${scenarioId})`
    : `Scenario ID: ${scenarioId}`
}

export const getRecentSnapshotDetails = (entry: DebugScenarioSnapshotEntry) => {
  const details = [
    {
      label: 'Game time',
      value: formatRecentSnapshotGameTime(entry.snapshot.elapsed),
    },
    {
      label: 'Scenario',
      value: formatRecentSnapshotScenario(entry.snapshot),
    },
    {
      label: 'Created',
      value: formatRecentSnapshotTimestamp(entry.snapshot.savedAt),
    },
  ]

  if (entry.importedAt) {
    details.push({
      label: 'Imported',
      value: formatRecentSnapshotTimestamp(entry.importedAt),
    })
  }

  if (entry.lastExportedAt) {
    details.push({
      label: 'Last exported',
      value: formatRecentSnapshotTimestamp(entry.lastExportedAt),
    })
  }

  return details
}

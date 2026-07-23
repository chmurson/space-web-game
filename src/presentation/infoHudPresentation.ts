import type { TrajectoryPredictionEventMarkerKind } from '../prediction/trajectoryPrediction'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { GameQueries } from '../runtime/gameQueries'
import {
  apoapsisInfoPin,
  createBodyInfoPin,
  getInfoPinKey,
  type InfoPin,
  includesInfoPin,
  periapsisInfoPin,
} from '../runtime/infoPins'
import type { TrajectoryPredictionState } from '../runtime/trajectoryPredictionRuntime'
import { formatDistance } from '../ui/formatters'
import { getBodySurfaceDistanceMeters } from './bodyDistanceContext'

export type InfoHudRow = {
  accessibleLabel: string
  distanceLabel: string
  key: string
  label: string
  pin: InfoPin
  pinned: boolean
  scenarioOwned: boolean
  secondaryLabel: string
}

export type InfoHudEntry =
  | {
      bodyColor: string
      key: string
      kind: 'body'
      row: InfoHudRow
    }
  | {
      key: 'apsides'
      kind: 'apsides'
      points: readonly [
        Pick<InfoHudRow, 'distanceLabel' | 'label'>,
        Pick<InfoHudRow, 'distanceLabel' | 'label'>,
      ]
      row: InfoHudRow
      secondaryLabel: string
    }

export type InfoHudView = {
  clearAvailable: boolean
  entries: InfoHudEntry[]
  rows: InfoHudRow[]
  selectedCount: number
}

const unavailableDistanceLabel = '—'

const formatSurfaceDistance = (meters: number | null) =>
  meters !== null && Number.isFinite(meters)
    ? formatDistance(Math.max(0, meters))
    : unavailableDistanceLabel

const getApsisSurfaceDistance = (
  kind: TrajectoryPredictionEventMarkerKind,
  activeTargetId: string,
  prediction: TrajectoryPredictionState,
) => {
  if (prediction.targetId !== activeTargetId) {
    return null
  }

  return (
    prediction.targetRelativeEventMarkers.find(
      (eventMarker) => eventMarker.kind === kind,
    )?.altitude ?? null
  )
}

const getBodyDistanceFromTargetMeters = (
  body: AppRuntimeState['simulation']['state']['bodies'][number],
  target: AppRuntimeState['simulation']['state']['bodies'][number],
) => {
  if (body.id === target.id) {
    return 0
  }

  return Math.max(
    0,
    Math.hypot(
      body.position.x - target.position.x,
      body.position.y - target.position.y,
    ) -
      body.radius -
      target.radius,
  )
}

const createRow = (options: {
  accessibleLabel: string
  distanceLabel: string
  label: string
  pin: InfoPin
  runtime: AppRuntimeState
  secondaryLabel: string
}): InfoHudRow => {
  const scenarioOwned = includesInfoPin(
    options.runtime.scenario.directives.infoPins,
    options.pin,
  )
  const userOwned = includesInfoPin(options.runtime.info.userPins, options.pin)

  return {
    accessibleLabel: options.accessibleLabel,
    distanceLabel: options.distanceLabel,
    key: getInfoPinKey(options.pin),
    label: options.label,
    pin: { ...options.pin },
    pinned: scenarioOwned || userOwned,
    scenarioOwned,
    secondaryLabel: options.secondaryLabel,
  }
}

export const createInfoHudView = (options: {
  prediction: TrajectoryPredictionState
  queries: Pick<GameQueries, 'getAssistTargetUiState'>
  runtime: AppRuntimeState
}): InfoHudView => {
  const target = options.queries.getAssistTargetUiState().activeTarget
  const bodyEntries = options.runtime.simulation.state.bodies.map((body) => {
    const distanceLabel = formatSurfaceDistance(
      getBodySurfaceDistanceMeters(
        body,
        options.runtime.simulation.state.spacecraft.position,
      ),
    )
    const row = createRow({
      accessibleLabel: `${body.name}, surface distance ${distanceLabel}`,
      distanceLabel,
      label: body.name,
      pin: createBodyInfoPin(body.id),
      runtime: options.runtime,
      secondaryLabel: 'to spacecraft',
    })
    return {
      distanceFromTargetMeters: getBodyDistanceFromTargetMeters(body, target),
      entry: {
        bodyColor: body.color,
        key: row.key,
        kind: 'body' as const,
        row,
      },
      target: body.id === target.id,
    }
  })
  const createApsisRow = (
    kind: TrajectoryPredictionEventMarkerKind,
    label: 'Ap' | 'Pe',
    pin: InfoPin,
  ) => {
    const distanceLabel = formatSurfaceDistance(
      getApsisSurfaceDistance(kind, target.id, options.prediction),
    )
    return createRow({
      accessibleLabel: `${label}, altitude over ${target.name} ${distanceLabel}`,
      distanceLabel,
      label,
      pin,
      runtime: options.runtime,
      secondaryLabel: `to ${target.name}`,
    })
  }
  const periapsisRow = createApsisRow('periapsis', 'Pe', periapsisInfoPin)
  const apoapsisRow = createApsisRow('apoapsis', 'Ap', apoapsisInfoPin)
  const apsidesRow: InfoHudRow = {
    accessibleLabel: `${periapsisRow.accessibleLabel}; ${apoapsisRow.accessibleLabel}`,
    distanceLabel: `${periapsisRow.distanceLabel} | ${apoapsisRow.distanceLabel}`,
    key: 'apsides',
    label: 'Pe / Ap',
    pin: { ...periapsisInfoPin },
    pinned: periapsisRow.pinned || apoapsisRow.pinned,
    scenarioOwned: periapsisRow.scenarioOwned || apoapsisRow.scenarioOwned,
    secondaryLabel: `to ${target.name}`,
  }
  const apsisDistances = [
    getApsisSurfaceDistance('periapsis', target.id, options.prediction),
    getApsisSurfaceDistance('apoapsis', target.id, options.prediction),
  ].filter((distance): distance is number => distance !== null)
  const sortableEntries = [
    ...bodyEntries,
    {
      distanceFromTargetMeters:
        apsisDistances.length > 0
          ? Math.min(...apsisDistances)
          : Number.POSITIVE_INFINITY,
      entry: {
        key: 'apsides' as const,
        kind: 'apsides' as const,
        points: [
          {
            distanceLabel: periapsisRow.distanceLabel,
            label: periapsisRow.label,
          },
          {
            distanceLabel: apoapsisRow.distanceLabel,
            label: apoapsisRow.label,
          },
        ] as [
          Pick<InfoHudRow, 'distanceLabel' | 'label'>,
          Pick<InfoHudRow, 'distanceLabel' | 'label'>,
        ],
        row: apsidesRow,
        secondaryLabel: `to ${target.name}`,
      },
      target: false,
    },
  ]
  sortableEntries.sort((left, right) => {
    if (left.target !== right.target) {
      return left.target ? -1 : 1
    }

    const leftSelected = left.entry.row.pinned
    const rightSelected = right.entry.row.pinned
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1
    }

    return (
      left.distanceFromTargetMeters - right.distanceFromTargetMeters ||
      left.entry.key.localeCompare(right.entry.key)
    )
  })
  const entries = sortableEntries.map(({ entry }) => entry)
  const rows = entries.map((entry) => entry.row)

  return {
    clearAvailable: options.runtime.info.userPins.length > 0,
    entries,
    rows,
    selectedCount: rows.filter((row) => row.pinned).length,
  }
}

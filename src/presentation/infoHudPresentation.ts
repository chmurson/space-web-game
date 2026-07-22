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

export type InfoHudView = {
  clearAvailable: boolean
  pinnedRows: InfoHudRow[]
  rows: InfoHudRow[]
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
  const bodyRows = options.runtime.simulation.state.bodies.map((body) => {
    const distanceLabel = formatSurfaceDistance(
      getBodySurfaceDistanceMeters(
        body,
        options.runtime.simulation.state.spacecraft.position,
      ),
    )
    return createRow({
      accessibleLabel: `${body.name}, surface distance ${distanceLabel}`,
      distanceLabel,
      label: body.name,
      pin: createBodyInfoPin(body.id),
      runtime: options.runtime,
      secondaryLabel: 'to spacecraft',
    })
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
      accessibleLabel: `${label}, surface distance from ${target.name} ${distanceLabel}`,
      distanceLabel,
      label,
      pin,
      runtime: options.runtime,
      secondaryLabel: `to ${target.name}`,
    })
  }
  const rows = [
    ...bodyRows,
    createApsisRow('periapsis', 'Pe', periapsisInfoPin),
    createApsisRow('apoapsis', 'Ap', apoapsisInfoPin),
  ]
  return {
    clearAvailable: options.runtime.info.userPins.length > 0,
    pinnedRows: rows.filter((row) => row.pinned),
    rows,
  }
}

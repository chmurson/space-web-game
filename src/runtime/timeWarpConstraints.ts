import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'

export const predictionCoverageRealSeconds = 10

export type TimeWarpConstraintReason =
  | 'active-controls'
  | 'prediction-coverage'
  | 'scenario-limit'

export type PredictionCoverageTimeWarpLimit = {
  maxTimeWarp: number
  maxTimeWarpIndex: number
  rawMaxTimeWarp: number
  remainingCoverageSeconds: number
}

export type TimeWarpConstraintResolution = {
  predictionCoverageLimit: PredictionCoverageTimeWarpLimit | null
  reason: TimeWarpConstraintReason | null
  timeWarpIndex: number
}

const normalizeCoverageSeconds = (coverageSeconds: number) =>
  Number.isFinite(coverageSeconds) ? Math.max(0, coverageSeconds) : 0

export const getPredictionCoverageTimeWarpLimit = (
  coverageSeconds: number,
  timeWarps: number[],
): PredictionCoverageTimeWarpLimit => {
  const remainingCoverageSeconds = normalizeCoverageSeconds(coverageSeconds)
  const rawMaxTimeWarp =
    remainingCoverageSeconds / predictionCoverageRealSeconds
  const maxTimeWarpIndex = getConstrainedTimeWarpIndex(
    Math.max(0, timeWarps.length - 1),
    timeWarps,
    rawMaxTimeWarp,
  )

  return {
    maxTimeWarp: timeWarps[maxTimeWarpIndex] ?? 1,
    maxTimeWarpIndex,
    rawMaxTimeWarp,
    remainingCoverageSeconds,
  }
}

export const resolveTimeWarpConstraints = (options: {
  maxTimeWarp: number | null
  simulationControlMaxWarp: number | null
  timeWarpIndex: number
  timeWarps: number[]
  usablePredictionCoverageSeconds?: number | null
}): TimeWarpConstraintResolution => {
  const requestedTimeWarpIndex = getConstrainedTimeWarpIndex(
    options.timeWarpIndex,
    options.timeWarps,
    null,
  )
  const activeControlTimeWarpIndex = getConstrainedTimeWarpIndex(
    requestedTimeWarpIndex,
    options.timeWarps,
    options.simulationControlMaxWarp,
  )
  const scenarioTimeWarpIndex = getConstrainedTimeWarpIndex(
    requestedTimeWarpIndex,
    options.timeWarps,
    options.maxTimeWarp,
  )
  const predictionCoverageLimit =
    options.usablePredictionCoverageSeconds === null ||
    options.usablePredictionCoverageSeconds === undefined
      ? null
      : getPredictionCoverageTimeWarpLimit(
          options.usablePredictionCoverageSeconds,
          options.timeWarps,
        )
  const predictionCoverageTimeWarpIndex = predictionCoverageLimit
    ? Math.min(requestedTimeWarpIndex, predictionCoverageLimit.maxTimeWarpIndex)
    : requestedTimeWarpIndex
  const timeWarpIndex = Math.min(
    activeControlTimeWarpIndex,
    scenarioTimeWarpIndex,
    predictionCoverageTimeWarpIndex,
  )
  let reason: TimeWarpConstraintReason | null = null

  if (timeWarpIndex !== requestedTimeWarpIndex) {
    if (activeControlTimeWarpIndex === timeWarpIndex) {
      reason = 'active-controls'
    } else if (scenarioTimeWarpIndex === timeWarpIndex) {
      reason = 'scenario-limit'
    } else {
      reason = 'prediction-coverage'
    }
  }

  return {
    predictionCoverageLimit,
    reason,
    timeWarpIndex,
  }
}

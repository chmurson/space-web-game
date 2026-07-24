import {
  getPredictionCoverageTimeWarpLimit,
  resolveTimeWarpConstraints,
  type TimeWarpConstraintReason,
} from './timeWarpConstraints'

export const navigationTimeWarpRestoreDelayMs = 320

type TimeWarpSelectionOptions = {
  maxTimeWarp: number | null
  timeWarpIndex: number
}

export const createNavigationTimeWarpController = (options: {
  maxControlWarp: number
  timeWarps: number[]
}) => {
  let headingPlanActive = false
  let simulationControlMaxWarp: number | null = null
  let usablePredictionCoverageSeconds: number | null = null
  let requestedTimeWarpIndex: number | null = null
  let navigationStoppedAtMs: number | null = null
  let lastEffectiveTimeWarpIndex: number | null = null
  let lastConstraintReason: TimeWarpConstraintReason | null = null

  const resolveConstraints = ({
    maxTimeWarp,
    timeWarpIndex,
  }: TimeWarpSelectionOptions) =>
    resolveTimeWarpConstraints({
      maxTimeWarp,
      simulationControlMaxWarp: getActiveControlMaxWarp(),
      timeWarpIndex,
      timeWarps: options.timeWarps,
      usablePredictionCoverageSeconds,
    })

  const constrainRequestedTimeWarpIndex = (
    selection: TimeWarpSelectionOptions,
  ) =>
    resolveTimeWarpConstraints({
      maxTimeWarp: selection.maxTimeWarp,
      simulationControlMaxWarp: null,
      timeWarpIndex: selection.timeWarpIndex,
      timeWarps: options.timeWarps,
    }).timeWarpIndex

  const getActiveControlMaxWarp = () => {
    if (headingPlanActive && simulationControlMaxWarp !== null) {
      return Math.min(options.maxControlWarp, simulationControlMaxWarp)
    }

    if (headingPlanActive) {
      return options.maxControlWarp
    }

    return simulationControlMaxWarp
  }

  const navigationActive = () => getActiveControlMaxWarp() !== null

  const syncRequestedTimeWarpIndex = (selection: TimeWarpSelectionOptions) => {
    requestedTimeWarpIndex = constrainRequestedTimeWarpIndex({
      maxTimeWarp: selection.maxTimeWarp,
      timeWarpIndex: requestedTimeWarpIndex ?? selection.timeWarpIndex,
    })
    return requestedTimeWarpIndex
  }

  const beginNavigation = (selection: TimeWarpSelectionOptions) => {
    const requestedIndex = syncRequestedTimeWarpIndex(selection)
    navigationStoppedAtMs = null
    const resolution = resolveConstraints({
      maxTimeWarp: selection.maxTimeWarp,
      timeWarpIndex: requestedIndex,
    })
    lastConstraintReason = resolution.reason
    lastEffectiveTimeWarpIndex = resolution.timeWarpIndex
    return resolution.timeWarpIndex
  }

  const markNavigationStopped = (nowMs: number) => {
    if (
      !navigationActive() &&
      requestedTimeWarpIndex !== null &&
      navigationStoppedAtMs === null
    ) {
      navigationStoppedAtMs = nowMs
    }
  }

  const reset = () => {
    headingPlanActive = false
    simulationControlMaxWarp = null
    usablePredictionCoverageSeconds = null
    requestedTimeWarpIndex = null
    navigationStoppedAtMs = null
    lastEffectiveTimeWarpIndex = null
    lastConstraintReason = null
  }

  const getDiagnostics = () => {
    const predictionCoverageLimit =
      usablePredictionCoverageSeconds === null
        ? null
        : getPredictionCoverageTimeWarpLimit(
            usablePredictionCoverageSeconds,
            options.timeWarps,
          )

    return {
      constraintReason: lastConstraintReason,
      effectiveTimeWarp:
        lastEffectiveTimeWarpIndex === null
          ? null
          : (options.timeWarps[lastEffectiveTimeWarpIndex] ?? 1),
      effectiveTimeWarpIndex: lastEffectiveTimeWarpIndex,
      predictionCoverageLimit,
      requestedTimeWarp:
        requestedTimeWarpIndex === null
          ? null
          : (options.timeWarps[requestedTimeWarpIndex] ?? 1),
      requestedTimeWarpIndex,
    }
  }

  return {
    beginHeadingPlan: (selection: TimeWarpSelectionOptions) => {
      headingPlanActive = true
      return beginNavigation(selection)
    },
    endHeadingPlan: (nowMs: number) => {
      headingPlanActive = false
      markNavigationStopped(nowMs)
    },
    reset,
    resolveFrame: (
      selection: TimeWarpSelectionOptions & {
        nowMs: number
        simulationControlMaxWarp: number | null
        usablePredictionCoverageSeconds?: number | null
      },
    ) => {
      const navigationWasActive = navigationActive()
      simulationControlMaxWarp = selection.simulationControlMaxWarp
      usablePredictionCoverageSeconds =
        selection.usablePredictionCoverageSeconds ?? null
      const requestedIndex = syncRequestedTimeWarpIndex(selection)

      if (navigationActive()) {
        return beginNavigation({
          maxTimeWarp: selection.maxTimeWarp,
          timeWarpIndex: requestedIndex,
        })
      }

      if (navigationWasActive) {
        markNavigationStopped(selection.nowMs)
      }
      if (
        navigationStoppedAtMs === null ||
        selection.nowMs - navigationStoppedAtMs <
          navigationTimeWarpRestoreDelayMs
      ) {
        const resolution = resolveConstraints({
          maxTimeWarp: selection.maxTimeWarp,
          timeWarpIndex:
            navigationStoppedAtMs === null
              ? requestedIndex
              : selection.timeWarpIndex,
        })
        lastConstraintReason =
          navigationStoppedAtMs === null
            ? resolution.reason
            : (resolution.reason ?? 'active-controls')
        lastEffectiveTimeWarpIndex = resolution.timeWarpIndex
        return resolution.timeWarpIndex
      }

      navigationStoppedAtMs = null
      const resolution = resolveConstraints({
        maxTimeWarp: selection.maxTimeWarp,
        timeWarpIndex: requestedIndex,
      })
      lastConstraintReason = resolution.reason
      lastEffectiveTimeWarpIndex = resolution.timeWarpIndex
      return resolution.timeWarpIndex
    },
    selectTimeWarpIndex: (selection: TimeWarpSelectionOptions) => {
      navigationStoppedAtMs = null
      requestedTimeWarpIndex = constrainRequestedTimeWarpIndex(selection)
      const resolution = resolveConstraints({
        maxTimeWarp: selection.maxTimeWarp,
        timeWarpIndex: requestedTimeWarpIndex,
      })
      lastConstraintReason = resolution.reason
      lastEffectiveTimeWarpIndex = resolution.timeWarpIndex
      return resolution.timeWarpIndex
    },
    getDiagnostics,
  }
}

export type NavigationTimeWarpController = ReturnType<
  typeof createNavigationTimeWarpController
>

export type NavigationTimeWarpDiagnostics = ReturnType<
  NavigationTimeWarpController['getDiagnostics']
>

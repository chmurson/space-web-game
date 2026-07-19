import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'

export const navigationTimeWarpRestoreDelayMs = 500

type TimeWarpSelectionOptions = {
  maxTimeWarp: number | null
  timeWarpIndex: number
}

export const createNavigationTimeWarpController = (options: {
  maxControlWarp: number
  timeWarps: number[]
}) => {
  const maxControlTimeWarpIndex = options.timeWarps.reduce(
    (safeIndex, timeWarp, index) =>
      timeWarp <= options.maxControlWarp ? index : safeIndex,
    -1,
  )
  let headingPlanActive = false
  let simulationNavigationActive = false
  let restoreTimeWarpIndex: number | null = null
  let navigationStoppedAtMs: number | null = null

  const constrainTimeWarpIndex = ({
    maxTimeWarp,
    timeWarpIndex,
  }: TimeWarpSelectionOptions) =>
    getConstrainedTimeWarpIndex(timeWarpIndex, options.timeWarps, maxTimeWarp)

  const capTimeWarpIndex = (timeWarpIndex: number) =>
    maxControlTimeWarpIndex < 0
      ? timeWarpIndex
      : Math.min(timeWarpIndex, maxControlTimeWarpIndex)

  const navigationActive = () => headingPlanActive || simulationNavigationActive

  const preserveTimeWarpForNavigation = (timeWarpIndex: number) => {
    if (
      restoreTimeWarpIndex === null &&
      maxControlTimeWarpIndex >= 0 &&
      timeWarpIndex > maxControlTimeWarpIndex
    ) {
      restoreTimeWarpIndex = timeWarpIndex
    }
  }

  const beginNavigation = (selection: TimeWarpSelectionOptions) => {
    const constrainedTimeWarpIndex = constrainTimeWarpIndex(selection)
    preserveTimeWarpForNavigation(constrainedTimeWarpIndex)
    navigationStoppedAtMs = null
    return capTimeWarpIndex(constrainedTimeWarpIndex)
  }

  const markNavigationStopped = (nowMs: number) => {
    if (
      !navigationActive() &&
      restoreTimeWarpIndex !== null &&
      navigationStoppedAtMs === null
    ) {
      navigationStoppedAtMs = nowMs
    }
  }

  const reset = () => {
    headingPlanActive = false
    simulationNavigationActive = false
    restoreTimeWarpIndex = null
    navigationStoppedAtMs = null
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
        simulationNavigationActive: boolean
      },
    ) => {
      simulationNavigationActive = selection.simulationNavigationActive
      const constrainedTimeWarpIndex = constrainTimeWarpIndex(selection)
      if (restoreTimeWarpIndex !== null) {
        restoreTimeWarpIndex = constrainTimeWarpIndex({
          maxTimeWarp: selection.maxTimeWarp,
          timeWarpIndex: restoreTimeWarpIndex,
        })
      }

      if (navigationActive()) {
        return beginNavigation({
          maxTimeWarp: selection.maxTimeWarp,
          timeWarpIndex: constrainedTimeWarpIndex,
        })
      }

      markNavigationStopped(selection.nowMs)
      if (
        restoreTimeWarpIndex === null ||
        navigationStoppedAtMs === null ||
        selection.nowMs - navigationStoppedAtMs <
          navigationTimeWarpRestoreDelayMs
      ) {
        return constrainedTimeWarpIndex
      }

      const restoredTimeWarpIndex = restoreTimeWarpIndex
      restoreTimeWarpIndex = null
      navigationStoppedAtMs = null
      return restoredTimeWarpIndex
    },
    selectTimeWarpIndex: (selection: TimeWarpSelectionOptions) => {
      restoreTimeWarpIndex = null
      navigationStoppedAtMs = null
      const constrainedTimeWarpIndex = constrainTimeWarpIndex(selection)

      if (!navigationActive()) {
        return constrainedTimeWarpIndex
      }

      preserveTimeWarpForNavigation(constrainedTimeWarpIndex)
      return capTimeWarpIndex(constrainedTimeWarpIndex)
    },
  }
}

export type NavigationTimeWarpController = ReturnType<
  typeof createNavigationTimeWarpController
>

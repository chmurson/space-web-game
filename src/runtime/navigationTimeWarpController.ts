import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'

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
  let restoreTimeWarpIndex: number | null = null
  let navigationStoppedAtMs: number | null = null

  const constrainTimeWarpIndex = ({
    maxTimeWarp,
    timeWarpIndex,
  }: TimeWarpSelectionOptions) =>
    getConstrainedTimeWarpIndex(timeWarpIndex, options.timeWarps, maxTimeWarp)

  const getActiveControlMaxWarp = () => {
    if (headingPlanActive && simulationControlMaxWarp !== null) {
      return Math.min(options.maxControlWarp, simulationControlMaxWarp)
    }

    if (headingPlanActive) {
      return options.maxControlWarp
    }

    return simulationControlMaxWarp
  }

  const capTimeWarpIndex = (timeWarpIndex: number) =>
    getConstrainedTimeWarpIndex(
      timeWarpIndex,
      options.timeWarps,
      getActiveControlMaxWarp(),
    )

  const navigationActive = () => getActiveControlMaxWarp() !== null

  const preserveTimeWarpForNavigation = (timeWarpIndex: number) => {
    if (
      restoreTimeWarpIndex === null &&
      capTimeWarpIndex(timeWarpIndex) !== timeWarpIndex
    ) {
      restoreTimeWarpIndex = timeWarpIndex
    }
  }

  const beginNavigation = (selection: TimeWarpSelectionOptions) => {
    const constrainedTimeWarpIndex = constrainTimeWarpIndex(selection)
    preserveTimeWarpForNavigation(constrainedTimeWarpIndex)
    navigationStoppedAtMs = null
    return capTimeWarpIndex(restoreTimeWarpIndex ?? constrainedTimeWarpIndex)
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
    simulationControlMaxWarp = null
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
        simulationControlMaxWarp: number | null
      },
    ) => {
      simulationControlMaxWarp = selection.simulationControlMaxWarp
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

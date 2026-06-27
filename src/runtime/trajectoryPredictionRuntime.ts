import type { AssistMode, CaptureMetrics } from '../assist/orbitalAssist'
import {
  type PredictedClosestApproach,
  type PredictedImpact,
  predictAssistedTrajectory,
  predictCoastTrajectory,
  type TrajectoryPredictionConfig,
} from '../prediction/trajectoryPrediction'
import type {
  Body,
  ControlInput,
  PhysicsEngine,
  SimulationState,
} from '../simulation/types'
import type { Vec2 } from '../simulation/vector'

export type TrajectoryPredictionState = {
  absolutePredictionEnd: Vec2 | null
  absolutePredictionPoints: Vec2[]
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  targetId: string | null
  targetRelativeAssistedPoints: Vec2[]
  targetRelativePredictionEnd: Vec2 | null
  targetRelativePredictionPoints: Vec2[]
}

export type RefreshTrajectoryPredictionOptions = {
  assistMode: AssistMode
  getAssistPredictionControls(
    simulationState: SimulationState,
    targetId: string,
  ): ControlInput
  getAssistTarget(): Body
  getCaptureMetrics(target: Body): CaptureMetrics
  physicsEngine: PhysicsEngine
  predictionConfig: TrajectoryPredictionConfig
  state: SimulationState
}

const emptyTrajectoryPredictionState = (): TrajectoryPredictionState => ({
  absolutePredictionEnd: null,
  absolutePredictionPoints: [],
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  targetId: null,
  targetRelativeAssistedPoints: [],
  targetRelativePredictionEnd: null,
  targetRelativePredictionPoints: [],
})

export const createTrajectoryPredictionRuntime = () => {
  let predictionRefreshElapsed = 0
  let predictionState = emptyTrajectoryPredictionState()

  const refreshForTarget = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
  ) => {
    const predictionConfig = options.predictionConfig
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const coastPrediction = predictCoastTrajectory(
      options.state,
      options.physicsEngine,
      target,
      predictionConfig,
      allowLoopTrim,
    )
    const targetRelativePredictionPoints = coastPrediction.relativePoints

    predictionState = {
      absolutePredictionEnd: coastPrediction.absoluteEndPoint,
      absolutePredictionPoints: coastPrediction.absolutePoints,
      predictedImpact: coastPrediction.impact,
      predictedTargetClosestApproach: coastPrediction.closestApproach,
      targetId: target.id,
      targetRelativeAssistedPoints:
        options.assistMode === 'off'
          ? []
          : predictAssistedTrajectory(
              options.state,
              options.physicsEngine,
              target.id,
              predictionConfig,
              options.getAssistPredictionControls,
            ).relativePoints,
      targetRelativePredictionEnd:
        targetRelativePredictionPoints.at(-1) ?? null,
      targetRelativePredictionPoints,
    }
    predictionRefreshElapsed = 0
  }

  const refresh = (options: RefreshTrajectoryPredictionOptions) => {
    refreshForTarget(options, options.getAssistTarget())
  }

  return {
    getState: () => predictionState,
    maybeRefresh: (
      realDt: number,
      options: RefreshTrajectoryPredictionOptions,
    ) => {
      predictionRefreshElapsed += realDt
      const target = options.getAssistTarget()
      if (
        predictionState.targetId !== target.id ||
        predictionRefreshElapsed >= options.predictionConfig.refreshInterval
      ) {
        refreshForTarget(options, target)
        return true
      }
      return false
    },
    refresh,
  }
}

export type TrajectoryPredictionRuntime = ReturnType<
  typeof createTrajectoryPredictionRuntime
>

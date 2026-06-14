import {
  getAssistTargetDecisionForState,
  type AssistTargetDebugInfo,
} from '../assist/assistTarget'
import {
  getAssistPredictionControlsForState,
  getAutopilotTurnForHeading,
  getCaptureMetricsForState,
  getCircularizePlanForState,
  shouldCaptureBurnForMetrics,
  type CaptureMetrics,
  type CircularizePlan,
} from '../assist/orbitalAssist'
import {
  getTrajectoryPredictionConfig,
  type TrajectoryPredictionConfig,
  type TrajectoryPredictionSamplingConfig,
} from '../prediction/trajectoryPrediction'
import type { Body, ControlInput, SimulationState } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { AppRuntimeState } from './appRuntimeState'

export type AutoAssistTargetConfig = {
  switchRangeMultiplier: number
}

export type AssistTargetSelectionSource = 'auto' | 'forced' | 'manual'

export type AssistTargetUiState = {
  activeTarget: Body
  mode: AssistTargetSelectionSource
  recommendedTarget: Body | null
}

export type GameQueries = {
  getAssistTargetDebug(): AssistTargetDebugInfo | null
  getAssistPredictionControls(
    simulationState: SimulationState,
    targetId: string,
  ): ControlInput
  getAssistTarget(): Body
  getAssistTargetUiState(): AssistTargetUiState
  getAutopilotTurn(desiredHeading: number): number
  getCaptureMetrics(target: Body): CaptureMetrics
  getCircularizePlan(target: Body): CircularizePlan
  getCoastPredictionHorizonSeconds(): number
  getPredictionConfig(): TrajectoryPredictionConfig
  shouldCaptureBurn(target: Body): boolean
}

export const createGameQueries = (options: {
  autoSelectNearestSurface: boolean
  autoSelectConfig: AutoAssistTargetConfig
  autopilotRotationRate: number
  getPredictedTrajectoryEnd(): Vec2 | null
  getPredictedTrajectoryPoints(): Vec2[]
  maxPredictionLoopRevolutions: number
  predictionSampling: TrajectoryPredictionSamplingConfig
  runtime: AppRuntimeState
}): GameQueries => {
  let currentAutoTargetId: string | null = null
  let lastAssistTargetDebug: AssistTargetDebugInfo | null = null

  const getTargetDecision = (autoSelectNearestSurface: boolean) =>
    getAssistTargetDecisionForState(options.runtime.simulation.state, {
      autoSelectNearestSurface,
      autoSelectConfig: options.autoSelectConfig,
      currentAutoTargetId,
      predictedTrajectoryPoints: options.getPredictedTrajectoryPoints(),
      predictedTrajectoryEnd: options.getPredictedTrajectoryEnd(),
      selectedIndex: options.runtime.simulation.assistTargetIndex,
    })

  const getAutoTargetDecision = () => {
    const decision = getTargetDecision(true)
    currentAutoTargetId = decision.target.id
    return decision
  }

  const getManualTargetDecision = () => getTargetDecision(false)

  const getAssistTargetUiState = (): AssistTargetUiState => {
    const forcedTargetId =
      options.runtime.scenario.directives.forcedAssistTargetId
    if (forcedTargetId) {
      const forcedTarget = options.runtime.simulation.state.bodies.find(
        (body) => body.id === forcedTargetId,
      )
      if (forcedTarget) {
        lastAssistTargetDebug = null
        return {
          activeTarget: forcedTarget,
          mode: 'forced',
          recommendedTarget: null,
        }
      }
    }

    if (
      options.autoSelectNearestSurface &&
      options.runtime.simulation.assistTargetSelectionMode === 'auto'
    ) {
      const decision = getAutoTargetDecision()
      lastAssistTargetDebug = decision.debug
      return {
        activeTarget: decision.target,
        mode: 'auto',
        recommendedTarget: null,
      }
    }

    const manualDecision = getManualTargetDecision()
    lastAssistTargetDebug = manualDecision.debug
    const autoDecision = options.autoSelectNearestSurface
      ? getAutoTargetDecision()
      : null
    const recommendedTarget =
      autoDecision && autoDecision.target.id !== manualDecision.target.id
        ? autoDecision.target
        : null

    return {
      activeTarget: manualDecision.target,
      mode: 'manual',
      recommendedTarget,
    }
  }

  const getAssistTarget = () => {
    return getAssistTargetUiState().activeTarget
  }

  const getCaptureMetrics = (target: Body) =>
    getCaptureMetricsForState(options.runtime.simulation.state, target)

  return {
    getAssistTargetDebug: () => lastAssistTargetDebug,
    getAssistPredictionControls: (simulationState, targetId) =>
      getAssistPredictionControlsForState(
        simulationState,
        targetId,
        options.runtime.simulation.assistMode,
        options.autopilotRotationRate,
      ),
    getAssistTarget,
    getAssistTargetUiState,
    getAutopilotTurn: (desiredHeading) =>
      getAutopilotTurnForHeading(
        options.runtime.simulation.state.spacecraft.heading,
        desiredHeading,
        options.autopilotRotationRate,
      ),
    getCaptureMetrics,
    getCircularizePlan: (target) =>
      getCircularizePlanForState(options.runtime.simulation.state, target),
    getCoastPredictionHorizonSeconds: () =>
      options.runtime.simulation.coastPredictionHorizonHours * 60 * 60,
    getPredictionConfig: () =>
      getTrajectoryPredictionConfig(
        options.runtime.simulation.coastPredictionHorizonHours * 60 * 60,
        options.predictionSampling,
        options.maxPredictionLoopRevolutions,
      ),
    shouldCaptureBurn: (target) =>
      shouldCaptureBurnForMetrics(getCaptureMetrics(target)),
  }
}

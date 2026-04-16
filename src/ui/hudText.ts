import type {
  AssistMode,
  CaptureMetrics,
  CircularizePlan,
} from '../assist/orbitalAssist'
import {
  shouldCaptureBurnForMetrics,
  shouldCircularizeBurn,
} from '../assist/orbitalAssist'
import type {
  PredictedClosestApproach,
  PredictedImpact,
} from '../prediction/trajectoryPrediction'
import type { BodyInfluence } from '../simulation/bodyInfluence'
import {
  formatBodyInfluences,
  formatDistance,
  formatDuration,
  formatSpecificEnergy,
} from './formatters'

export type GuidanceTextInput = {
  assistMode: AssistMode
  circularizePlan: CircularizePlan | null
  crashedBodyName: string | null
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  targetMetrics: CaptureMetrics
}

const getCaptureGuidanceText = ({
  assistMode,
  circularizePlan,
  predictedImpact,
  predictedTargetClosestApproach,
  targetMetrics,
}: Omit<GuidanceTextInput, 'crashedBodyName'>) => {
  if (!targetMetrics.insideRange) {
    if (predictedTargetClosestApproach) {
      return `Pe ${formatDistance(Math.max(0, predictedTargetClosestApproach.altitude))} in ${formatDuration(predictedTargetClosestApproach.time)}`
    }

    return `Close in ${formatDistance(targetMetrics.distance - targetMetrics.roughAssistRange)}`
  }

  if (assistMode === 'circularize') {
    if (targetMetrics.specificEnergy >= 0 || !circularizePlan) {
      return 'Need capture first'
    }

    return shouldCircularizeBurn(targetMetrics, circularizePlan)
      ? `Circularizing ${circularizePlan.deltaV.toFixed(0)} m/s`
      : 'Orbit stable-ish'
  }

  if (targetMetrics.specificEnergy < 0 && !predictedImpact) {
    return 'Captured: circularize'
  }

  if (shouldCaptureBurnForMetrics(targetMetrics)) {
    return assistMode === 'capture' ? 'Burning retrograde' : 'Ready: press C'
  }

  if (targetMetrics.relativeSpeed < targetMetrics.circularSpeed * 0.75) {
    return 'Slow: watch escape'
  }

  return 'Near capture speed'
}

export const getGuidanceText = (input: GuidanceTextInput) => {
  if (input.crashedBodyName) {
    return `Hit ${input.crashedBodyName}. Press R`
  }

  if (input.predictedImpact) {
    return `Impact ${input.predictedImpact.bodyName} in ${formatDuration(input.predictedImpact.time)}`
  }

  return getCaptureGuidanceText(input)
}

export type DebugPanelTextInput = {
  assistMode: AssistMode
  bodyInfluences: BodyInfluence[]
  coastPredictionHorizonSeconds: number
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  performanceDebugEnabled: boolean
  predictionStepSeconds: number
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  smoothedCpuMs: number
  smoothedGpuMs: number | null
  targetMetrics: CaptureMetrics
  targetName: string
}

export const getDebugPanelLines = (input: DebugPanelTextInput) => {
  const lines = [
    `debug: [1] no-gravity ${input.debugNoGravityEnabled ? 'on' : 'off'} | [2] fps ${input.fpsIndicatorEnabled ? 'on' : 'off'} | [3] perf ${
      input.performanceDebugEnabled ? 'on' : 'off'
    }`,
    `coast horizon: [4]/2 [5]x2 => ${formatDuration(input.coastPredictionHorizonSeconds)}`,
    `prediction step: ${formatDuration(input.predictionStepSeconds)}`,
    `snapshot: [6] save | [7] load${input.debugSnapshotStatus ? ` | ${input.debugSnapshotStatus}` : ''}`,
    `target: ${input.targetName}`,
    `gravity: ${formatBodyInfluences(input.bodyInfluences)}`,
    `surface: ${formatDistance(input.targetMetrics.surfaceDistance)} | range: ${input.targetMetrics.insideRange ? 'inside' : 'outside'}`,
    `v_rel: ${input.targetMetrics.relativeSpeed.toFixed(0)} m/s | v_circ: ${input.targetMetrics.circularSpeed.toFixed(0)} m/s`,
    `energy: ${formatSpecificEnergy(input.targetMetrics.specificEnergy)} | ${input.targetMetrics.specificEnergy < 0 ? 'bound' : 'unbound'}`,
    `assist: ${input.assistMode}`,
    input.predictedTargetClosestApproach
      ? `pred Pe: ${formatDistance(Math.max(0, input.predictedTargetClosestApproach.altitude))} in ${formatDuration(input.predictedTargetClosestApproach.time)}`
      : 'pred Pe: calculating',
    input.predictedImpact
      ? `pred impact: ${input.predictedImpact.bodyName} in ${formatDuration(input.predictedImpact.time)}`
      : 'pred impact: none',
  ]

  if (input.performanceDebugEnabled) {
    const frameBudgetMs60 = 1000 / 60
    const frameBudgetMs30 = 1000 / 30
    const limitingFrameMs =
      input.smoothedGpuMs === null
        ? input.smoothedCpuMs
        : Math.max(input.smoothedCpuMs, input.smoothedGpuMs)
    lines.push(
      `cpu: ${input.smoothedCpuMs.toFixed(2)} ms | gpu: ${input.smoothedGpuMs === null ? 'n/a' : `${input.smoothedGpuMs.toFixed(2)} ms`}`,
      `headroom60: ${(frameBudgetMs60 - limitingFrameMs).toFixed(2)} ms | headroom30: ${(frameBudgetMs30 - limitingFrameMs).toFixed(2)} ms`,
    )
  }

  return lines
}

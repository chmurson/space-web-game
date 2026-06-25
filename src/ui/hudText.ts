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
import type { BrowserGcProbeStats } from '../runtime/browserGcProbe'
import type { BodyInfluence } from '../simulation/bodyInfluence'
import {
  formatBodyInfluences,
  formatDistance,
  formatDuration,
  formatSpecificEnergy,
  formatTrajectoryHorizonDuration,
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
  scenarioCompleted: boolean
  scenarioId: string
  scenarioState: unknown
  debugNoGravityEnabled: boolean
  debugSnapshotStatus: string
  fpsIndicatorEnabled: boolean
  predictionStepSeconds: number
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  targetMetrics: CaptureMetrics
  targetName: string
  trailDetail: {
    label: string
    level: number
    levelCount: number
    captureSampleDistanceMeters: number
    renderedSliceCount: number
    renderSampleDistanceMeters: number
  }
  viewportSize: number
  zoom: number
}

const getGcProbeMode = (stats: BrowserGcProbeStats) => {
  if (stats.nativeObserverSupported) {
    return 'native'
  }

  return stats.heapSamplingSupported ? 'heap-drop' : 'frame-gap'
}

const getRecordValue = (
  value: unknown,
  key: string,
): string | number | boolean | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = (value as Record<string, unknown>)[key]
  return typeof entry === 'string' ||
    typeof entry === 'number' ||
    typeof entry === 'boolean'
    ? entry
    : null
}

const getRequiredOrbitTurns = (scenarioId: string, phase: string) => {
  if (phase === 'orbit-moon') {
    return 3
  }

  if (phase === 'orbit-earth') {
    return scenarioId === 'reach-moon' ? 1 : 3
  }

  return null
}

const getScenarioProgressLine = (input: DebugPanelTextInput) => {
  const phase = getRecordValue(input.scenarioState, 'phase')
  const orbitTurnsCompleted = getRecordValue(
    input.scenarioState,
    'orbitTurnsCompleted',
  )
  const orbitProgressRadians = getRecordValue(
    input.scenarioState,
    'orbitProgressRadians',
  )
  const segments = [`scenario: ${input.scenarioId}`]

  if (typeof phase === 'string') {
    segments.push(`phase ${phase}`)

    const requiredTurns = getRequiredOrbitTurns(input.scenarioId, phase)
    if (requiredTurns !== null && typeof orbitTurnsCompleted === 'number') {
      segments.push(`orbits ${orbitTurnsCompleted}/${requiredTurns}`)
    }

    if (requiredTurns !== null && typeof orbitProgressRadians === 'number') {
      const progressPercent = Math.min(
        100,
        Math.abs(orbitProgressRadians / (Math.PI * 2 * requiredTurns)) * 100,
      )
      segments.push(`${progressPercent.toFixed(0)}%`)
    }
  }

  if (input.scenarioCompleted) {
    segments.push('complete')
  }

  return segments.join(' | ')
}

export const getDebugPanelLines = (input: DebugPanelTextInput) => {
  return [
    `debug: [1] no-gravity ${input.debugNoGravityEnabled ? 'on' : 'off'} | [2] fps ${input.fpsIndicatorEnabled ? 'on' : 'off'}`,
    getScenarioProgressLine(input),
    `coast horizon: [4]- [5]+ => ${formatTrajectoryHorizonDuration(input.coastPredictionHorizonSeconds)}`,
    `prediction step: ${formatDuration(input.predictionStepSeconds)}`,
    `snapshot: [6] save | [7] load${input.debugSnapshotStatus ? ` | ${input.debugSnapshotStatus}` : ''}`,
    `viewport: ${input.viewportSize.toFixed(2)} | zoom: ${input.zoom.toFixed(1)}x`,
    `trail detail: L${input.trailDetail.level}/${input.trailDetail.levelCount} ${input.trailDetail.label} | slices ${input.trailDetail.renderedSliceCount} | render ${formatDistance(input.trailDetail.renderSampleDistanceMeters)} | capture ${formatDistance(input.trailDetail.captureSampleDistanceMeters)}`,
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
}

export type FpsMeterStatus = 'good' | 'warning' | 'danger'

export type FpsMeterStatusInput = {
  smoothedCpuMs: number
  smoothedFps: number
  smoothedGpuMs: number | null
}

export type FpsMeterTextInput = FpsMeterStatusInput & {
  browserGcStats: BrowserGcProbeStats
}

export type FpsMeterFrameSample = {
  atMs: number
  frameMs: number
}

export type FpsMeterGraphInput = {
  browserGcStats: BrowserGcProbeStats
  frameSamples: readonly FpsMeterFrameSample[]
  nowMs: number
}

export type FpsMeterGraphModel = {
  budgetLineY: number
  gcMarkerXs: number[]
  height: number
  path: string
  width: number
}

const frameBudgetMs60 = 1000 / 60
const fpsMeterGraphWindowMs = 5_000
const fpsMeterGraphWidth = 112
const fpsMeterGraphHeight = 28
const fpsMeterGraphMaxFrameMs = 80

const formatSignedMs = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}ms`

const getLimitingWorkMs = (input: FpsMeterStatusInput) =>
  input.smoothedGpuMs === null
    ? input.smoothedCpuMs
    : Math.max(input.smoothedCpuMs, input.smoothedGpuMs)

const getCompactGcProbeText = (stats: BrowserGcProbeStats) => {
  const mode = getGcProbeMode(stats)
  const label = mode === 'native' ? 'gc' : 'gc?'

  if (!stats.isEnabled) {
    return `${label} off`
  }

  if (stats.eventCount === 0) {
    return `${label} 0`
  }

  return `${label} ${stats.eventCount} l${
    stats.lastEstimatedPauseMs?.toFixed(1) ?? 'n/a'
  } m${stats.longestEstimatedPauseMs.toFixed(1)}`
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const formatGraphNumber = (value: number) => value.toFixed(1)

export const getFpsMeterGraphModel = (
  input: FpsMeterGraphInput,
): FpsMeterGraphModel => {
  const windowStartMs = input.nowMs - fpsMeterGraphWindowMs
  const toX = (atMs: number) =>
    clamp(
      ((atMs - windowStartMs) / fpsMeterGraphWindowMs) * fpsMeterGraphWidth,
      0,
      fpsMeterGraphWidth,
    )
  const toY = (frameMs: number) =>
    fpsMeterGraphHeight -
    clamp(frameMs / fpsMeterGraphMaxFrameMs, 0, 1) * fpsMeterGraphHeight

  const points = input.frameSamples
    .filter(
      (sample) => sample.atMs >= windowStartMs && sample.atMs <= input.nowMs,
    )
    .map((sample) => ({
      x: toX(sample.atMs),
      y: toY(sample.frameMs),
    }))

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatGraphNumber(point.x)} ${formatGraphNumber(point.y)}`,
    )
    .join(' ')

  return {
    budgetLineY: toY(frameBudgetMs60),
    gcMarkerXs: input.browserGcStats.recentEvents
      .filter(
        (event) => event.atMs >= windowStartMs && event.atMs <= input.nowMs,
      )
      .map((event) => toX(event.atMs)),
    height: fpsMeterGraphHeight,
    path,
    width: fpsMeterGraphWidth,
  }
}

export const getFpsMeterStatus = (
  input: FpsMeterStatusInput,
): FpsMeterStatus => {
  const limitingWorkMs = getLimitingWorkMs(input)

  if (input.smoothedFps < 45 || limitingWorkMs > frameBudgetMs60) {
    return 'danger'
  }
  if (input.smoothedFps < 55 || limitingWorkMs > frameBudgetMs60 * 0.8) {
    return 'warning'
  }

  return 'good'
}

export const getFpsMeterText = (input: FpsMeterTextInput) => {
  const safeFps = Math.max(input.smoothedFps, 1)
  const frameMs = 1000 / safeFps
  const headroomMs = frameBudgetMs60 - getLimitingWorkMs(input)
  const gpuText =
    input.smoothedGpuMs === null
      ? 'gpu n/a'
      : `gpu ${input.smoothedGpuMs.toFixed(1)}ms`
  const cycleText = `cpu ${input.smoothedCpuMs.toFixed(1)}ms | ${gpuText}`

  return [
    `FPS ${input.smoothedFps.toFixed(1)}`,
    `frame ${frameMs.toFixed(1)}ms`,
    cycleText,
    `60Hz ${formatSignedMs(headroomMs)}`,
    getCompactGcProbeText(input.browserGcStats),
  ].join('\n')
}

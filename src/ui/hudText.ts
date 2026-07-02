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
    renderFrame: 'inertial' | 'target-relative'
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

  return stats.heapSamplingSupported ? 'heap-drop' : 'unsupported'
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
  const trailFrame =
    input.trailDetail.renderFrame === 'target-relative'
      ? `target-relative ${input.targetName}`
      : 'inertial'

  return [
    `debug: [1] no-gravity ${input.debugNoGravityEnabled ? 'on' : 'off'} | [2] fps ${input.fpsIndicatorEnabled ? 'on' : 'off'}`,
    getScenarioProgressLine(input),
    `coast horizon: [4]- [5]+ => ${formatTrajectoryHorizonDuration(input.coastPredictionHorizonSeconds)}`,
    `prediction step: ${formatDuration(input.predictionStepSeconds)}`,
    `snapshot: [6] save | [7] load${input.debugSnapshotStatus ? ` | ${input.debugSnapshotStatus}` : ''}`,
    `viewport: ${input.viewportSize.toFixed(2)} | zoom: ${input.zoom.toFixed(1)}x`,
    `trail detail: L${input.trailDetail.level}/${input.trailDetail.levelCount} ${input.trailDetail.label} | slices ${input.trailDetail.renderedSliceCount} | render ${formatDistance(input.trailDetail.renderSampleDistanceMeters)} | capture ${formatDistance(input.trailDetail.captureSampleDistanceMeters)} | trail frame: ${trailFrame}`,
    `assist target: ${input.targetName}`,
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
  graphMaxCpuMs: number | null
}

export type FpsMeterFrameSample = {
  atMs: number
  cpuMs: number
}

export type FpsMeterGraphInput = {
  browserGcStats: BrowserGcProbeStats
  frameSamples: readonly FpsMeterFrameSample[]
  nowMs: number
}

export type FpsMeterGraphModel = {
  budgetLineY: number
  gcMarkerXs: number[]
  maxCpuMs: number | null
  height: number
  path: string
  width: number
}

const frameBudgetMs60 = 1000 / 60
const fpsMeterDangerBudgetRatio = 1.5
const fpsMeterDangerFps = 24
const fpsMeterGraphWindowMs = 5_000
const fpsMeterGraphWidth = 112
const fpsMeterGraphHeight = 28
const fpsMeterWarningFps = 28

const formatSignedMs = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}ms`

const getLimitingWorkMs = (input: FpsMeterStatusInput) =>
  input.smoothedGpuMs === null
    ? input.smoothedCpuMs
    : Math.max(input.smoothedCpuMs, input.smoothedGpuMs)

const getFrameMsForFps = (fps: number) => 1000 / Math.max(fps, 1)

const getCompactGcProbeText = (stats: BrowserGcProbeStats) => {
  const mode = getGcProbeMode(stats)
  const label = mode === 'native' ? 'gc' : 'gc?'

  if (!stats.isEnabled) {
    return `${label} off`
  }

  if (mode === 'unsupported') {
    return 'gc n/a'
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
  let minCpuMs: number | null = null
  let maxCpuMs: number | null = null
  const frameBuckets = Array<number>(fpsMeterGraphWidth + 1).fill(-1)
  for (const sample of input.frameSamples) {
    if (sample.atMs < windowStartMs || sample.atMs > input.nowMs) {
      continue
    }

    minCpuMs = Math.min(minCpuMs ?? Number.POSITIVE_INFINITY, sample.cpuMs)
    maxCpuMs = Math.max(maxCpuMs ?? 0, sample.cpuMs)
    const bucketX = Math.round(toX(sample.atMs))
    frameBuckets[bucketX] = Math.max(frameBuckets[bucketX], sample.cpuMs)
  }

  const minScaleCpuMs = minCpuMs ?? 0
  const graphScaleCpuRangeMs = Math.max(
    (maxCpuMs ?? frameBudgetMs60) - minScaleCpuMs,
    Number.EPSILON,
  )
  const toY = (cpuMs: number) =>
    fpsMeterGraphHeight -
    clamp((cpuMs - minScaleCpuMs) / graphScaleCpuRangeMs, 0, 1) *
      fpsMeterGraphHeight

  const pathSegments: string[] = []
  for (let x = 0; x < frameBuckets.length; x += 1) {
    const frameMs = frameBuckets[x]
    if (frameMs < 0) {
      continue
    }

    pathSegments.push(
      `${pathSegments.length === 0 ? 'M' : 'L'} ${formatGraphNumber(x)} ${formatGraphNumber(toY(frameMs))}`,
    )
  }

  const gcMarkerXs: number[] = []
  for (const event of input.browserGcStats.recentEvents) {
    if (event.atMs >= windowStartMs && event.atMs <= input.nowMs) {
      gcMarkerXs.push(toX(event.atMs))
    }
  }

  return {
    budgetLineY: toY(frameBudgetMs60),
    gcMarkerXs,
    maxCpuMs,
    height: fpsMeterGraphHeight,
    path: pathSegments.join(' '),
    width: fpsMeterGraphWidth,
  }
}

export const getFpsMeterStatus = (
  input: FpsMeterStatusInput,
): FpsMeterStatus => {
  const limitingWorkMs = getLimitingWorkMs(input)

  if (
    limitingWorkMs > frameBudgetMs60 * fpsMeterDangerBudgetRatio ||
    input.smoothedFps < fpsMeterDangerFps
  ) {
    return 'danger'
  }
  if (
    limitingWorkMs > frameBudgetMs60 ||
    input.smoothedFps < fpsMeterWarningFps
  ) {
    return 'warning'
  }

  return 'good'
}

export const getFpsMeterText = (input: FpsMeterTextInput) => {
  const frameMs = getFrameMsForFps(input.smoothedFps)
  const maxFrameText =
    input.graphMaxCpuMs === null
      ? 'cpu max n/a'
      : `cpu max ${input.graphMaxCpuMs.toFixed(1)}ms`
  const headroomMs = frameBudgetMs60 - getLimitingWorkMs(input)
  const gpuText =
    input.smoothedGpuMs === null
      ? 'gpu n/a'
      : `gpu ${input.smoothedGpuMs.toFixed(1)}ms`
  const cycleText = `cpu ${input.smoothedCpuMs.toFixed(1)}ms | ${gpuText}`

  return [
    `FPS ${input.smoothedFps.toFixed(1)}`,
    `frame ${frameMs.toFixed(1)}ms`,
    maxFrameText,
    cycleText,
    `60Hz ${formatSignedMs(headroomMs)}`,
    getCompactGcProbeText(input.browserGcStats),
  ].join('\n')
}

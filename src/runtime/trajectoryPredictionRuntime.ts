import type { AssistMode, CaptureMetrics } from '../assist/orbitalAssist'
import {
  createFarTrajectoryPredictionStateSnapshot,
  type FarTrajectoryPredictionCoastWindow,
  type FarTrajectoryPredictionCoastWindowFallbackReason,
  type FarTrajectoryPredictionDivergenceDiagnostics,
  type FarTrajectoryPredictionRequestPayload,
  type FarTrajectoryPredictionResultPayload,
  type FarTrajectoryPredictionReuseDiagnostics,
  type FarTrajectoryPredictionReuseFallbackReason,
  sliceFarTrajectoryPredictionCoastWindow,
} from '../prediction/farTrajectoryPrediction'
import {
  canUseKeplerTwoBodyPrediction,
  computeKeplerTwoBodyTrajectoryPrediction,
  getClosedKeplerTwoBodyOrbitPeriod,
} from '../prediction/keplerTwoBody'
import {
  type CoastTrajectoryPredictionTerminationReason,
  computeCoastTrajectoryPrediction,
  getCoastTrajectoryPredictionMaxIntegrationStepSeconds,
  type PredictedClosestApproach,
  type PredictedImpact,
  predictAssistedTrajectory,
  type TrajectoryPredictionConfig,
  type TrajectoryPredictionEventMarker,
  type TrajectoryPredictionImplementation,
  type TrajectoryPredictionIntegrationDiagnostics,
  type TrajectoryPredictionResult,
} from '../prediction/trajectoryPrediction'
import type {
  Body,
  ControlInput,
  PhysicsEngine,
  SimulationState,
} from '../simulation/types'
import { length, sub, type Vec2 } from '../simulation/vector'
import {
  createTrajectoryPredictionFarWorkerClient,
  type TrajectoryPredictionFarWorkerClient,
  type TrajectoryPredictionFarWorkerClientFactory,
  type TrajectoryPredictionFarWorkerError,
} from './trajectoryPredictionWorkerClient'

export type TrajectoryPredictionState = {
  absolutePredictionEnd: Vec2 | null
  absolutePredictionPoints: Vec2[]
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  targetId: string | null
  targetRelativeEventMarkers: TrajectoryPredictionEventMarker[]
  targetRelativeAssistedPoints: Vec2[]
  targetRelativePredictionEnd: Vec2 | null
  targetRelativePredictionPoints: Vec2[]
}

export type TrajectoryPredictionRefreshReason =
  | 'assist-change'
  | 'body-state-change'
  | 'controls-change'
  | 'horizon-change'
  | 'initial'
  | 'manual'
  | 'orbit-policy-change'
  | 'sampling-change'
  | 'spacecraft-change'
  | 'target-change'
  | 'timed-refresh'

export type TrajectoryPredictionFarVisibility =
  | 'current'
  | 'none'
  | 'retained-stale'

export type TrajectoryPredictionEventKind =
  | 'far-complete'
  | 'far-replaced'
  | 'refresh'

export type TrajectoryPredictionFarCoalescingSkipStage = 'request' | 'result'

export type TrajectoryPredictionFarCoalescingSkipReason = 'cooldown'

export type TrajectoryPredictionInputChangePart =
  | 'assist'
  | 'bodies'
  | 'controls'
  | 'horizon'
  | 'sampling'
  | 'spacecraft'
  | 'target'

export type TrajectoryPredictionDiagnosticEvent = {
  activeFar: boolean
  activeFarInputKeyShort: string | null
  changedParts: TrajectoryPredictionInputChangePart[]
  dtMs: number | null
  elapsedSinceRefreshSeconds: number
  event: TrajectoryPredictionEventKind
  farApplied: boolean
  farCalculationMs: number | null
  farInputKeyShort: string | null
  farPointCount: number
  farVisible: TrajectoryPredictionFarVisibility
  horizonSeconds: number
  inputKeyShort: string
  nearCalculationMs: number | null
  nearPointCount: number
  pendingFar: boolean
  pendingFarInputKeyShort: string | null
  reason: TrajectoryPredictionRefreshReason
  refreshIntervalSeconds: number
  splitHorizon: boolean
  t: number
  visiblePointCount: number
}

export type TrajectoryPredictionCalculationWindowDiagnostics = {
  averageLastSecondMs: number | null
  averageLastTenSecondsMs: number | null
  averageLastThirtySecondsMs: number | null
  countLastSecond: number
  countLastTenSeconds: number
  countLastThirtySeconds: number
}

export type TrajectoryPredictionTierIntegrationDiagnostics = {
  far: TrajectoryPredictionIntegrationDiagnostics | null
  near: TrajectoryPredictionIntegrationDiagnostics | null
}

export type TrajectoryPredictionNearTravelDiagnostics = {
  distanceSinceCalculationMeters: number | null
  horizonDistanceMeters: number | null
  horizonRatio: number | null
  lastCalculationGapMeters: number | null
  lastCalculationGapRatio: number | null
  lastStepDistanceMeters: number | null
  lastStepHorizonRatio: number | null
}

export type TrajectoryPredictionFarReuseDiagnostic =
  FarTrajectoryPredictionReuseDiagnostics & {
    elapsedSeconds: number
    horizonSeconds: number
  }

export type TrajectoryPredictionNearSource = 'accepted-window' | 'synchronous'

export type TrajectoryPredictionNearFallbackReason =
  | FarTrajectoryPredictionCoastWindowFallbackReason
  | 'no-accepted-window'
  | 'not-passive-coast'
  | 'semantic-change'
  | 'state-diverged'

export type TrajectoryPredictionDiagnostics = {
  absolutePointCount: number
  activeFar: boolean
  activeFarInputKeyShort: string | null
  assistedPointCount: number
  elapsedSinceRefreshSeconds: number
  events: TrajectoryPredictionDiagnosticEvent[]
  eventMarkerCount: number
  farCalculationAgeSeconds: number | null
  farCalculationAverageMs: number | null
  farCalculationMs: number | null
  farCalculationSampleCount: number
  farCalculationWindows: TrajectoryPredictionCalculationWindowDiagnostics
  farCoalescingLastSkipReason: TrajectoryPredictionFarCoalescingSkipReason | null
  farCoalescingLastSkipStage: TrajectoryPredictionFarCoalescingSkipStage | null
  farCoalescingMinIntervalOverrideSeconds: number | null
  farCoalescingMinIntervalSeconds: number
  farCoalescingSkippedCount: number
  farInputKeyShort: string | null
  farPointCount: number
  farReuseDivergence: FarTrajectoryPredictionDivergenceDiagnostics | null
  farReuseExtendedPointCount: number
  farReuseExtendedSeconds: number
  farReuseFallbackReason: FarTrajectoryPredictionReuseFallbackReason | null
  farReuseHistory: TrajectoryPredictionFarReuseDiagnostic[]
  farReuseMode: 'full' | 'trim-extend' | null
  farReuseRetainedPointCount: number
  farReuseRetainedSeconds: number
  farReuseTrimmedPointCount: number
  farReuseTrimmedSeconds: number
  farReuseValidation: 'full' | 'performed' | 'skipped' | null
  farReuseValidationSeconds: number
  farVisible: TrajectoryPredictionFarVisibility
  geometryUpdateMs: number
  hasFarTier: boolean
  horizonSeconds: number
  inputKey: string | null
  inputKeyShort: string | null
  integrationStepSeconds: number
  integrationTiers: TrajectoryPredictionTierIntegrationDiagnostics
  nearCalculationAgeSeconds: number | null
  nearCalculationAverageMs: number | null
  nearCalculationMs: number | null
  nearCalculationSampleCount: number
  nearCalculationTravel: TrajectoryPredictionNearTravelDiagnostics
  nearCalculationWindows: TrajectoryPredictionCalculationWindowDiagnostics
  nearFallbackReason: TrajectoryPredictionNearFallbackReason | null
  nearPointCount: number
  nearSource: TrajectoryPredictionNearSource | null
  pendingFar: boolean
  pendingFarInputKeyShort: string | null
  predictionRefreshMs: number
  predictionAnchorElapsed: number | null
  predictionTerminationReason: CoastTrajectoryPredictionTerminationReason | null
  refreshCountLastSecond: number
  refreshIntervalSeconds: number
  refreshReason: TrajectoryPredictionRefreshReason | null
  relativePointCount: number
  remainingUsableCoverageSeconds: number
  retainedFarPointCount: number
  retainedNearPointCount: number
  sampleStepSeconds: number
  splitHorizon: boolean
  visiblePointCount: number
}

export type RefreshTrajectoryPredictionOptions = {
  assistMode: AssistMode
  autopilotRotationRate: number
  getAssistPredictionControls(
    simulationState: SimulationState,
    targetId: string,
  ): ControlInput
  getAssistTarget(): Body
  getCaptureMetrics(target: Body): CaptureMetrics
  physicsEngine: PhysicsEngine
  predictionConfig: TrajectoryPredictionConfig
  state: SimulationState
  timeWarp: number
}

type PredictionInputKeyParts = {
  assist: string
  bodies: string
  config: string
  controls: string
  spacecraft: string
  target: string
}

type TrajectoryPredictionTier = {
  assistedPoints: Vec2[]
  coastPrediction: TrajectoryPredictionResult
  coverageSeconds: number
  inputKey: string
  targetId: string
  terminationReason: CoastTrajectoryPredictionTerminationReason
}

type TrajectoryPredictionFarRequest = {
  coalescingMinIntervalSeconds: number | null
  inputKey: string
  jobId: number
  payload: FarTrajectoryPredictionRequestPayload
  semanticInputKey: string
}

type AcceptedCoastPredictionWindow = {
  coastPrediction: TrajectoryPredictionResult
  coastWindow: FarTrajectoryPredictionCoastWindow
  semanticInputKey: string
  targetId: string
}

type AcceptedCoastPredictionWindowTiers = {
  farTier: TrajectoryPredictionTier
  nearTier: TrajectoryPredictionTier
  predictionAnchorElapsed: number
  predictionTerminationReason: CoastTrajectoryPredictionTerminationReason
  remainingUsableCoverageSeconds: number
  retainedFarPointCount: number
  retainedNearPointCount: number
}

export type CreateTrajectoryPredictionRuntimeOptions = {
  createFarWorkerClient?: TrajectoryPredictionFarWorkerClientFactory
  predictionImplementation?: TrajectoryPredictionImplementation
}

type CalculationTimingStats = {
  count: number
  lastAtMs: number | null
  samples: Array<{ calculationMs: number; t: number }>
  totalMs: number
}

const emptyCalculationWindowDiagnostics =
  (): TrajectoryPredictionCalculationWindowDiagnostics => ({
    averageLastSecondMs: null,
    averageLastTenSecondsMs: null,
    averageLastThirtySecondsMs: null,
    countLastSecond: 0,
    countLastTenSeconds: 0,
    countLastThirtySeconds: 0,
  })

const emptyTrajectoryPredictionState = (): TrajectoryPredictionState => ({
  absolutePredictionEnd: null,
  absolutePredictionPoints: [],
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  targetId: null,
  targetRelativeEventMarkers: [],
  targetRelativeAssistedPoints: [],
  targetRelativePredictionEnd: null,
  targetRelativePredictionPoints: [],
})

export const emptyTrajectoryPredictionDiagnostics =
  (): TrajectoryPredictionDiagnostics => ({
    absolutePointCount: 0,
    activeFar: false,
    activeFarInputKeyShort: null,
    assistedPointCount: 0,
    elapsedSinceRefreshSeconds: 0,
    events: [],
    eventMarkerCount: 0,
    farCalculationAgeSeconds: null,
    farCalculationAverageMs: null,
    farCalculationMs: null,
    farCalculationSampleCount: 0,
    farCalculationWindows: emptyCalculationWindowDiagnostics(),
    farCoalescingLastSkipReason: null,
    farCoalescingLastSkipStage: null,
    farCoalescingMinIntervalOverrideSeconds: null,
    farCoalescingMinIntervalSeconds: 0,
    farCoalescingSkippedCount: 0,
    farInputKeyShort: null,
    farPointCount: 0,
    farReuseDivergence: null,
    farReuseExtendedPointCount: 0,
    farReuseExtendedSeconds: 0,
    farReuseFallbackReason: null,
    farReuseHistory: [],
    farReuseMode: null,
    farReuseRetainedPointCount: 0,
    farReuseRetainedSeconds: 0,
    farReuseTrimmedPointCount: 0,
    farReuseTrimmedSeconds: 0,
    farReuseValidation: null,
    farReuseValidationSeconds: 0,
    farVisible: 'none',
    geometryUpdateMs: 0,
    hasFarTier: false,
    horizonSeconds: 0,
    inputKey: null,
    inputKeyShort: null,
    integrationStepSeconds: 0,
    integrationTiers: {
      far: null,
      near: null,
    },
    nearCalculationAgeSeconds: null,
    nearCalculationAverageMs: null,
    nearCalculationMs: null,
    nearCalculationSampleCount: 0,
    nearCalculationTravel: {
      distanceSinceCalculationMeters: null,
      horizonDistanceMeters: null,
      horizonRatio: null,
      lastCalculationGapMeters: null,
      lastCalculationGapRatio: null,
      lastStepDistanceMeters: null,
      lastStepHorizonRatio: null,
    },
    nearCalculationWindows: emptyCalculationWindowDiagnostics(),
    nearFallbackReason: null,
    nearPointCount: 0,
    nearSource: null,
    pendingFar: false,
    pendingFarInputKeyShort: null,
    predictionRefreshMs: 0,
    predictionAnchorElapsed: null,
    predictionTerminationReason: null,
    refreshCountLastSecond: 0,
    refreshIntervalSeconds: 0,
    refreshReason: null,
    relativePointCount: 0,
    remainingUsableCoverageSeconds: 0,
    retainedFarPointCount: 0,
    retainedNearPointCount: 0,
    sampleStepSeconds: 0,
    splitHorizon: false,
    visiblePointCount: 0,
  })

const recentRefreshWindowMs = 1_000
const calculationSampleWindowMs = 30_000
const diagnosticEventLimit = 100
const farReuseHistoryLimit = 100
const baseNearPredictionHorizonSeconds = 10 * 60
const nearPredictionMovementBudgetRatio = 0.01
const nowMs = () => performance.now()

const farCoalescingHorizonHourCeilings = [
  8, 24, 48, 96, 192, 384, 768, 3_072,
] as const

const farCoalescingWarpFactorCeilings = [
  1, 10, 60, 300, 1_800, 7_200, 18_000,
] as const

const farCoalescingMinIntervalFloorSeconds = 0.25
const activeThrustFarCoalescingSimSeconds = 1
const refreshFarAfterEveryPart = 24
const farCoalescingMinIntervalSecondsByBucket =
  farCoalescingHorizonHourCeilings.map((horizonHours) =>
    farCoalescingWarpFactorCeilings.map((warpFactor) =>
      Math.max(
        (horizonHours * 3_600) / warpFactor / refreshFarAfterEveryPart,
        farCoalescingMinIntervalFloorSeconds,
      ),
    ),
  )

const getDefaultFarCoalescingMinIntervalSeconds = (
  horizonSeconds: number,
  timeWarp: number,
) => {
  const horizonHours = horizonSeconds / 3600
  const warp = Number.isFinite(timeWarp) ? timeWarp : 1
  const horizonIndex = farCoalescingHorizonHourCeilings.findIndex(
    (ceiling) => horizonHours <= ceiling,
  )
  const warpIndex = farCoalescingWarpFactorCeilings.findIndex(
    (ceiling) => warp <= ceiling,
  )
  const row =
    farCoalescingMinIntervalSecondsByBucket[
      horizonIndex >= 0
        ? horizonIndex
        : farCoalescingMinIntervalSecondsByBucket.length - 1
    ]

  return row[warpIndex >= 0 ? warpIndex : row.length - 1]
}

const getActiveThrustFarCoalescingMinIntervalSeconds = (timeWarp: number) => {
  const warp = Number.isFinite(timeWarp) && timeWarp > 0 ? timeWarp : 1
  return Math.max(
    activeThrustFarCoalescingSimSeconds / warp,
    farCoalescingMinIntervalFloorSeconds,
  )
}

const isActiveThrustControl = (controls: ControlInput) =>
  controls.main !== 0 || controls.reverse !== 0 || controls.strafe !== 0

const forcesFarPredictionRefresh = (
  reason: TrajectoryPredictionRefreshReason,
) =>
  reason === 'initial' ||
  reason === 'manual' ||
  reason === 'target-change' ||
  reason === 'horizon-change' ||
  reason === 'sampling-change' ||
  reason === 'assist-change' ||
  reason === 'orbit-policy-change'

const isPassiveCoast = (options: RefreshTrajectoryPredictionOptions) =>
  options.assistMode === 'off' &&
  options.state.controls.main === 0 &&
  options.state.controls.reverse === 0 &&
  options.state.controls.strafe === 0 &&
  options.state.controls.turn === 0

const canReuseAcceptedWindowForReason = (
  reason: TrajectoryPredictionRefreshReason,
) =>
  reason === 'body-state-change' ||
  reason === 'spacecraft-change' ||
  reason === 'timed-refresh'

const recordCalculationTiming = (
  stats: CalculationTimingStats,
  calculationMs: number | null,
  completedAtMs: number,
) => {
  if (calculationMs === null) {
    return
  }

  stats.count += 1
  stats.lastAtMs = completedAtMs
  stats.samples.push({ calculationMs, t: completedAtMs })
  stats.totalMs += calculationMs
}

const getAverageCalculationMs = (stats: CalculationTimingStats) =>
  stats.count > 0 ? stats.totalMs / stats.count : null

const getCalculationAgeSeconds = (
  stats: CalculationTimingStats,
  currentTimeMs: number,
) => (stats.lastAtMs === null ? null : (currentTimeMs - stats.lastAtMs) / 1000)

const getAverageSampleMs = (
  samples: CalculationTimingStats['samples'],
): number | null =>
  samples.length === 0
    ? null
    : samples.reduce((sum, sample) => sum + sample.calculationMs, 0) /
      samples.length

const getCalculationWindowDiagnostics = (
  stats: CalculationTimingStats,
  currentTimeMs: number,
): TrajectoryPredictionCalculationWindowDiagnostics => {
  const oldestSampleMs = currentTimeMs - calculationSampleWindowMs
  stats.samples = stats.samples.filter((sample) => sample.t >= oldestSampleMs)
  const lastSecond = stats.samples.filter(
    (sample) => sample.t >= currentTimeMs - 1_000,
  )
  const lastTenSeconds = stats.samples.filter(
    (sample) => sample.t >= currentTimeMs - 10_000,
  )

  return {
    averageLastSecondMs: getAverageSampleMs(lastSecond),
    averageLastTenSecondsMs: getAverageSampleMs(lastTenSeconds),
    averageLastThirtySecondsMs: getAverageSampleMs(stats.samples),
    countLastSecond: lastSecond.length,
    countLastTenSeconds: lastTenSeconds.length,
    countLastThirtySeconds: stats.samples.length,
  }
}

const getPathDistanceMeters = (points: Vec2[]) =>
  points.reduce((total, point, index) => {
    const previousPoint = points[index - 1]
    return previousPoint ? total + length(sub(point, previousPoint)) : total
  }, 0)

const quantize = (value: number, precision: number) =>
  Math.round(value / precision) * precision

const quantizeAngle = (value: number) => quantize(value, 0.0001)
const quantizePosition = (value: number) => quantize(value, 5_000)
const quantizeScalar = (value: number) => quantize(value, 0.001)
const quantizeVelocity = (value: number) => quantize(value, 5)

const createPredictionInputKeyParts = (
  options: RefreshTrajectoryPredictionOptions,
  target: Body,
): PredictionInputKeyParts => ({
  assist: JSON.stringify({
    mode: options.assistMode,
    targetId: target.id,
  }),
  bodies: JSON.stringify(
    options.state.bodies.map((body) => ({
      id: body.id,
      mass: quantizeScalar(body.mass),
      px: quantizePosition(body.position.x),
      py: quantizePosition(body.position.y),
      radius: quantizeScalar(body.radius),
      vx: quantizeVelocity(body.velocity.x),
      vy: quantizeVelocity(body.velocity.y),
    })),
  ),
  config: JSON.stringify({
    horizonSeconds: quantizeScalar(options.predictionConfig.horizonSeconds),
    maxIntegrationStepSeconds: quantizeScalar(
      options.predictionConfig.maxIntegrationStepSeconds,
    ),
    maxLoopRevolutions: quantizeScalar(
      options.predictionConfig.maxLoopRevolutions,
    ),
    refreshInterval: quantizeScalar(options.predictionConfig.refreshInterval),
    stepSeconds: quantizeScalar(options.predictionConfig.stepSeconds),
  }),
  controls: JSON.stringify({
    main: quantizeScalar(options.state.controls.main),
    reverse: quantizeScalar(options.state.controls.reverse),
    strafe: quantizeScalar(options.state.controls.strafe),
    turn: quantizeScalar(options.state.controls.turn),
  }),
  spacecraft: JSON.stringify({
    heading: quantizeAngle(options.state.spacecraft.heading),
    px: quantizePosition(options.state.spacecraft.position.x),
    py: quantizePosition(options.state.spacecraft.position.y),
    vx: quantizeVelocity(options.state.spacecraft.velocity.x),
    vy: quantizeVelocity(options.state.spacecraft.velocity.y),
  }),
  target: target.id,
})

const createPredictionInputKey = (parts: PredictionInputKeyParts) =>
  JSON.stringify(parts)

const createFarPredictionSemanticInputKey = (
  parts: PredictionInputKeyParts,
  generation: number,
  allowLoopTrim: boolean,
) =>
  JSON.stringify({
    allowLoopTrim,
    assist: parts.assist,
    bodies: (
      JSON.parse(parts.bodies) as Array<{
        id: string
        mass: number
        radius: number
      }>
    ).map((body) => ({
      id: body.id,
      mass: body.mass,
      radius: body.radius,
    })),
    config: parts.config,
    controls: parts.controls,
    generation,
    target: parts.target,
  })

const getInputKeyShort = (inputKey: string | null) => {
  if (!inputKey) {
    return null
  }

  let hash = 0
  for (let index = 0; index < inputKey.length; index += 1) {
    hash = (hash * 31 + inputKey.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

const getChangedPredictionInputParts = (
  previousParts: PredictionInputKeyParts | null,
  nextParts: PredictionInputKeyParts,
): TrajectoryPredictionInputChangePart[] => {
  if (!previousParts) {
    return [
      'target',
      'horizon',
      'sampling',
      'assist',
      'spacecraft',
      'controls',
      'bodies',
    ]
  }

  const changedParts: TrajectoryPredictionInputChangePart[] = []

  if (previousParts.target !== nextParts.target) {
    changedParts.push('target')
  }

  if (previousParts.config !== nextParts.config) {
    const previousConfig = JSON.parse(previousParts.config) as {
      horizonSeconds: number
    }
    const nextConfig = JSON.parse(nextParts.config) as typeof previousConfig
    changedParts.push(
      previousConfig.horizonSeconds !== nextConfig.horizonSeconds
        ? 'horizon'
        : 'sampling',
    )
  }

  if (previousParts.assist !== nextParts.assist) {
    changedParts.push('assist')
  }
  if (previousParts.spacecraft !== nextParts.spacecraft) {
    changedParts.push('spacecraft')
  }
  if (previousParts.controls !== nextParts.controls) {
    changedParts.push('controls')
  }
  if (previousParts.bodies !== nextParts.bodies) {
    changedParts.push('bodies')
  }

  return changedParts
}

const cloneDiagnosticEvent = (
  event: TrajectoryPredictionDiagnosticEvent,
): TrajectoryPredictionDiagnosticEvent => ({
  ...event,
  changedParts: [...event.changedParts],
})

const createPredictionConfigWithHorizon = (
  predictionConfig: TrajectoryPredictionConfig,
  horizonSeconds: number,
): TrajectoryPredictionConfig => ({
  ...predictionConfig,
  horizonSeconds,
})

const shouldSplitPredictionHorizon = (
  predictionConfig: TrajectoryPredictionConfig,
) => predictionConfig.horizonSeconds > baseNearPredictionHorizonSeconds

const mergePredictionPoints = (nearPoints: Vec2[], farPoints: Vec2[]) => [
  ...nearPoints,
  ...farPoints.slice(nearPoints.length),
]

const getRefreshReason = (
  previousParts: PredictionInputKeyParts | null,
  nextParts: PredictionInputKeyParts,
  elapsed: number,
  refreshInterval: number,
  suppressTimedRefresh = false,
): TrajectoryPredictionRefreshReason | null => {
  if (!previousParts) {
    return 'initial'
  }

  if (previousParts.target !== nextParts.target) {
    return 'target-change'
  }

  if (previousParts.config !== nextParts.config) {
    const previousConfig = JSON.parse(previousParts.config) as {
      horizonSeconds: number
      maxIntegrationStepSeconds: number
      maxLoopRevolutions: number
      refreshInterval: number
      stepSeconds: number
    }
    const nextConfig = JSON.parse(nextParts.config) as typeof previousConfig
    if (previousConfig.horizonSeconds !== nextConfig.horizonSeconds) {
      return 'horizon-change'
    }
    return 'sampling-change'
  }

  if (previousParts.assist !== nextParts.assist) {
    return 'assist-change'
  }

  if (previousParts.spacecraft !== nextParts.spacecraft) {
    return 'spacecraft-change'
  }

  if (previousParts.controls !== nextParts.controls) {
    return 'controls-change'
  }

  if (previousParts.bodies !== nextParts.bodies) {
    return 'body-state-change'
  }

  return !suppressTimedRefresh && elapsed >= refreshInterval
    ? 'timed-refresh'
    : null
}

export const createTrajectoryPredictionRuntime = (
  runtimeOptions: CreateTrajectoryPredictionRuntimeOptions = {},
) => {
  const predictionImplementation =
    runtimeOptions.predictionImplementation ?? 'euler'
  let acceptedCoastPredictionWindow: AcceptedCoastPredictionWindow | null = null
  let activeFarPredictionRequest: TrajectoryPredictionFarRequest | null = null
  let farPredictionTier: TrajectoryPredictionTier | null = null
  let farWorkerClient: TrajectoryPredictionFarWorkerClient | null = null
  let lastRefreshOptions: RefreshTrajectoryPredictionOptions | null = null
  let nearPredictionTier: TrajectoryPredictionTier | null = null
  let nextFarPredictionJobId = 1
  let pendingFarPredictionRequest: TrajectoryPredictionFarRequest | null = null
  let farSemanticGeneration = 0
  let farCoalescingMinIntervalOverrideSeconds: number | null = null
  let farCoalescingSkippedCount = 0
  let farCoalescingLastSkipReason: TrajectoryPredictionFarCoalescingSkipReason | null =
    null
  let farCoalescingLastSkipStage: TrajectoryPredictionFarCoalescingSkipStage | null =
    null
  let predictionInputHadActiveThrust = false
  let predictionInputHadActiveTurn = false
  let predictionInputAllowLoopTrim: boolean | null = null
  let predictionInputKeyParts: PredictionInputKeyParts | null = null
  let predictionDiagnosticEvents: TrajectoryPredictionDiagnosticEvent[] = []
  let farReuseHistory: TrajectoryPredictionFarReuseDiagnostic[] = []
  let previousDiagnosticEventTimeMs: number | null = null
  const farCalculationStats: CalculationTimingStats = {
    count: 0,
    lastAtMs: null,
    samples: [],
    totalMs: 0,
  }
  const nearCalculationStats: CalculationTimingStats = {
    count: 0,
    lastAtMs: null,
    samples: [],
    totalMs: 0,
  }
  let nearPredictionDistanceMeters: number | null = null
  let currentNearPredictionHorizonSeconds = baseNearPredictionHorizonSeconds
  let lastNearCalculationGapMeters: number | null = null
  let lastNearCalculationGapRatio: number | null = null
  let lastSpacecraftStepMeters: number | null = null
  let nearTravelSinceCalculationMeters = 0
  let previousSpacecraftPosition: Vec2 | null = null
  let predictionRefreshTimesMs: number[] = []
  let predictionRefreshElapsed = 0
  let predictionDiagnostics = emptyTrajectoryPredictionDiagnostics()
  let predictionState = emptyTrajectoryPredictionState()
  const createFarWorkerClient =
    runtimeOptions.createFarWorkerClient ??
    createTrajectoryPredictionFarWorkerClient

  const isClosedPassiveKeplerOrbit = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
  ) =>
    predictionImplementation === 'kepler' &&
    isPassiveCoast(options) &&
    canUseKeplerTwoBodyPrediction(options.state, target) &&
    getClosedKeplerTwoBodyOrbitPeriod(target, options.state.spacecraft) !== null

  const shouldSplitPrediction = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
  ) =>
    shouldSplitPredictionHorizon(options.predictionConfig) &&
    !isClosedPassiveKeplerOrbit(options, target)

  const getFarCoalescingMinIntervalSeconds = (
    options: RefreshTrajectoryPredictionOptions,
  ) =>
    farCoalescingMinIntervalOverrideSeconds ??
    getDefaultFarCoalescingMinIntervalSeconds(
      options.predictionConfig.horizonSeconds,
      options.timeWarp,
    )

  const getActiveThrustCoalescingMinIntervalSeconds = (
    options: RefreshTrajectoryPredictionOptions,
  ) =>
    farCoalescingMinIntervalOverrideSeconds ??
    getActiveThrustFarCoalescingMinIntervalSeconds(options.timeWarp)

  const getCurrentFarCoalescingMinIntervalSeconds = (
    options: RefreshTrajectoryPredictionOptions,
  ) =>
    isActiveThrustControl(options.state.controls)
      ? getActiveThrustCoalescingMinIntervalSeconds(options)
      : getFarCoalescingMinIntervalSeconds(options)

  const getFarRequestCoalescingMinIntervalSeconds = (
    options: RefreshTrajectoryPredictionOptions,
    reason: TrajectoryPredictionRefreshReason,
    activeThrustEnded: boolean,
    activeTurnEnded: boolean,
  ): number | null | false => {
    if (
      activeThrustEnded ||
      activeTurnEnded ||
      forcesFarPredictionRefresh(reason)
    ) {
      return null
    }
    if (isActiveThrustControl(options.state.controls)) {
      return getActiveThrustCoalescingMinIntervalSeconds(options)
    }
    const isCoastingDriftRefresh =
      reason === 'spacecraft-change' || reason === 'body-state-change'
    if (isCoastingDriftRefresh && activeFarPredictionRequest) {
      return false
    }
    if (reason === 'timed-refresh' || isCoastingDriftRefresh) {
      return getFarCoalescingMinIntervalSeconds(options)
    }
    return false
  }

  const updateFarCoalescingDiagnostics = (
    options: RefreshTrajectoryPredictionOptions | null = lastRefreshOptions,
  ) => {
    predictionDiagnostics = {
      ...predictionDiagnostics,
      farCoalescingLastSkipReason,
      farCoalescingLastSkipStage,
      farCoalescingMinIntervalOverrideSeconds,
      farCoalescingMinIntervalSeconds: options
        ? getCurrentFarCoalescingMinIntervalSeconds(options)
        : (farCoalescingMinIntervalOverrideSeconds ?? 0),
      farCoalescingSkippedCount,
    }
  }

  const recordFarCoalescingSkip = (
    stage: TrajectoryPredictionFarCoalescingSkipStage,
  ) => {
    farCoalescingSkippedCount += 1
    farCoalescingLastSkipReason = 'cooldown'
    farCoalescingLastSkipStage = stage
    updateFarCoalescingDiagnostics()
  }

  const isFarCoalescingCooldownActive = (
    minIntervalSeconds: number,
    currentTimeMs: number,
    target: Body,
  ) => {
    if (
      minIntervalSeconds <= 0 ||
      farCalculationStats.lastAtMs === null ||
      farPredictionTier?.targetId !== target.id
    ) {
      return false
    }

    return (
      currentTimeMs - farCalculationStats.lastAtMs < minIntervalSeconds * 1000
    )
  }

  const setCurrentSpacecraftPosition = (position: Vec2) => {
    if (previousSpacecraftPosition) {
      lastSpacecraftStepMeters = length(
        sub(position, previousSpacecraftPosition),
      )
      nearTravelSinceCalculationMeters += lastSpacecraftStepMeters
    } else {
      lastSpacecraftStepMeters = 0
    }
    previousSpacecraftPosition = { ...position }
  }

  const getNearTravelDiagnostics =
    (): TrajectoryPredictionNearTravelDiagnostics => ({
      distanceSinceCalculationMeters:
        nearPredictionDistanceMeters === null
          ? null
          : nearTravelSinceCalculationMeters,
      horizonDistanceMeters: nearPredictionDistanceMeters,
      horizonRatio:
        nearPredictionDistanceMeters && nearPredictionDistanceMeters > 0
          ? nearTravelSinceCalculationMeters / nearPredictionDistanceMeters
          : null,
      lastCalculationGapMeters: lastNearCalculationGapMeters,
      lastCalculationGapRatio: lastNearCalculationGapRatio,
      lastStepDistanceMeters:
        nearPredictionDistanceMeters === null ? null : lastSpacecraftStepMeters,
      lastStepHorizonRatio:
        nearPredictionDistanceMeters &&
        nearPredictionDistanceMeters > 0 &&
        lastSpacecraftStepMeters !== null
          ? lastSpacecraftStepMeters / nearPredictionDistanceMeters
          : null,
    })

  const getNearPredictionHorizonSeconds = (
    predictionConfig: TrajectoryPredictionConfig,
  ) => {
    if (
      lastSpacecraftStepMeters === null ||
      lastSpacecraftStepMeters <= 0 ||
      nearPredictionDistanceMeters === null ||
      nearPredictionDistanceMeters <= 0
    ) {
      return baseNearPredictionHorizonSeconds
    }

    return Math.min(
      predictionConfig.horizonSeconds,
      Math.max(
        baseNearPredictionHorizonSeconds,
        currentNearPredictionHorizonSeconds *
          (lastSpacecraftStepMeters /
            (nearPredictionDistanceMeters * nearPredictionMovementBudgetRatio)),
      ),
    )
  }

  const getRefreshCountLastSecond = (currentTimeMs: number) => {
    const recentCutoffMs = currentTimeMs - recentRefreshWindowMs
    predictionRefreshTimesMs = predictionRefreshTimesMs.filter(
      (timeMs) => timeMs >= recentCutoffMs,
    )
    return predictionRefreshTimesMs.length
  }

  const predictTier = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    predictionConfig: TrajectoryPredictionConfig,
    inputKey: string,
  ): TrajectoryPredictionTier => {
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const coastComputation =
      predictionImplementation === 'kepler' &&
      isPassiveCoast(options) &&
      canUseKeplerTwoBodyPrediction(options.state, target)
        ? computeKeplerTwoBodyTrajectoryPrediction(
            options.state,
            target,
            predictionConfig,
            allowLoopTrim,
            options.physicsEngine,
          )
        : computeCoastTrajectoryPrediction(
            options.state,
            options.physicsEngine,
            target,
            predictionConfig,
            allowLoopTrim,
          )

    return {
      assistedPoints:
        options.assistMode === 'off'
          ? []
          : predictAssistedTrajectory(
              options.state,
              options.physicsEngine,
              target.id,
              predictionConfig,
              options.getAssistPredictionControls,
            ).relativePoints,
      coastPrediction: coastComputation.result,
      coverageSeconds:
        coastComputation.terminationReason === 'closed-orbit'
          ? Math.max(
              predictionConfig.horizonSeconds,
              coastComputation.predictionTime,
            )
          : coastComputation.predictionTime,
      inputKey,
      targetId: target.id,
      terminationReason: coastComputation.terminationReason,
    }
  }

  const predictTierWithTiming = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    predictionConfig: TrajectoryPredictionConfig,
    inputKey: string,
  ) => {
    const calculationStartMs = nowMs()
    const tier = predictTier(options, target, predictionConfig, inputKey)
    return {
      calculationMs: nowMs() - calculationStartMs,
      tier,
    }
  }

  const getAcceptedWindowTiers = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    inputKeyParts: PredictionInputKeyParts,
    nearHorizonSeconds: number,
  ):
    | AcceptedCoastPredictionWindowTiers
    | { fallbackReason: TrajectoryPredictionNearFallbackReason } => {
    if (!isPassiveCoast(options)) {
      return { fallbackReason: 'not-passive-coast' }
    }
    const acceptedWindow = acceptedCoastPredictionWindow
    if (!acceptedWindow) {
      return { fallbackReason: 'no-accepted-window' }
    }

    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const semanticInputKey = createFarPredictionSemanticInputKey(
      inputKeyParts,
      farSemanticGeneration,
      allowLoopTrim,
    )
    if (
      acceptedWindow.semanticInputKey !== semanticInputKey ||
      acceptedWindow.targetId !== target.id ||
      acceptedWindow.coastWindow.allowLoopTrim !== allowLoopTrim
    ) {
      return { fallbackReason: 'semantic-change' }
    }

    const slice = sliceFarTrajectoryPredictionCoastWindow(
      acceptedWindow.coastWindow,
      acceptedWindow.coastPrediction,
      {
        absoluteStartPoint: options.state.spacecraft.position,
        currentElapsed: options.state.elapsed,
        nearHorizonSeconds,
        targetRadius: target.radius,
      },
    )
    if ('fallbackReason' in slice) {
      return slice
    }

    const inputKey = createPredictionInputKey(inputKeyParts)
    return {
      farTier: {
        assistedPoints: [],
        coastPrediction: slice.farPrediction,
        coverageSeconds: slice.remainingCoverageSeconds,
        inputKey,
        targetId: target.id,
        terminationReason: acceptedWindow.coastWindow.terminationReason,
      },
      nearTier: {
        assistedPoints: [],
        coastPrediction: slice.nearPrediction,
        coverageSeconds: Math.min(
          slice.remainingCoverageSeconds,
          nearHorizonSeconds,
        ),
        inputKey,
        targetId: target.id,
        terminationReason: acceptedWindow.coastWindow.terminationReason,
      },
      predictionAnchorElapsed: acceptedWindow.coastWindow.anchorElapsed,
      predictionTerminationReason: acceptedWindow.coastWindow.terminationReason,
      remainingUsableCoverageSeconds: slice.remainingCoverageSeconds,
      retainedFarPointCount: slice.retainedFarPointCount,
      retainedNearPointCount: slice.retainedNearPointCount,
    }
  }

  const pushDiagnosticEvent = (
    event: Omit<TrajectoryPredictionDiagnosticEvent, 'dtMs' | 't'> & {
      t?: number
    },
  ) => {
    const t = event.t ?? nowMs()
    predictionDiagnosticEvents.push({
      ...event,
      dtMs:
        previousDiagnosticEventTimeMs === null
          ? null
          : t - previousDiagnosticEventTimeMs,
      t,
    })
    previousDiagnosticEventTimeMs = t
    if (predictionDiagnosticEvents.length > diagnosticEventLimit) {
      predictionDiagnosticEvents = predictionDiagnosticEvents.slice(
        -diagnosticEventLimit,
      )
    }
  }

  const createFarPredictionRequest = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    inputKeyParts: PredictionInputKeyParts,
    coalescingMinIntervalSeconds: number | null,
  ): TrajectoryPredictionFarRequest => {
    const inputKey = createPredictionInputKey(inputKeyParts)
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const semanticInputKey = createFarPredictionSemanticInputKey(
      inputKeyParts,
      farSemanticGeneration,
      allowLoopTrim,
    )
    const jobId = nextFarPredictionJobId
    nextFarPredictionJobId += 1

    return {
      coalescingMinIntervalSeconds,
      inputKey,
      jobId,
      payload: {
        assistMode: options.assistMode,
        autopilotRotationRate: options.autopilotRotationRate,
        inputKey,
        jobId,
        predictionConfig: { ...options.predictionConfig },
        predictionImplementation,
        semanticInputKey,
        state: createFarTrajectoryPredictionStateSnapshot(options.state),
        targetId: target.id,
      },
      semanticInputKey,
    }
  }

  const clearFarPredictionRequests = () => {
    activeFarPredictionRequest = null
    pendingFarPredictionRequest = null
    farWorkerClient?.terminate()
    farWorkerClient = null
  }

  const resetFarWorkerClient = () => {
    farWorkerClient?.terminate()
    farWorkerClient = null
  }

  const syncFarRequestDiagnostics = () => {
    predictionDiagnostics = {
      ...predictionDiagnostics,
      activeFar: activeFarPredictionRequest !== null,
      activeFarInputKeyShort: getInputKeyShort(
        activeFarPredictionRequest?.inputKey ?? null,
      ),
      pendingFar: pendingFarPredictionRequest !== null,
      pendingFarInputKeyShort: getInputKeyShort(
        pendingFarPredictionRequest?.inputKey ?? null,
      ),
    }
  }

  const createFarTierFromWorkerResult = (
    result: FarTrajectoryPredictionResultPayload,
  ): TrajectoryPredictionTier => ({
    assistedPoints: result.assistedPoints,
    coastPrediction: result.coastPrediction,
    coverageSeconds: result.coastWindow.totalCoverageSeconds,
    inputKey: result.inputKey,
    targetId: result.targetId,
    terminationReason: result.coastWindow.terminationReason,
  })

  const postActiveFarPredictionRequest = () => {
    const request = activeFarPredictionRequest
    if (!request) {
      return
    }

    try {
      farWorkerClient ??= createFarWorkerClient({
        handleError: handleFarWorkerError,
        handleResult: handleFarWorkerResult,
      })
      farWorkerClient.postRequest(request.payload)
    } catch (error) {
      handleFarWorkerError({
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const startPendingFarPredictionRequest = () => {
    activeFarPredictionRequest = pendingFarPredictionRequest
    pendingFarPredictionRequest = null
    syncFarRequestDiagnostics()
    postActiveFarPredictionRequest()
  }

  const queueFarPredictionRequest = (
    request: TrajectoryPredictionFarRequest,
  ) => {
    if (activeFarPredictionRequest?.inputKey === request.inputKey) {
      return false
    }

    if (!activeFarPredictionRequest) {
      activeFarPredictionRequest = request
      postActiveFarPredictionRequest()
      return false
    }

    if (pendingFarPredictionRequest?.inputKey === request.inputKey) {
      return false
    }

    const replacedPendingFar =
      pendingFarPredictionRequest !== null &&
      pendingFarPredictionRequest.inputKey !== request.inputKey
    pendingFarPredictionRequest = request
    return replacedPendingFar
  }

  function handleFarWorkerError(error: TrajectoryPredictionFarWorkerError) {
    if (
      error.jobId !== null &&
      activeFarPredictionRequest?.jobId !== error.jobId
    ) {
      return
    }

    resetFarWorkerClient()
    startPendingFarPredictionRequest()
  }

  function handleFarWorkerResult(result: FarTrajectoryPredictionResultPayload) {
    const request = activeFarPredictionRequest
    if (!request || request.jobId !== result.jobId) {
      return
    }

    activeFarPredictionRequest = pendingFarPredictionRequest
    pendingFarPredictionRequest = null
    syncFarRequestDiagnostics()

    const options = lastRefreshOptions
    if (!options) {
      postActiveFarPredictionRequest()
      return
    }

    const target = options.getAssistTarget()
    const nextInputKeyParts = createPredictionInputKeyParts(options, target)
    const inputKey = createPredictionInputKey(nextInputKeyParts)
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const semanticInputKey = createFarPredictionSemanticInputKey(
      nextInputKeyParts,
      farSemanticGeneration,
      allowLoopTrim,
    )

    if (
      result.semanticInputKey !== semanticInputKey ||
      request.semanticInputKey !== semanticInputKey ||
      result.targetId !== target.id ||
      result.coastWindow.allowLoopTrim !== allowLoopTrim ||
      result.coastWindow.anchorElapsed !== request.payload.state.elapsed
    ) {
      postActiveFarPredictionRequest()
      return
    }

    const refreshStartMs = nowMs()
    if (
      request.coalescingMinIntervalSeconds !== null &&
      isFarCoalescingCooldownActive(
        request.coalescingMinIntervalSeconds,
        refreshStartMs,
        target,
      )
    ) {
      recordFarCoalescingSkip('result')
      postActiveFarPredictionRequest()
      return
    }

    predictionRefreshTimesMs.push(refreshStartMs)
    acceptedCoastPredictionWindow = {
      coastPrediction: result.coastPrediction,
      coastWindow: result.coastWindow,
      semanticInputKey: result.semanticInputKey,
      targetId: result.targetId,
    }
    farReuseHistory = [
      ...farReuseHistory,
      {
        ...result.reuse,
        elapsedSeconds: options.state.elapsed,
        horizonSeconds: options.predictionConfig.horizonSeconds,
      },
    ].slice(-farReuseHistoryLimit)
    predictionDiagnostics = {
      ...predictionDiagnostics,
      farReuseDivergence: result.reuse.divergence,
      farReuseExtendedPointCount: result.reuse.extendedPointCount,
      farReuseExtendedSeconds: result.reuse.extendedSeconds,
      farReuseFallbackReason: result.reuse.fallbackReason,
      farReuseHistory,
      farReuseMode: result.reuse.mode,
      farReuseRetainedPointCount: result.reuse.retainedPointCount,
      farReuseRetainedSeconds: result.reuse.retainedSeconds,
      farReuseTrimmedPointCount: result.reuse.trimmedPointCount,
      farReuseTrimmedSeconds: result.reuse.trimmedSeconds,
      farReuseValidation: result.reuse.validation,
      farReuseValidationSeconds: result.reuse.validationSeconds,
    }
    const liveNearPredictionConfig = createPredictionConfigWithHorizon(
      options.predictionConfig,
      getNearPredictionHorizonSeconds(options.predictionConfig),
    )
    const acceptedWindowTiers = getAcceptedWindowTiers(
      options,
      target,
      nextInputKeyParts,
      liveNearPredictionConfig.horizonSeconds,
    )
    let nearCalculationMs: number | null = null
    let nearFallbackReason: TrajectoryPredictionNearFallbackReason | null = null
    let nearSource: TrajectoryPredictionNearSource = 'accepted-window'
    let nearWindow: AcceptedCoastPredictionWindowTiers | null = null
    let currentFarTier: TrajectoryPredictionTier | null
    let currentNearTier: TrajectoryPredictionTier
    if (
      'fallbackReason' in acceptedWindowTiers ||
      result.reuse.fallbackReason === 'state-diverged'
    ) {
      const existingNearTier = nearPredictionTier
      const mustCalculateNear =
        result.reuse.fallbackReason === 'state-diverged' ||
        existingNearTier?.inputKey !== inputKey ||
        existingNearTier.targetId !== target.id
      if (mustCalculateNear) {
        const nearPrediction = predictTierWithTiming(
          options,
          target,
          liveNearPredictionConfig,
          inputKey,
        )
        currentNearTier = nearPrediction.tier
        nearCalculationMs = nearPrediction.calculationMs
      } else {
        currentNearTier = existingNearTier
      }
      if ('fallbackReason' in acceptedWindowTiers) {
        acceptedCoastPredictionWindow = null
      }
      if (result.reuse.fallbackReason === 'state-diverged') {
        nearFallbackReason = 'state-diverged'
      } else if ('fallbackReason' in acceptedWindowTiers) {
        nearFallbackReason = acceptedWindowTiers.fallbackReason
      }
      nearSource = 'synchronous'
      if (!('fallbackReason' in acceptedWindowTiers)) {
        currentFarTier = acceptedWindowTiers.farTier
      } else if (acceptedWindowTiers.fallbackReason === 'not-passive-coast') {
        currentFarTier = createFarTierFromWorkerResult(result)
      } else {
        currentFarTier = null
      }
    } else {
      currentFarTier = acceptedWindowTiers.farTier
      currentNearTier = acceptedWindowTiers.nearTier
      nearWindow = acceptedWindowTiers
    }
    farPredictionTier = currentFarTier
    nearPredictionTier = currentNearTier
    applyPredictionTier({
      changedParts: [],
      event: 'far-complete',
      farApplied: true,
      farCalculationMs: result.calculationMs,
      farTier: farPredictionTier,
      farCoalescingMinIntervalSeconds:
        getCurrentFarCoalescingMinIntervalSeconds(options),
      inputKey,
      integrationStepSeconds: getIntegrationStepSeconds(
        options,
        target,
        options.predictionConfig,
      ),
      nearCalculationMs,
      nearFallbackReason,
      nearHorizonSeconds: liveNearPredictionConfig.horizonSeconds,
      nearTier: currentNearTier,
      nearSource,
      nearWindow,
      predictionConfig: options.predictionConfig,
      reason: 'timed-refresh',
      refreshStartMs,
      splitHorizon: shouldSplitPrediction(options, target),
      target,
      timeWarp: options.timeWarp,
    })
    postActiveFarPredictionRequest()
  }

  const getIntegrationStepSeconds = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    predictionConfig: TrajectoryPredictionConfig,
  ) => {
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    return getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
      options.state,
      target,
      predictionConfig,
      allowLoopTrim,
    )
  }

  const applyPredictionTier = (options: {
    changedParts: TrajectoryPredictionInputChangePart[]
    event: TrajectoryPredictionEventKind | null
    farApplied: boolean
    farCalculationMs: number | null
    farCoalescingMinIntervalSeconds: number
    farTier: TrajectoryPredictionTier | null
    inputKey: string
    integrationStepSeconds: number
    nearCalculationMs: number | null
    nearFallbackReason: TrajectoryPredictionNearFallbackReason | null
    nearHorizonSeconds: number
    nearTier: TrajectoryPredictionTier
    nearSource: TrajectoryPredictionNearSource
    nearWindow: AcceptedCoastPredictionWindowTiers | null
    predictionConfig: TrajectoryPredictionConfig
    reason: TrajectoryPredictionRefreshReason
    refreshStartMs: number
    splitHorizon: boolean
    target: Body
    timeWarp: number
  }) => {
    const visibleFarTier =
      !options.nearTier.coastPrediction.impact &&
      options.farTier?.targetId === options.target.id
        ? options.farTier
        : null
    const visibleCoastPrediction =
      visibleFarTier?.coastPrediction ?? options.nearTier.coastPrediction
    const targetRelativePredictionPoints = visibleFarTier
      ? mergePredictionPoints(
          options.nearTier.coastPrediction.relativePoints,
          visibleFarTier.coastPrediction.relativePoints,
        )
      : options.nearTier.coastPrediction.relativePoints
    const absolutePredictionPoints = visibleFarTier
      ? mergePredictionPoints(
          options.nearTier.coastPrediction.absolutePoints,
          visibleFarTier.coastPrediction.absolutePoints,
        )
      : options.nearTier.coastPrediction.absolutePoints
    const targetRelativeAssistedPoints = visibleFarTier
      ? mergePredictionPoints(
          options.nearTier.assistedPoints,
          visibleFarTier.assistedPoints,
        )
      : options.nearTier.assistedPoints
    const farVisible: TrajectoryPredictionFarVisibility = !visibleFarTier
      ? 'none'
      : visibleFarTier.inputKey === options.inputKey
        ? 'current'
        : 'retained-stale'
    const farPointCount =
      options.farTier?.coastPrediction.relativePoints.length ?? 0
    const inputKeyShort = getInputKeyShort(options.inputKey)
    const activeFarInputKeyShort = getInputKeyShort(
      activeFarPredictionRequest?.inputKey ?? null,
    )
    const pendingFarInputKeyShort = getInputKeyShort(
      pendingFarPredictionRequest?.inputKey ?? null,
    )
    const farInputKeyShort = getInputKeyShort(options.farTier?.inputKey ?? null)
    const calculationRecordedAtMs = nowMs()
    recordCalculationTiming(
      nearCalculationStats,
      options.nearCalculationMs,
      calculationRecordedAtMs,
    )
    recordCalculationTiming(
      farCalculationStats,
      options.farCalculationMs,
      calculationRecordedAtMs,
    )
    if (options.nearCalculationMs !== null) {
      currentNearPredictionHorizonSeconds = options.nearHorizonSeconds
      lastNearCalculationGapMeters =
        nearPredictionDistanceMeters === null
          ? null
          : nearTravelSinceCalculationMeters
      lastNearCalculationGapRatio =
        nearPredictionDistanceMeters && nearPredictionDistanceMeters > 0
          ? nearTravelSinceCalculationMeters / nearPredictionDistanceMeters
          : null
      nearPredictionDistanceMeters = getPathDistanceMeters(
        options.nearTier.coastPrediction.absolutePoints,
      )
      nearTravelSinceCalculationMeters = 0
      previousSpacecraftPosition =
        options.nearTier.coastPrediction.absolutePoints[0] ?? null
    }
    predictionState = {
      absolutePredictionEnd: visibleCoastPrediction.absoluteEndPoint,
      absolutePredictionPoints,
      predictedImpact: visibleCoastPrediction.impact,
      predictedTargetClosestApproach: visibleCoastPrediction.closestApproach,
      targetId: options.target.id,
      targetRelativeEventMarkers: visibleCoastPrediction.eventMarkers,
      targetRelativeAssistedPoints,
      targetRelativePredictionEnd:
        targetRelativePredictionPoints.at(-1) ?? null,
      targetRelativePredictionPoints,
    }
    predictionDiagnostics = {
      ...predictionDiagnostics,
      absolutePointCount: predictionState.absolutePredictionPoints.length,
      activeFar: activeFarPredictionRequest !== null,
      activeFarInputKeyShort,
      assistedPointCount: predictionState.targetRelativeAssistedPoints.length,
      eventMarkerCount: predictionState.targetRelativeEventMarkers.length,
      elapsedSinceRefreshSeconds: predictionRefreshElapsed,
      events: predictionDiagnosticEvents,
      farCalculationAgeSeconds: getCalculationAgeSeconds(
        farCalculationStats,
        calculationRecordedAtMs,
      ),
      farCalculationAverageMs: getAverageCalculationMs(farCalculationStats),
      farCalculationMs:
        options.farCalculationMs ?? predictionDiagnostics.farCalculationMs,
      farCalculationSampleCount: farCalculationStats.count,
      farCalculationWindows: getCalculationWindowDiagnostics(
        farCalculationStats,
        calculationRecordedAtMs,
      ),
      farCoalescingLastSkipReason,
      farCoalescingLastSkipStage,
      farCoalescingMinIntervalOverrideSeconds,
      farCoalescingMinIntervalSeconds: options.farCoalescingMinIntervalSeconds,
      farCoalescingSkippedCount,
      farInputKeyShort,
      farPointCount,
      farVisible,
      horizonSeconds: options.predictionConfig.horizonSeconds,
      hasFarTier: options.farTier !== null,
      inputKey: options.inputKey,
      inputKeyShort,
      integrationStepSeconds: options.integrationStepSeconds,
      integrationTiers: {
        far: options.farTier?.coastPrediction.integration ?? null,
        near: options.nearTier.coastPrediction.integration,
      },
      nearCalculationAgeSeconds: getCalculationAgeSeconds(
        nearCalculationStats,
        calculationRecordedAtMs,
      ),
      nearCalculationAverageMs: getAverageCalculationMs(nearCalculationStats),
      nearCalculationMs:
        options.nearCalculationMs ?? predictionDiagnostics.nearCalculationMs,
      nearCalculationSampleCount: nearCalculationStats.count,
      nearCalculationTravel: getNearTravelDiagnostics(),
      nearCalculationWindows: getCalculationWindowDiagnostics(
        nearCalculationStats,
        calculationRecordedAtMs,
      ),
      nearFallbackReason: options.nearFallbackReason,
      nearPointCount: options.nearTier.coastPrediction.relativePoints.length,
      nearSource: options.nearSource,
      pendingFar: pendingFarPredictionRequest !== null,
      pendingFarInputKeyShort,
      predictionAnchorElapsed:
        options.nearWindow?.predictionAnchorElapsed ?? null,
      predictionRefreshMs:
        options.event === null
          ? predictionDiagnostics.predictionRefreshMs
          : nowMs() - options.refreshStartMs,
      predictionTerminationReason:
        options.nearWindow?.predictionTerminationReason ??
        options.nearTier.terminationReason,
      refreshCountLastSecond: getRefreshCountLastSecond(options.refreshStartMs),
      refreshIntervalSeconds: options.predictionConfig.refreshInterval,
      refreshReason:
        options.event === null
          ? predictionDiagnostics.refreshReason
          : options.reason,
      relativePointCount: predictionState.targetRelativePredictionPoints.length,
      remainingUsableCoverageSeconds:
        options.nearWindow?.remainingUsableCoverageSeconds ??
        options.nearTier.coverageSeconds,
      retainedFarPointCount: options.nearWindow?.retainedFarPointCount ?? 0,
      retainedNearPointCount: options.nearWindow?.retainedNearPointCount ?? 0,
      sampleStepSeconds: options.predictionConfig.stepSeconds,
      splitHorizon: options.splitHorizon,
      visiblePointCount: predictionState.targetRelativePredictionPoints.length,
    }
    if (options.event !== null) {
      pushDiagnosticEvent({
        activeFar: activeFarPredictionRequest !== null,
        activeFarInputKeyShort,
        changedParts: options.changedParts,
        elapsedSinceRefreshSeconds: predictionRefreshElapsed,
        event: options.event,
        farApplied: options.farApplied,
        farCalculationMs: options.farCalculationMs,
        farInputKeyShort,
        farPointCount,
        farVisible,
        horizonSeconds: options.predictionConfig.horizonSeconds,
        inputKeyShort: inputKeyShort ?? '',
        nearCalculationMs: options.nearCalculationMs,
        nearPointCount: options.nearTier.coastPrediction.relativePoints.length,
        pendingFar: pendingFarPredictionRequest !== null,
        pendingFarInputKeyShort,
        reason: options.reason,
        refreshIntervalSeconds: options.predictionConfig.refreshInterval,
        splitHorizon: options.splitHorizon,
        visiblePointCount:
          predictionState.targetRelativePredictionPoints.length,
      })
    }
    predictionDiagnostics = {
      ...predictionDiagnostics,
      events: predictionDiagnosticEvents,
    }
  }

  const refreshForTarget = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    reason: TrajectoryPredictionRefreshReason,
    nextInputKeyParts = createPredictionInputKeyParts(options, target),
  ) => {
    const refreshStartMs = nowMs()
    predictionRefreshTimesMs.push(refreshStartMs)
    const predictionConfig = options.predictionConfig
    const inputKey = createPredictionInputKey(nextInputKeyParts)
    const integrationStepSeconds = getIntegrationStepSeconds(
      options,
      target,
      predictionConfig,
    )
    const splitPredictionHorizon = shouldSplitPrediction(options, target)
    const nearPredictionConfig = splitPredictionHorizon
      ? createPredictionConfigWithHorizon(
          predictionConfig,
          getNearPredictionHorizonSeconds(predictionConfig),
        )
      : predictionConfig
    const previousInputKeyParts = predictionInputKeyParts
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const activeThrustEnded =
      previousInputKeyParts !== null &&
      predictionInputHadActiveThrust &&
      !isActiveThrustControl(options.state.controls)
    const activeTurnEnded =
      previousInputKeyParts !== null &&
      predictionInputHadActiveTurn &&
      options.state.controls.turn === 0
    const semanticInputChanged =
      previousInputKeyParts !== null &&
      createFarPredictionSemanticInputKey(
        previousInputKeyParts,
        0,
        predictionInputAllowLoopTrim ?? allowLoopTrim,
      ) !==
        createFarPredictionSemanticInputKey(nextInputKeyParts, 0, allowLoopTrim)
    const hardSemanticInvalidation =
      previousInputKeyParts !== null &&
      (semanticInputChanged || !canReuseAcceptedWindowForReason(reason))
    if (hardSemanticInvalidation) {
      farSemanticGeneration += 1
      acceptedCoastPredictionWindow = null
    }
    const shouldUseAcceptedWindow =
      splitPredictionHorizon &&
      canReuseAcceptedWindowForReason(reason) &&
      !hardSemanticInvalidation
    if (!shouldUseAcceptedWindow && !canReuseAcceptedWindowForReason(reason)) {
      acceptedCoastPredictionWindow = null
    }

    const acceptedWindowTiers = shouldUseAcceptedWindow
      ? getAcceptedWindowTiers(
          options,
          target,
          nextInputKeyParts,
          nearPredictionConfig.horizonSeconds,
        )
      : null
    let nearCalculationMs: number | null = null
    let nearFallbackReason: TrajectoryPredictionNearFallbackReason | null = null
    let nearSource: TrajectoryPredictionNearSource = 'accepted-window'
    let nearWindow: AcceptedCoastPredictionWindowTiers | null = null
    let nearTier: TrajectoryPredictionTier
    if (acceptedWindowTiers && !('fallbackReason' in acceptedWindowTiers)) {
      nearTier = acceptedWindowTiers.nearTier
      farPredictionTier = acceptedWindowTiers.farTier
      nearWindow = acceptedWindowTiers
    } else {
      const nearPrediction = predictTierWithTiming(
        options,
        target,
        nearPredictionConfig,
        inputKey,
      )
      nearTier = nearPrediction.tier
      nearCalculationMs = nearPrediction.calculationMs
      nearSource = 'synchronous'
      if (acceptedWindowTiers && 'fallbackReason' in acceptedWindowTiers) {
        nearFallbackReason = acceptedWindowTiers.fallbackReason
        acceptedCoastPredictionWindow = null
        if (
          acceptedWindowTiers.fallbackReason === 'continuity-unavailable' ||
          acceptedWindowTiers.fallbackReason === 'coverage-exhausted' ||
          acceptedWindowTiers.fallbackReason ===
            'insufficient-future-samples' ||
          acceptedWindowTiers.fallbackReason === 'semantic-change'
        ) {
          farPredictionTier = null
        }
      } else if (!isPassiveCoast(options)) {
        nearFallbackReason = 'not-passive-coast'
      } else if (reason === 'initial') {
        nearFallbackReason = 'no-accepted-window'
      } else {
        nearFallbackReason = 'semantic-change'
      }
    }
    let replacedPendingFar = false
    const farRequestCoalescingMinIntervalSeconds =
      getFarRequestCoalescingMinIntervalSeconds(
        options,
        reason,
        activeThrustEnded,
        activeTurnEnded,
      )

    if (!splitPredictionHorizon) {
      farPredictionTier = null
      clearFarPredictionRequests()
    } else if (farRequestCoalescingMinIntervalSeconds !== false) {
      if (
        farRequestCoalescingMinIntervalSeconds !== null &&
        isFarCoalescingCooldownActive(
          farRequestCoalescingMinIntervalSeconds,
          refreshStartMs,
          target,
        )
      ) {
        recordFarCoalescingSkip('request')
      } else {
        replacedPendingFar = queueFarPredictionRequest(
          createFarPredictionRequest(
            options,
            target,
            nextInputKeyParts,
            farRequestCoalescingMinIntervalSeconds,
          ),
        )
      }
    }

    predictionInputKeyParts = nextInputKeyParts
    predictionInputHadActiveThrust = isActiveThrustControl(
      options.state.controls,
    )
    predictionInputHadActiveTurn = options.state.controls.turn !== 0
    predictionInputAllowLoopTrim = allowLoopTrim
    nearPredictionTier = nearTier
    applyPredictionTier({
      changedParts: getChangedPredictionInputParts(
        previousInputKeyParts,
        nextInputKeyParts,
      ),
      event: replacedPendingFar ? 'far-replaced' : 'refresh',
      farApplied: false,
      farCalculationMs: null,
      farCoalescingMinIntervalSeconds:
        getCurrentFarCoalescingMinIntervalSeconds(options),
      farTier: farPredictionTier,
      inputKey,
      integrationStepSeconds,
      nearCalculationMs,
      nearFallbackReason,
      nearHorizonSeconds: nearPredictionConfig.horizonSeconds,
      nearTier,
      nearSource,
      nearWindow,
      predictionConfig,
      reason,
      refreshStartMs,
      splitHorizon: splitPredictionHorizon,
      target,
      timeWarp: options.timeWarp,
    })
    updateFarCoalescingDiagnostics(options)
    predictionRefreshElapsed = 0
  }

  const refresh = (
    options: RefreshTrajectoryPredictionOptions,
    reason: TrajectoryPredictionRefreshReason = predictionInputKeyParts
      ? 'manual'
      : 'initial',
  ) => {
    lastRefreshOptions = options
    const target = options.getAssistTarget()
    setCurrentSpacecraftPosition(options.state.spacecraft.position)
    refreshForTarget(options, target, reason)
  }

  return {
    getDiagnostics: () => {
      const currentTimeMs = nowMs()
      updateFarCoalescingDiagnostics()
      return {
        ...predictionDiagnostics,
        elapsedSinceRefreshSeconds: predictionRefreshElapsed,
        events: predictionDiagnosticEvents.map(cloneDiagnosticEvent),
        farReuseHistory: farReuseHistory.map((entry) => ({ ...entry })),
        farCalculationAgeSeconds: getCalculationAgeSeconds(
          farCalculationStats,
          currentTimeMs,
        ),
        farCalculationWindows: getCalculationWindowDiagnostics(
          farCalculationStats,
          currentTimeMs,
        ),
        nearCalculationAgeSeconds: getCalculationAgeSeconds(
          nearCalculationStats,
          currentTimeMs,
        ),
        nearCalculationTravel: getNearTravelDiagnostics(),
        nearCalculationWindows: getCalculationWindowDiagnostics(
          nearCalculationStats,
          currentTimeMs,
        ),
        refreshCountLastSecond: getRefreshCountLastSecond(currentTimeMs),
      }
    },
    getRemainingUsableCoverageSeconds: () =>
      predictionDiagnostics.remainingUsableCoverageSeconds,
    getState: () => predictionState,
    hasCompletePredictionForCurrentTarget: () =>
      !predictionDiagnostics.splitHorizon ||
      farPredictionTier?.targetId === predictionState.targetId,
    maybeRefresh: (
      realDt: number,
      options: RefreshTrajectoryPredictionOptions,
    ) => {
      lastRefreshOptions = options
      predictionRefreshElapsed += realDt
      setCurrentSpacecraftPosition(options.state.spacecraft.position)
      const target = options.getAssistTarget()
      const nextInputKeyParts = createPredictionInputKeyParts(options, target)
      let reason = getRefreshReason(
        predictionInputKeyParts,
        nextInputKeyParts,
        predictionRefreshElapsed,
        options.predictionConfig.refreshInterval,
        predictionImplementation === 'kepler' &&
          isPassiveCoast(options) &&
          nearPredictionTier?.terminationReason === 'closed-orbit',
      )
      const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
      const orbitPolicyChanged =
        predictionInputAllowLoopTrim !== null &&
        predictionInputAllowLoopTrim !== allowLoopTrim
      if (
        orbitPolicyChanged &&
        (!reason || canReuseAcceptedWindowForReason(reason))
      ) {
        reason = 'orbit-policy-change'
      }
      let refreshed = false
      if (reason) {
        refreshForTarget(options, target, reason, nextInputKeyParts)
        refreshed = true
      } else if (
        acceptedCoastPredictionWindow &&
        shouldSplitPrediction(options, target)
      ) {
        const nearPredictionConfig = createPredictionConfigWithHorizon(
          options.predictionConfig,
          getNearPredictionHorizonSeconds(options.predictionConfig),
        )
        const acceptedWindowTiers = getAcceptedWindowTiers(
          options,
          target,
          nextInputKeyParts,
          nearPredictionConfig.horizonSeconds,
        )
        if ('fallbackReason' in acceptedWindowTiers) {
          refreshForTarget(options, target, 'timed-refresh', nextInputKeyParts)
          refreshed = true
        } else {
          const inputKey = createPredictionInputKey(nextInputKeyParts)
          nearPredictionTier = acceptedWindowTiers.nearTier
          farPredictionTier = acceptedWindowTiers.farTier
          applyPredictionTier({
            changedParts: [],
            event: null,
            farApplied: false,
            farCalculationMs: null,
            farCoalescingMinIntervalSeconds:
              getCurrentFarCoalescingMinIntervalSeconds(options),
            farTier: acceptedWindowTiers.farTier,
            inputKey,
            integrationStepSeconds: getIntegrationStepSeconds(
              options,
              target,
              options.predictionConfig,
            ),
            nearCalculationMs: null,
            nearFallbackReason: null,
            nearHorizonSeconds: nearPredictionConfig.horizonSeconds,
            nearTier: acceptedWindowTiers.nearTier,
            nearSource: 'accepted-window',
            nearWindow: acceptedWindowTiers,
            predictionConfig: options.predictionConfig,
            reason: predictionDiagnostics.refreshReason ?? 'timed-refresh',
            refreshStartMs: nowMs(),
            splitHorizon: shouldSplitPrediction(options, target),
            target,
            timeWarp: options.timeWarp,
          })
        }
      }
      return refreshed
    },
    recordGeometryUpdate: (geometryUpdateMs: number) => {
      predictionDiagnostics = {
        ...predictionDiagnostics,
        geometryUpdateMs,
      }
    },
    setFarCoalescingMinIntervalOverrideSeconds: (
      value: number | null,
    ): boolean => {
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        return false
      }

      farCoalescingMinIntervalOverrideSeconds = value
      updateFarCoalescingDiagnostics()
      return true
    },
    refresh,
  }
}

export type TrajectoryPredictionRuntime = ReturnType<
  typeof createTrajectoryPredictionRuntime
>
